import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import { formatTimestamp } from '@/lib/utils';
import type { ViralClip, ViralAnalysisResult, ViralCategory } from '@/lib/types';

const MODEL_NAME = 'gemini-2.5-flash';
const TOP_N = 3;
const MAX_TRANSCRIPT_BYTES = 500_000;

const VALID_CATEGORIES: ViralCategory[] = [
  'HOOK', 'EMOTIONAL_PEAK', 'OPINION_BOMB', 'REVELATION',
  'CONFLICT', 'QUOTABLE_LINE', 'STORY_PEAK', 'PRACTICAL_VALUE',
];

const SYSTEM_PROMPT = `You are an expert viral short-form video editor and content strategist.

Your job is to analyze a video transcript and identify the strongest potential viral clips.

Do NOT simply select generic interesting moments.

Evaluate clips using these virality dimensions:

1. HOOK - Does the opening immediately create curiosity? Is there a surprising statement, question, claim, or tension?
2. EMOTIONAL_PEAK - Strong emotion, surprise, fear, humor, excitement, anger, inspiration
3. OPINION_BOMB - Strong opinion, contrarian statement, controversial claim
4. REVELATION - New information, unexpected fact, myth-busting
5. CONFLICT - Debate, disagreement, tension, challenging common beliefs
6. QUOTABLE_LINE - A sentence that can stand alone, memorable, easy to quote or repost
7. STORY_PEAK - Important moment in a story, punchline, turning point, payoff
8. PRACTICAL_VALUE - Useful information, advice, actionable knowledge

A good viral clip should have: a strong opening, clear context, a payoff, emotional or intellectual tension, enough information to make sense without the entire video.

Avoid clips that: start too slowly, require too much previous context, contain incomplete sentences, are mostly greetings/introduction, are repetitive, have no clear payoff.

The clip should normally be between 15 and 90 seconds.

Return ONLY valid JSON with indonesia language (for title, hook, summary, why_viral, strengths, weaknesses, and overall_summary). Do not include markdown code blocks or any other text outside the JSON.`;

function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.some(isNaN)) throw new Error(`Invalid timestamp: "${ts}"`);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  throw new Error(`Invalid timestamp format: "${ts}"`);
}

function secondsToTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function validateAndSanitize(raw: unknown): ViralAnalysisResult {
  if (typeof raw !== 'object' || raw === null) throw new Error('Response is not an object.');
  const obj = raw as Record<string, unknown>;
  if (typeof obj.overall_summary !== 'string' || !obj.overall_summary.trim()) throw new Error('Missing "overall_summary".');
  if (!Array.isArray(obj.clips)) throw new Error('"clips" must be an array.');
  if (obj.clips.length > TOP_N) obj.clips = obj.clips.slice(0, TOP_N);

  const clips: ViralClip[] = (obj.clips as unknown[]).map((item: unknown, idx: number) => {
    if (typeof item !== 'object' || item === null) throw new Error(`Clip[${idx}] is not an object.`);
    const c = item as Record<string, unknown>;
    const required = ['rank', 'viral_score', 'start_time', 'end_time', 'duration_seconds', 'title', 'hook', 'summary', 'why_viral', 'category', 'strengths', 'weaknesses'] as const;
    for (const field of required) {
      if (c[field] === undefined || c[field] === null) throw new Error(`Clip[${idx}] missing "${field}".`);
    }
    const score = Number(c.viral_score);
    if (isNaN(score) || score < 0 || score > 100) throw new Error(`Clip[${idx}] viral_score must be 0–100.`);
    if (typeof c.start_time !== 'string' || typeof c.end_time !== 'string') throw new Error(`Clip[${idx}] timestamps must be strings.`);
    const startSec = timestampToSeconds(c.start_time);
    const endSec = timestampToSeconds(c.end_time);
    if (endSec <= startSec) throw new Error(`Clip[${idx}] end_time must be after start_time.`);
    if (!Array.isArray(c.category)) throw new Error(`Clip[${idx}] "category" must be an array.`);
    const category: ViralCategory[] = (c.category as unknown[])
      .filter((cat): cat is string => typeof cat === 'string')
      .filter((cat): cat is ViralCategory => VALID_CATEGORIES.includes(cat as ViralCategory));
    if (category.length === 0) category.push('HOOK');
    const strengths = (c.strengths as unknown[]).filter((s): s is string => typeof s === 'string');
    const weaknesses = (c.weaknesses as unknown[]).filter((s): s is string => typeof s === 'string');
    return {
      rank: Number(c.rank),
      viral_score: Math.round(score),
      start_time: secondsToTimestamp(startSec),
      end_time: secondsToTimestamp(endSec),
      duration_seconds: endSec - startSec,
      title: String(c.title),
      hook: String(c.hook),
      summary: String(c.summary),
      why_viral: String(c.why_viral),
      category,
      strengths,
      weaknesses,
    } satisfies ViralClip;
  });

  return { overall_summary: obj.overall_summary as string, clips };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ success: false, error: 'Gemini API key not configured.' }, { status: 503 });
  }

  const { id: videoId } = await params;

  // Verify ownership
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    include: {
      transcript: {
        include: { segments: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!video) {
    return Response.json({ success: false, error: 'Video not found or access denied.' }, { status: 404 });
  }

  if (!video.transcript || video.transcript.segments.length === 0) {
    return Response.json({ success: false, error: 'No transcript available. Fetch the transcript first.' }, { status: 422 });
  }

  // Build transcript string from stored segments
  const transcriptStr = video.transcript.segments
    .map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`)
    .join('\n');

  const byteLength = Buffer.byteLength(transcriptStr, 'utf8');
  if (byteLength > MAX_TRANSCRIPT_BYTES) {
    return Response.json({ success: false, error: `Transcript too large (${Math.round(byteLength / 1024)} KB).` }, { status: 400 });
  }

  // Create a job record
  const job = await prisma.job.create({
    data: {
      userId: session.user.id,
      videoId,
      type: 'VIRAL_ANALYSIS',
      status: 'PROCESSING',
      startedAt: new Date(),
    },
  });

  try {
    const genai = new GoogleGenAI({ apiKey });
    const userPrompt = `Analyze the following video transcript.\n\nSelect the TOP ${TOP_N} strongest potential viral clips.\n\nTranscript:\n\n-------------------------\n${transcriptStr}\n-------------------------\n\nFor each selected clip return:\n- rank\n- viral_score\n- start_time\n- end_time\n- duration_seconds\n- hook\n- title\n- summary\n- why_viral\n- category\n- strengths\n- weaknesses\n\nThe "category" can contain one or more of: HOOK, EMOTIONAL_PEAK, OPINION_BOMB, REVELATION, CONFLICT, QUOTABLE_LINE, STORY_PEAK, PRACTICAL_VALUE\n\nAlso return an overall summary explaining why these clips were selected.\n\nUse this exact JSON structure:\n\n{"overall_summary": "...","clips": [{"rank": 1,"viral_score": 95,"start_time": "00:30","end_time": "01:15","duration_seconds": 45,"title": "...","hook": "...","summary": "...","why_viral": "...","category": ["HOOK"],"strengths": ["..."],"weaknesses": ["..."]}]}`;

    const response = await genai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, responseMimeType: 'application/json' },
    });

    const rawText = response.text;
    if (!rawText?.trim()) throw new Error('Gemini returned an empty response.');

    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonText);
    const result = validateAndSanitize(parsed);

    // Persist ViralAnalysis and Clips to DB
    await prisma.$transaction(async (tx) => {
      // Upsert ViralAnalysis (only one per video)
      const viralAnalysis = await tx.viralAnalysis.upsert({
        where: { videoId },
        update: { overallSummary: result.overall_summary, updatedAt: new Date() },
        create: { videoId, overallSummary: result.overall_summary },
      });

      // Delete old clips
      await tx.clip.deleteMany({ where: { viralAnalysisId: viralAnalysis.id } });

      // Create new clips
      await tx.clip.createMany({
        data: result.clips.map((clip) => ({
          viralAnalysisId: viralAnalysis.id,
          rank: clip.rank,
          viralScore: clip.viral_score,
          startTime: clip.start_time,
          endTime: clip.end_time,
          startSeconds: timestampToSeconds(clip.start_time),
          endSeconds: timestampToSeconds(clip.end_time),
          durationSeconds: clip.duration_seconds,
          title: clip.title,
          hook: clip.hook,
          summary: clip.summary,
          whyViral: clip.why_viral,
          category: clip.category,
          strengths: clip.strengths,
          weaknesses: clip.weaknesses,
          processingStatus: 'PENDING',
        })),
      });
    });

    // Mark job as completed
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    return Response.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';

    // Mark job as failed
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

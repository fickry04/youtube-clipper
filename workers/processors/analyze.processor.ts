/**
 * workers/processors/analyze-job.ts
 *
 * For a given video:
 *   1. Load video transcript from database
 *   2. Prompt Gemini AI to analyze transcript and find top viral clips
 *   3. Parse, validate, and sanitize the AI JSON response
 *   4. Persist ViralAnalysis and Clips to Database
 *   5. Update job status
 */

import { Job } from 'bullmq';
import { GoogleGenAI } from '@google/genai';
import prisma from '../../lib/prisma';
import { formatTimestamp, parseTranscriptSegments } from '../../lib/utils';
import type { ViralAnalysisPayload } from '../../lib/queue/jobs';
import { setJobProgress } from '..';
import type { ViralClip, ViralAnalysisResult, ViralCategory } from '@/lib/types';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const TOP_N = 5;
const MAX_TRANSCRIPT_BYTES = 2_000_000;

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

The clip should normally be between 30 and 180 seconds. Make sure the resulting transcript contains the full speech/talk of the clip, not cut off while the conversation or talk is still going on.

Return ONLY valid JSON with indonesia language (for title, hook, summary, why_viral, strengths, weaknesses, and overall_summary). Do not include markdown code blocks or any other text outside the JSON.`;

// Utility functions
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

// Main processor function
export async function processViralAnalysis(job: Job<ViralAnalysisPayload>): Promise<void> {
  const { jobId, userId, videoId } = job.data;

  // 1. Mark job as processing
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', progress: 5, startedAt: new Date(), attempts: { increment: 1 } },
  });
  await setJobProgress(jobId, job, 5);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key not configured.');

    // 2. Fetch video and transcript
    const video = await prisma.video.findFirst({
      where: { id: videoId, project: { userId } },
      include: { transcript: true },
    });

    if (!video) throw new Error(`Video ${videoId} not found or access denied.`);

    const segments = parseTranscriptSegments(video.transcript?.segments);
    if (!video.transcript || segments.length === 0) {
      throw new Error('No transcript available. Fetch the transcript first.');
    }

    const transcriptStr = segments
      .map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`)
      .join('\n');

    const byteLength = Buffer.byteLength(transcriptStr, 'utf8');
    if (byteLength > MAX_TRANSCRIPT_BYTES) {
      throw new Error(`Transcript too large (${Math.round(byteLength / 1024)} KB).`);
    }

    await setJobProgress(jobId, job, 15);

    // 3. Prompt Gemini AI
    console.log(`[analyze-job] Analyzing transcript for video ${videoId}...`);
    const genai = new GoogleGenAI({ apiKey });
    const userPrompt = `Analyze the following video transcript.\n\nSelect the TOP ${TOP_N} strongest potential viral clips.\n\nTranscript:\n\n-------------------------\n${transcriptStr}\n-------------------------\n\nFor each selected clip return:\n- rank\n- viral_score\n- start_time\n- end_time\n- duration_seconds\n- hook\n- title\n- summary\n- why_viral\n- category\n- strengths\n- weaknesses\n\nThe "category" can contain one or more of: HOOK, EMOTIONAL_PEAK, OPINION_BOMB, REVELATION, CONFLICT, QUOTABLE_LINE, STORY_PEAK, PRACTICAL_VALUE\n\nAlso return an overall summary explaining why these clips were selected.\n\nUse this exact JSON structure:\n\n{"overall_summary": "...","clips": [{"rank": 1,"viral_score": 95,"start_time": "00:30","end_time": "01:15","duration_seconds": 45,"title": "...","hook": "...","summary": "...","why_viral": "...","category": ["HOOK"],"strengths": ["..."],"weaknesses": ["..."]}]}`;

    const response = await genai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, responseMimeType: 'application/json' },
    });

    await setJobProgress(jobId, job, 60);

    // 4. Parse and sanitize AI response
    const rawText = response.text;
    if (!rawText?.trim()) throw new Error('Gemini returned an empty response.');

    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonText);
    const result = validateAndSanitize(parsed);

    await setJobProgress(jobId, job, 75);

    // 5. Persist ViralAnalysis and Clips to DB
    await prisma.$transaction(async (tx) => {
      const viralAnalysis = await tx.viralAnalysis.upsert({
        where: { videoId },
        update: { overallSummary: result.overall_summary, updatedAt: new Date() },
        create: { videoId, overallSummary: result.overall_summary },
      });

      await tx.clip.deleteMany({ where: { viralAnalysisId: viralAnalysis.id } });

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

    await setJobProgress(jobId, job, 90);

    // 6. Mark job as completed
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    await job.updateProgress(100);
    console.log(`[analyze-job] ✓ Successfully analyzed transcript and saved clips for video ${videoId}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';
    console.error(`[analyze-job] ✗ Failed to process viral analysis:`, message);

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });
    throw err;
  }
}
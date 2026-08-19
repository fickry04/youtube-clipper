import { GoogleGenAI } from '@google/genai';
import type { NextRequest } from 'next/server';
import type {
  ViralClip,
  ViralAnalysisResult,
  ViralCategory,
  AnalyzeSuccessResponse,
  ErrorResponse,
} from '@/lib/types';

// ============================================================
// CONFIG
// ============================================================

const MODEL_NAME = 'gemini-2.5-flash';
const TOP_N = 3;
const MAX_TRANSCRIPT_BYTES = 500_000; // 500 KB

// ============================================================
// VALID CATEGORIES
// ============================================================

const VALID_CATEGORIES: ViralCategory[] = [
  'HOOK',
  'EMOTIONAL_PEAK',
  'OPINION_BOMB',
  'REVELATION',
  'CONFLICT',
  'QUOTABLE_LINE',
  'STORY_PEAK',
  'PRACTICAL_VALUE',
];

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are an expert viral short-form video editor and content strategist.

Your job is to analyze a video transcript and identify the strongest potential viral clips.

Do NOT simply select generic interesting moments.

Evaluate clips using these virality dimensions:

1. HOOK
   - Does the opening immediately create curiosity?
   - Is there a surprising statement, question, claim, or tension?

2. EMOTIONAL_PEAK
   - Strong emotion
   - Surprise
   - Fear
   - Humor
   - Excitement
   - Anger
   - Inspiration

3. OPINION_BOMB
   - Strong opinion
   - Contrarian statement
   - Controversial claim
   - Something people may disagree with

4. REVELATION
   - New information
   - Unexpected fact
   - Myth-busting
   - "I didn't know that" moment

5. CONFLICT
   - Debate
   - Disagreement
   - Tension
   - Challenging common beliefs

6. QUOTABLE_LINE
   - A sentence that can stand alone
   - Memorable
   - Easy to quote or repost

7. STORY_PEAK
   - Important moment in a story
   - Punchline
   - Turning point
   - Payoff

8. PRACTICAL_VALUE
   - Useful information
   - Advice
   - Actionable knowledge
   - Answer to a common question

A good viral clip should ideally have:
- a strong opening
- clear context
- a payoff
- emotional or intellectual tension
- enough information to make sense without the entire video

Avoid clips that:
- start too slowly
- require too much previous context
- contain incomplete sentences
- are mostly greetings/introduction
- are repetitive
- have no clear payoff

IMPORTANT:

The transcript timestamps represent the original video timeline.

You must return timestamps for every selected clip.

The clip should normally be between 15 and 90 seconds.

If necessary, include a few seconds before the strongest sentence to create a better hook/context.

Score every candidate from 0-100.

The final viral score should reflect the likelihood that the clip will:
- stop scrolling
- retain viewers
- generate comments
- generate shares
- generate saves
- create curiosity
- provide value

Return ONLY valid JSON with indonesia language (for title, hook, summary, why_viral, strengths, weaknesses, and overall_summary).
Do not include markdown code blocks or any other text outside the JSON.`;

// ============================================================
// HELPERS
// ============================================================

/** Convert "MM:SS" or "H:MM:SS" timestamp string to total seconds */
function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.some(isNaN)) throw new Error(`Invalid timestamp: "${ts}"`);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  throw new Error(`Invalid timestamp format: "${ts}"`);
}

/** Format seconds (float) → "MM:SS" */
function secondsToTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Normalise the transcript that comes in as "[MM:SS] text" lines.
 * Re-formats each line cleanly and drops blank lines.
 */
function normalizeTranscript(raw: string): string {
  const lines: string[] = [];

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Match "[MM:SS] text" or "[H:MM:SS] text"
    const match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)/);
    if (match) {
      const ts = match[1];
      const text = match[2].trim();
      lines.push(`[${ts}] ${text}`);
    } else {
      // Keep lines without timestamps as-is (shouldn't normally happen)
      lines.push(line);
    }
  }

  return lines.join('\n');
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Type-safe validation of Gemini JSON response.
 * Throws descriptive Error on any violation.
 * Mutates clip.duration_seconds to be the computed value.
 */
function validateAndSanitize(raw: unknown): ViralAnalysisResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Response is not an object.');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.overall_summary !== 'string' || !obj.overall_summary.trim()) {
    throw new Error('Missing or empty "overall_summary".');
  }

  if (!Array.isArray(obj.clips)) {
    throw new Error('"clips" must be an array.');
  }

  if (obj.clips.length > TOP_N) {
    // Truncate to TOP_N instead of throwing — Gemini sometimes returns more
    obj.clips = obj.clips.slice(0, TOP_N);
  }

  const clips: ViralClip[] = (obj.clips as unknown[]).map((item: unknown, idx: number) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Clip[${idx}] is not an object.`);
    }

    const c = item as Record<string, unknown>;

    const required = [
      'rank', 'viral_score', 'start_time', 'end_time',
      'duration_seconds', 'title', 'hook', 'summary',
      'why_viral', 'category', 'strengths', 'weaknesses',
    ] as const;

    for (const field of required) {
      if (c[field] === undefined || c[field] === null) {
        throw new Error(`Clip[${idx}] is missing required field "${field}".`);
      }
    }

    // viral_score
    const score = Number(c.viral_score);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Clip[${idx}] viral_score must be 0–100, got: ${c.viral_score}`);
    }

    // timestamps
    if (typeof c.start_time !== 'string' || typeof c.end_time !== 'string') {
      throw new Error(`Clip[${idx}] start_time and end_time must be strings.`);
    }

    const startSec = timestampToSeconds(c.start_time);
    const endSec = timestampToSeconds(c.end_time);

    if (endSec <= startSec) {
      throw new Error(
        `Clip[${idx}] end_time (${c.end_time}) must be after start_time (${c.start_time}).`
      );
    }

    const duration = endSec - startSec;

    // Warn if duration is extreme but don't reject (soft validation)
    // duration < 15 or > 90 is allowed to pass since Gemini may have valid reasons

    // category — filter out unknown values instead of throwing
    // (Gemini occasionally adds its own subcategories like "HUMOR")
    if (!Array.isArray(c.category)) {
      throw new Error(`Clip[${idx}] "category" must be an array.`);
    }

    const category: ViralCategory[] = (c.category as unknown[])
      .filter((cat): cat is string => typeof cat === 'string')
      .filter((cat): cat is ViralCategory => VALID_CATEGORIES.includes(cat as ViralCategory));

    // Fallback so we always have at least one category
    if (category.length === 0) {
      category.push('HOOK');
    }

    // strengths / weaknesses
    if (!Array.isArray(c.strengths)) {
      throw new Error(`Clip[${idx}] "strengths" must be an array.`);
    }
    if (!Array.isArray(c.weaknesses)) {
      throw new Error(`Clip[${idx}] "weaknesses" must be an array.`);
    }

    const strengths = (c.strengths as unknown[])
      .filter((s): s is string => typeof s === 'string');
    const weaknesses = (c.weaknesses as unknown[])
      .filter((s): s is string => typeof s === 'string');

    return {
      rank: Number(c.rank),
      viral_score: Math.round(score),
      start_time: secondsToTimestamp(startSec),
      end_time: secondsToTimestamp(endSec),
      duration_seconds: duration,
      title: String(c.title),
      hook: String(c.hook),
      summary: String(c.summary),
      why_viral: String(c.why_viral),
      category,
      strengths,
      weaknesses,
    } satisfies ViralClip;
  });

  return {
    overall_summary: obj.overall_summary as string,
    clips,
  } satisfies ViralAnalysisResult;
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function POST(request: NextRequest): Promise<Response> {
  // Security: verify API key exists server-side
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        success: false,
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in your .env.local file.',
      } satisfies ErrorResponse,
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON in request body.' } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json(
      { success: false, error: 'Request body must be a JSON object.' } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  const { transcript } = body as Record<string, unknown>;

  if (typeof transcript !== 'string' || !transcript.trim()) {
    return Response.json(
      { success: false, error: 'Missing or empty "transcript" field.' } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  // Size guard
  const byteLength = Buffer.byteLength(transcript, 'utf8');
  if (byteLength > MAX_TRANSCRIPT_BYTES) {
    return Response.json(
      {
        success: false,
        error: `Transcript is too long (${(byteLength / 1024).toFixed(0)} KB). Maximum allowed is ${MAX_TRANSCRIPT_BYTES / 1024} KB.`,
      } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  // Normalize transcript
  const normalized = normalizeTranscript(transcript);

  if (!normalized.trim()) {
    return Response.json(
      { success: false, error: 'Transcript contains no readable content.' } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  // Build user prompt (faithfully ported from SeleksiTranskrip.py)
  const userPrompt = `Analyze the following video transcript.

Select the TOP ${TOP_N} strongest potential viral clips.

Transcript:

-------------------------
${normalized}
-------------------------

For each selected clip return:

- rank
- viral_score
- start_time
- end_time
- duration_seconds
- hook
- title
- summary
- why_viral
- category
- strengths
- weaknesses

The "category" can contain one or more of:

HOOK
EMOTIONAL_PEAK
OPINION_BOMB
REVELATION
CONFLICT
QUOTABLE_LINE
STORY_PEAK
PRACTICAL_VALUE

The "strengths" field should explain which viral dimensions make the clip strong.

The "weaknesses" field should explain any potential problems.

Also return an overall summary explaining why these clips were selected.

Use this exact JSON structure:

{
    "overall_summary": "...",
    "clips": [
        {
            "rank": 1,
            "viral_score": 95,
            "start_time": "00:30",
            "end_time": "01:15",
            "duration_seconds": 45,
            "title": "...",
            "hook": "...",
            "summary": "...",
            "why_viral": "...",
            "category": [
                "HOOK",
                "PRACTICAL_VALUE"
            ],
            "strengths": [
                "...",
                "..."
            ],
            "weaknesses": [
                "..."
            ]
        }
    ]
}`;

  // Call Gemini
  try {
    const genai = new GoogleGenAI({ apiKey });

    const response = await genai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text;

    if (!rawText || !rawText.trim()) {
      return Response.json(
        { success: false, error: 'Gemini returned an empty response.' } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    // Strip any accidental markdown fences Gemini may add
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr: unknown) {
      const hint = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return Response.json(
        {
          success: false,
          error: `Gemini returned invalid JSON. Parse error: ${hint}`,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    let result: ViralAnalysisResult;
    try {
      result = validateAndSanitize(parsed);
    } catch (validErr: unknown) {
      const hint = validErr instanceof Error ? validErr.message : String(validErr);
      return Response.json(
        {
          success: false,
          error: `Gemini response failed validation: ${hint}`,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      result,
    } satisfies AnalyzeSuccessResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error calling Gemini API.';
    return Response.json(
      { success: false, error: `Gemini API error: ${message}` } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}

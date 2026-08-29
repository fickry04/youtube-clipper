import { GoogleGenAI } from '@google/genai';
import {
  PLATFORM_META,
  SOCIAL_PLATFORMS,
  truncateCaption,
  type PlatformCaptionMap,
} from './platforms';

const MODEL_NAME = 'gemini-3.6-flash';

export interface ClipCaptionContext {
  clipTitle: string;
  hook: string;
  summary: string;
  whyViral: string;
  categories: string[];
  durationSeconds: number;
  videoTitle?: string | null;
  authorName?: string | null;
  transcriptExcerpt?: string | null;
}

const SYSTEM_PROMPT = `You are a social media growth strategist for short-form vertical videos.

Given a viral clip's metadata, you write ready-to-post caption packages in INDONESIAN for five platforms.

Platform voice guidelines:
- YOUTUBE (Shorts): punchy title-style hook (max ${PLATFORM_META.YOUTUBE.maxHookChars} chars). Description may include one short call-to-action sentence. Hashtags sparse.
- TIKTOK: casual, conversational, FOMO-inducing hook. Description short and energetic.
- INSTAGRAM (Reels): lifestyle tone, hook slightly inspirational or bold, description can have 1-2 emoji.
- X (Twitter): the WHOLE post (hook + description + hashtags) must fit ${PLATFORM_META.X.maxDescriptionChars} characters total. Be compact and opinionated.
- THREADS: relaxed discussion starter; ends naturally to invite replies.

Hard rules:
- "hook" is the attention-grabbing title line; respect each platform's maxHookChars.
- "description" is the body text with a few hashtags on it; keep within maxDescriptionChars INCLUDING any hashtags you inline.
- "authorName" is the author name, ALWAYS copy this and put it on the last line of the description with Source: YT <authorName>.
- Always include ALL five platform keys (YOUTUBE, TIKTOK, INSTAGRAM, X, THREADS).
- Indonesian language for all copy. Never mention that you are an AI.`;

function buildUserPrompt(ctx: ClipCaptionContext): string {
  const lines = [
    'Write the caption package for this clip.',
    '',
    `Video title: ${ctx.videoTitle?.trim() || '(tidak tersedia)'}`,
    `Clip title: ${ctx.clipTitle}`,
    `Clip duration: ${Math.round(ctx.durationSeconds)} seconds`,
    `Clip hook (from analysis): ${ctx.hook}`,
    `Clip summary: ${ctx.summary}`,
    `Why it went viral: ${ctx.whyViral}`,
    `Categories: ${ctx.categories.join(', ') || '-'}`,
    `Author name: ${ctx.authorName || '-'}`,
  ];
  if (ctx.transcriptExcerpt) {
    lines.push('', 'Transcript excerpt (may be truncated):', ctx.transcriptExcerpt);
  }
  lines.push(
    '',
    `Use this exact JSON structure (keys must be exactly ${SOCIAL_PLATFORMS.join(', ')}), also put the hashtags on description too:`,
    '{"YOUTUBE": {"hook": "...", "description": "...", "TIKTOK": {...}, "INSTAGRAM": {...}, "X": {...}, "THREADS": {...}}'
  );
  return lines.join('\n');
}

function fallbackCaption(
  ctx: ClipCaptionContext,
  platform: keyof typeof PLATFORM_META
): { hook: string; description: string; } {
  const meta = PLATFORM_META[platform];
  return {
    hook: truncateCaption(ctx.hook || ctx.clipTitle, meta.maxHookChars),
    description: truncateCaption(ctx.summary, Math.max(60, meta.maxDescriptionChars)),
  };
}

/** Map arbitrary parsed JSON into a fully-populated PlatformCaptionMap, never throwing. */
export function sanitizeCaptions(raw: unknown, ctx: ClipCaptionContext): PlatformCaptionMap {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const result: PlatformCaptionMap = {};

  for (const platform of SOCIAL_PLATFORMS) {
    const meta = PLATFORM_META[platform];
    const entry = typeof obj[platform] === 'object' && obj[platform] !== null
      ? (obj[platform] as Record<string, unknown>)
      : {};
    const fb = fallbackCaption(ctx, platform);

    result[platform] = {
      hook: truncateCaption(
        typeof entry.hook === 'string' && entry.hook.trim() ? entry.hook : fb.hook,
        meta.maxHookChars
      ),
      description: truncateCaption(
        typeof entry.description === 'string' && entry.description.trim()
          ? entry.description
          : fb.description,
        meta.maxDescriptionChars
      ),
    };
  }
  return result;
}

/**
 * Generate per-platform caption packages via Gemini.
 * Throws when the API key is missing or Gemini fails/returns nothing;
 * sanitizeCaptions guarantees usable content otherwise.
 */
export async function generatePlatformCaptions(ctx: ClipCaptionContext): Promise<PlatformCaptionMap> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured.');

  const genai = new GoogleGenAI({ apiKey });
  const response = await genai.models.generateContent({
    model: MODEL_NAME,
    contents: buildUserPrompt(ctx),
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.8, responseMimeType: 'application/json' },
  });

  const rawText = response.text;
  if (!rawText?.trim()) throw new Error('Gemini returned an empty response.');
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return sanitizeCaptions(JSON.parse(jsonText), ctx);
}

/**
 * Parse a stored clip.socialCaptions JSON value back into PlatformCaptionMap.
 * Cached rows are stored as { generatedAt: ISO, captions: {...} } but plain maps are tolerated.
 * Only platforms that actually exist in the cache are returned — no fallback filling.
 */
export function parseCachedCaptions(raw: unknown): PlatformCaptionMap | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const source = typeof obj.captions === 'object' && obj.captions !== null ? obj.captions : obj;
  if (typeof source !== 'object' || source === null) return null;

  const result: PlatformCaptionMap = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const entry = (source as Record<string, unknown>)[platform];
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.hook !== 'string' && typeof e.description !== 'string') continue;
    result[platform] = {
      hook: typeof e.hook === 'string' ? e.hook : '',
      description: typeof e.description === 'string' ? e.description : '',
    };
  }
  return Object.keys(result).length > 0 ? result : null;
}

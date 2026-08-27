/**
 * Shared definitions for supported social media platforms.
 *
 * HYBRID NOTE: The active flow today is "manual upload preparation" — we
 * generate the caption package (hook title, description with hashtags) and
 * open each platform's upload page in a new tab. Each entry below is designed
 * so a per-platform OAuth auto-posting client can be attached later (where
 * marked POSTING CLIENT HOOK) without touching UI or API code.
 */

export const SOCIAL_PLATFORMS = ['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'X', 'THREADS'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Note: intentionally a type alias (not an interface) so the shape carries an
 * implicit index signature — required for direct assignment into Prisma's
 * `InputJsonValue` when caching captions on a Clip row.
 */
export type PlatformCaption = {
  hook: string;
  description: string;
  hashtags: string[];
};

export type PlatformCaptionMap = Partial<Record<SocialPlatform, PlatformCaption>>;

interface PlatformMeta {
  label: string;
  shortLabel: string;
  /** Primary brand accent used across UI (borders, icons, glows). */
  color: string;
  /** Secondary brand color for gradients; falls back to `color`. */
  color2?: string;
  maxHookChars: number;
  maxDescriptionChars: number;
  /** Recommended number of hashtags returned by the AI. */
  recommendedHashtags: [number, number];
  /** Manual upload / composer page opened in a new tab. */
  uploadUrl: string;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  YOUTUBE: {
    label: 'YouTube Shorts',
    shortLabel: 'YouTube',
    color: '#FF0000',
    color2: '#FF4E45',
    maxHookChars: 100,
    maxDescriptionChars: 5000,
    recommendedHashtags: [3, 5],
    uploadUrl: 'https://studio.youtube.com/channel/upload',
  },
  TIKTOK: {
    label: 'TikTok',
    shortLabel: 'TikTok',
    color: '#FE2C55',
    color2: '#25F4EE',
    maxHookChars: 100,
    maxDescriptionChars: 2200,
    recommendedHashtags: [3, 6],
    uploadUrl: 'https://www.tiktok.com/tiktokstudio/upload',
  },
  INSTAGRAM: {
    label: 'Instagram Reels',
    shortLabel: 'Instagram',
    color: '#DD2A7B',
    color2: '#8134AF',
    maxHookChars: 125,
    maxDescriptionChars: 2200,
    recommendedHashtags: [5, 10],
    uploadUrl: 'https://www.instagram.com/',
  },
  X: {
    label: 'X (Twitter)',
    shortLabel: 'X',
    color: '#1D9BF0',
    maxHookChars: 90,
    maxDescriptionChars: 280,
    recommendedHashtags: [1, 3],
    uploadUrl: 'https://x.com/compose/post',
  },
  THREADS: {
    label: 'Threads',
    shortLabel: 'Threads',
    color: '#A78BFA',
    color2: '#7C3AED',
    maxHookChars: 80,
    maxDescriptionChars: 500,
    recommendedHashtags: [2, 5],
    uploadUrl: 'https://www.threads.net/',
  },
};

/**
 * Validate an arbitrary value into a SocialPlatform.
 * Returns null when the value is not one of the supported platforms.
 */
export function normalizePlatform(value: unknown): SocialPlatform | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return (SOCIAL_PLATFORMS as readonly string[]).includes(upper)
    ? (upper as SocialPlatform)
    : null;
}

/** Hashtag form: "#" + letters/digits/underscore, no spaces. */
const HASHTAG_ALLOWED = /^[A-Za-z0-9_]+$/u;

function toHashtag(raw: string): string | null {
  let tag = raw.trim().replace(/^#+/u, '').replace(/\s+/gu, '');
  if (!tag || !HASHTAG_ALLOWED.test(tag)) return null;
  // Collapse to a sane length so a runaway tag cannot blow up a post.
  tag = tag.slice(0, 40);
  return `#${tag}`;
}

/** Normalize arbitrary hashtag input ("tag", "#Tag", "tag #one two") into canonical "#tag" strings. */
export function normalizeHashtags(input: unknown, min = 0, max = 15): string[] {
  const rawItems = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\s,]+/)
      : [];
  const tags: string[] = [];
  for (const item of rawItems) {
    if (typeof item !== 'string') continue;
    const tag = toHashtag(item);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= max) break;
  }
  return tags.slice(Math.min(min, tags.length));
}

/** True when `description` already contains every provided hashtag. */
export function descriptionHasHashtags(description: string, hashtags: string[]): boolean {
  if (hashtags.length === 0) return true;
  const needle = hashtags[hashtags.length - 1];
  return description.includes(needle);
}

/** Join hook + description + hashtags into one copy-ready caption block. */
export function buildFullCaption(caption: PlatformCaption): string {
  const parts = [caption.hook.trim(), '\n'];
  const desc = caption.description.trim();
  parts.push(desc);
  if (!descriptionHasHashtags(desc, caption.hashtags)) {
    parts.push('\n\n', caption.hashtags.join(' '));
  }
  return parts.join('\n');
}

/**
 * Truncate a caption field at a soft character limit on a word boundary,
 * appending an ellipsis when content was cut.
 */
export function truncateCaption(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, Math.max(1, limit - 1));
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

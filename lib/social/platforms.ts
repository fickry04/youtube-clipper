/**
 * Shared definitions for supported social media platforms.
 *
 * HYBRID NOTE: The active flow today is "manual upload preparation" — we
 * generate the caption package (hook title, description with hashtags) and
 * open each platform's upload page in a new tab. Each entry below is designed
 * so a per-platform OAuth auto-posting client can be attached later (where
 * marked POSTING CLIENT HOOK) without touching UI or API code.
 */

export const SOCIAL_PLATFORMS = ['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'X', 'THREADS', 'FACEBOOK'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Note: intentionally a type alias (not an interface) so the shape carries an
 * implicit index signature — required for direct assignment into Prisma's
 * `InputJsonValue` when caching captions on a Clip row.
 */
export type PlatformCaption = {
  hook: string;
  description: string;
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
    uploadUrl: 'https://studio.youtube.com/channel/upload',
  },
  TIKTOK: {
    label: 'TikTok',
    shortLabel: 'TikTok',
    color: '#FE2C55',
    color2: '#25F4EE',
    maxHookChars: 100,
    maxDescriptionChars: 2200,
    uploadUrl: 'https://www.tiktok.com/tiktokstudio/upload',
  },
  INSTAGRAM: {
    label: 'Instagram Reels',
    shortLabel: 'Instagram',
    color: '#DD2A7B',
    color2: '#8134AF',
    maxHookChars: 125,
    maxDescriptionChars: 2200,
    uploadUrl: 'https://www.instagram.com/',
  },
  X: {
    label: 'X (Twitter)',
    shortLabel: 'X',
    color: '#1D9BF0',
    maxHookChars: 90,
    maxDescriptionChars: 280,
    uploadUrl: 'https://x.com/compose/post',
  },
  THREADS: {
    label: 'Threads',
    shortLabel: 'Threads',
    color: '#A78BFA',
    color2: '#7C3AED',
    maxHookChars: 80,
    maxDescriptionChars: 500,
    uploadUrl: 'https://www.threads.net/',
  },
  FACEBOOK: {
    label: 'Facebook',
    shortLabel: 'Facebook',
    color: '#1877F2',
    maxHookChars: 90,
    maxDescriptionChars: 280,
    uploadUrl: 'https://www.facebook.com/profile.php',
  },
};

/** Join hook + description and hashtags into one copy-ready caption block. */
export function buildFullCaption(caption: PlatformCaption): string {
  const parts = [caption.hook.trim(), '\n'];
  const desc = caption.description.trim();
  parts.push(desc);
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
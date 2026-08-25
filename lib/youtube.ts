import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
import type { VideoInfo } from './utils';

function getCookiesPath(): string | null {
  if (process.env.YTDLP_COOKIES_PATH && existsSync(process.env.YTDLP_COOKIES_PATH)) {
    return process.env.YTDLP_COOKIES_PATH;
  }
  const rootCookies = path.join(process.cwd(), 'cookies.txt');
  if (existsSync(rootCookies)) {
    return rootCookies;
  }
  return null;
}

/**
 * Server-only helper to fetch YouTube video metadata.
 * 1. Uses YouTube oEmbed API for instant title & author fetching (no external binary needed).
 * 2. Uses yt-dlp safe child_process spawn to fetch duration, description, & high-res thumbnail.
 */
export async function fetchYoutubeVideoInfo(youtubeUrl: string, youtubeId: string): Promise<VideoInfo> {
  let title = '';
  let channel = '';
  let thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  let duration_number = 0;
  let duration_string = '';
  let description = '';

  // 1. YouTube oEmbed (instant response for title and channel)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      if (data.title) title = data.title;
      if (data.author_name) channel = data.author_name;
      if (data.thumbnail_url) thumbnail = data.thumbnail_url;
    }
  } catch (err) {
    console.warn('oEmbed fetch error:', err);
  }

  // 2. yt-dlp safe child process for duration, description, etc.
  try {
    const ytdlpBin = process.env.YTDLP_PATH ?? 'yt-dlp';
    const cookiesPath = getCookiesPath();
    const ytdlpResult = await new Promise<{
      duration?: number;
      duration_string?: string;
      title?: string;
      uploader?: string;
      channel?: string;
      thumbnail?: string;
      description?: string;
    }>((resolve, reject) => {
      const child = spawn(
        /*turbopackIgnore: true*/ ytdlpBin,
        [
          '--dump-json',
          '--no-playlist',
          '--js-runtimes',
          'node',
          ...(cookiesPath
            ? ['--cookies', cookiesPath]
            : ['--extractor-args', 'youtube:player_client=web_embedded']),
          youtubeUrl,
        ],
        { timeout: 8000 }
      );

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => {
        stdout += d;
      });
      child.stderr.on('data', (d) => {
        stderr += d;
      });
      child.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        }
      });
      child.on('error', reject);
    });

    if (ytdlpResult) {
      if (ytdlpResult.title) title = ytdlpResult.title;
      if (ytdlpResult.uploader || ytdlpResult.channel) {
        channel = (ytdlpResult.uploader as string) || (ytdlpResult.channel as string);
      }
      if (ytdlpResult.thumbnail) thumbnail = ytdlpResult.thumbnail as string;
      if (typeof ytdlpResult.duration === 'number') {
        duration_number = ytdlpResult.duration;
      }
      if (ytdlpResult.duration_string) {
        duration_string = ytdlpResult.duration_string as string;
      }
      if (ytdlpResult.description) {
        description = ytdlpResult.description as string;
      }
    }
  } catch (err) {
    console.warn('yt-dlp metadata fetch warning:', err);
  }

  return {
    title: title || youtubeId,
    channel,
    thumbnail,
    duration_number,
    duration_string,
    description,
  };
}

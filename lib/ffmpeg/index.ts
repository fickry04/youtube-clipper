/**
 * lib/ffmpeg/index.ts
 *
 * Safe FFmpeg wrapper using spawn with argument arrays (no shell interpolation).
 * All public functions return a Promise that resolves on success or rejects
 * with a descriptive error including the FFmpeg stderr output.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

const FFMPEG_BIN = process.env.FFMPEG_PATH ?? 'ffmpeg';

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Include last 2 KB of stderr for diagnostics
        const tail = stderr.slice(-2048);
        reject(new Error(`ffmpeg exited with code ${code}.\n${tail}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// cutVideo
// ---------------------------------------------------------------------------

export interface CutVideoOptions {
  /** Absolute path to the source video file */
  sourcePath: string;
  /** Start time in seconds */
  startSeconds: number;
  /** End time in seconds */
  endSeconds: number;
  /** Absolute path where the output clip should be written */
  outputPath: string;
}

/**
 * Cut a segment from a video file using stream-copy (no re-encode).
 * Creates the output directory if it does not exist.
 */
export async function cutVideo(opts: CutVideoOptions): Promise<void> {
  const { sourcePath, startSeconds, endSeconds, outputPath } = opts;

  if (endSeconds <= startSeconds) {
    throw new Error(
      `cutVideo: endSeconds (${endSeconds}) must be greater than startSeconds (${startSeconds}).`
    );
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const duration = endSeconds - startSeconds;

  await runFFmpeg([
    '-y',                        // overwrite output without prompting
    '-ss', String(startSeconds), // seek input to start position
    '-i', sourcePath,            // input file
    '-t', String(duration),      // duration to cut
    '-c', 'copy',                // stream-copy (fast, no re-encode)
    '-avoid_negative_ts', 'make_zero',
    '-movflags', '+faststart',   // optimise for web streaming
    outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// burnSubtitle
// ---------------------------------------------------------------------------

export interface BurnSubtitleOptions {
  /** Absolute path to the video clip */
  videoPath: string;
  /** Absolute path to the SRT or ASS subtitle file */
  srtPath: string;
  /** Absolute path where the output video with burned subtitles is written */
  outputPath: string;
  /**
   * Optional font size for the subtitles (default: 24).
   * Ignored if srtPath is an .ass file with its own embedded styles.
   */
  fontSize?: number;
}

/**
 * Burn SRT or ASS subtitles into a video using the `subtitles` filter.
 * This re-encodes the video with libx264 / aac for maximum compatibility.
 */
export async function burnSubtitle(opts: BurnSubtitleOptions): Promise<void> {
  const { videoPath, srtPath, outputPath, fontSize = 24 } = opts;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const isAss = srtPath.toLowerCase().endsWith('.ass');

  // FFmpeg filtergraph escaping:
  // Escapes backslashes, colons, single quotes, brackets, spaces
  const escapedPath = srtPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\''")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/ /g, '\\ ');

  const filterString = isAss
    ? `subtitles='${escapedPath}'`
    : `subtitles='${escapedPath}':force_style='FontSize=${fontSize},Alignment=2,MarginV=40'`;

  await runFFmpeg([
    '-y',
    '-i', videoPath,
    '-vf', filterString,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// cropVertical (9:16)
// ---------------------------------------------------------------------------

export interface CropVerticalOptions {
  /** Absolute path to the source clip */
  videoPath: string;
  /** Absolute path for the output vertical clip */
  outputPath: string;
  /**
   * Optional crop anchor expressed as a normalised X centre (0.0–1.0).
   * Defaults to 0.5 (centre crop).
   */
  xCenterNorm?: number;
}

/**
 * Crop a landscape video to 9:16 vertical format.
 * Uses FFmpeg `crop` filter; does not re-encode by default (copy audio, encode video).
 */
export async function cropVertical(opts: CropVerticalOptions): Promise<void> {
  const { videoPath, outputPath, xCenterNorm = 0.5 } = opts;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // Crop to 9:16 from the input width/height (forced to even dimensions for libx264).
  // out_w = trunc(in_h*9/16/2)*2, out_h = trunc(in_h/2)*2
  const cropFilter =
    `crop=trunc(in_h*9/16/2)*2:trunc(in_h/2)*2:` +
    `(in_w - trunc(in_h*9/16/2)*2)*${xCenterNorm}:0`;

  await runFFmpeg([
    '-y',
    '-i', videoPath,
    '-vf', cropFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export interface CropVerticalManualOptions {
  /** Absolute path to the source clip */
  videoPath: string;
  /** Absolute path for the output vertical clip */
  outputPath: string;
  /** Horizontal anchor (0.0 = leftmost, 0.5 = center, 1.0 = rightmost) */
  xCenterNorm?: number;
  /** Vertical anchor (0.0 = topmost, 0.5 = center, 1.0 = bottommost) */
  yCenterNorm?: number;
  /** Zoom / scale multiplier (1.0 = 100%, 2.0 = 200%) */
  scale?: number;
}

/**
 * Manually crop a video to 9:16 vertical format with customizable X/Y positioning and zoom scale.
 * Output is normalized to standard 1080x1920 HD vertical resolution.
 */
export async function cropVerticalManual(opts: CropVerticalManualOptions): Promise<void> {
  const {
    videoPath,
    outputPath,
    xCenterNorm = 0.5,
    yCenterNorm = 0.5,
    scale = 1.0,
  } = opts;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const s = Math.max(1.0, Math.min(3.0, Number(scale) || 1.0));
  const xN = Math.max(0, Math.min(1, Number(xCenterNorm) || 0.5));
  const yN = Math.max(0, Math.min(1, Number(yCenterNorm) || 0.5));

  // 1. Scale input frame if zoom > 1.0
  // 2. Crop to 9:16 box based on scaled height and width
  // 3. Scale output to crisp 1080x1920 for standard vertical shorts/reels
  let filterChain: string;
  if (s > 1.001) {
    filterChain =
      `scale=w=trunc(iw*${s}/2)*2:h=trunc(ih*${s}/2)*2,` +
      `crop=w='min(trunc(ih*9/16/2)*2,trunc(iw/2)*2)':h='min(trunc(ih/2)*2,trunc(iw*16/9/2)*2)':` +
      `x='(in_w-out_w)*${xN}':y='(in_h-out_h)*${yN}',` +
      `scale=1080:1920:flags=bicubic`;
  } else {
    filterChain =
      `crop=w='min(trunc(ih*9/16/2)*2,trunc(iw/2)*2)':h='min(trunc(ih/2)*2,trunc(iw*16/9/2)*2)':` +
      `x='(in_w-out_w)*${xN}':y='(in_h-out_h)*${yN}',` +
      `scale=1080:1920:flags=bicubic`;
  }

  await runFFmpeg([
    '-y',
    '-i', videoPath,
    '-vf', filterChain,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export interface CropVerticalDynamicOptions {
  /** Absolute path to the source clip */
  videoPath: string;
  /** Absolute path for the output vertical clip */
  outputPath: string;
  /** Dynamic FFmpeg crop filter string (e.g. crop=w=...:h=...:x='...':y=0) */
  cropFilter: string;
}

/**
 * Crop a video clip dynamically based on a computed smooth face tracking filter.
 */
export async function cropVerticalDynamic(opts: CropVerticalDynamicOptions): Promise<void> {
  const { videoPath, outputPath, cropFilter } = opts;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await runFFmpeg([
    '-y',
    '-i', videoPath,
    '-vf', cropFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

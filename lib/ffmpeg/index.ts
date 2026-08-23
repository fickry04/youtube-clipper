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
  /** Absolute path to the SRT subtitle file */
  srtPath: string;
  /** Absolute path where the output video with burned subtitles is written */
  outputPath: string;
  /**
   * Optional font size for the subtitles (default: 24).
   */
  fontSize?: number;
}

/**
 * Burn SRT subtitles into a video using the `subtitles` filter.
 * This re-encodes the video with libx264 / aac for maximum compatibility.
 */
export async function burnSubtitle(opts: BurnSubtitleOptions): Promise<void> {
  const { videoPath, srtPath, outputPath, fontSize = 24 } = opts;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // The subtitles filter path must use forward slashes and escape colons on Windows.
  // On Linux/macOS the path is used as-is.
  const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

  await runFFmpeg([
    '-y',
    '-i', videoPath,
    '-vf', `subtitles='${escapedSrt}':force_style='FontSize=${fontSize},Alignment=2,MarginV=20'`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
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

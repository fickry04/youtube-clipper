/**
 * workers/processors/video.processor.ts
 *
 * Downloads the source video from YouTube using yt-dlp (safe spawn, no shell),
 * saves it to local storage, and creates a VideoAsset DB record.
 *
 * After success it enqueues a TRANSCRIPT job.
 */

import { Job } from 'bullmq';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys } from '../../lib/storage';
import type { DownloadVideoPayload } from '../../lib/queue/jobs';

const YTDLP_BIN = process.env.YTDLP_PATH ?? 'yt-dlp';

export async function processVideoDownload(job: Job<DownloadVideoPayload>): Promise<void> {
  const { jobId, videoId, userId, youtubeId, youtubeUrl } = job.data;

  // Mark job as PROCESSING
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  // Update clip processing status
  await job.updateProgress(5);

  // Create a temp directory for the download
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-video-${videoId}-`));
  const tmpFile = path.join(tmpDir, 'source.%(ext)s');

  try {
    // Download best mp4 (video+audio merged) — safe spawn, no shell
    // Using node JS runtime and web_embedded client to bypass 403 Forbidden errors
    const args = [
      '-4',
      // '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--output', tmpFile,
      '--no-playlist',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=web_embedded',
      youtubeUrl,
    ];

    let lastDbUpdate = 0;
    let lastPercent = 0;

    await new Promise<void>((resolve, reject) => {
      let stderrOutput = '';
      const child = spawn(YTDLP_BIN, args, {
        timeout: 10 * 60 * 1000, // 10 min max
      });

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        const lines = chunk.split(/[\r\n]+/);
        for (const line of lines) {
          const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
          if (match) {
            const percent = Math.round(parseFloat(match[1]));
            // Map 0-100% of yt-dlp to 5-90% of job progress
            const jobPercent = Math.min(90, Math.max(5, Math.round(5 + (percent / 100) * 85)));

            const now = Date.now();
            if (jobPercent !== lastPercent && (now - lastDbUpdate > 1000 || jobPercent - lastPercent >= 5)) {
              lastPercent = jobPercent;
              lastDbUpdate = now;
              job.updateProgress(jobPercent).catch(() => { });
              prisma.job.update({
                where: { id: jobId },
                data: { progress: jobPercent },
              }).catch((e) => console.error('Failed to update job progress in DB:', e));
            }
          }
        }
      });

      child.stderr?.on('data', (data) => {
        stderrOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}. Error: ${stderrOutput}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });

    await job.updateProgress(90);
    await prisma.job.update({
      where: { id: jobId },
      data: { progress: 90 },
    });

    // Find the actual downloaded file (yt-dlp replaces %(ext)s)
    const files = await fs.readdir(tmpDir);
    const mp4 = files.find((f) => f.endsWith('.mp4'));
    if (!mp4) {
      throw new Error('yt-dlp finished but no .mp4 file was produced.');
    }
    const downloadedPath = path.join(tmpDir, mp4);

    // Get file info
    const stat = await fs.stat(downloadedPath);

    // Save to storage
    const storage = getStorage();
    const storageKey = StorageKeys.videoSource(userId, videoId);
    await storage.save(storageKey, downloadedPath);

    await job.updateProgress(95);
    await prisma.job.update({
      where: { id: jobId },
      data: { progress: 95 },
    });

    // Create VideoAsset record
    await prisma.videoAsset.create({
      data: {
        type: 'source',
        storagePath: storageKey,
        mimeType: 'video/mp4',
        fileSize: BigInt(stat.size),
        videoId,
      },
    });

    // Mark job complete. Pipeline stops here — the user controls next steps.
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    await job.updateProgress(100);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });
    throw err; // rethrow so BullMQ can retry
  } finally {
    // Clean up temp directory
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * workers/processors/clip.processor.ts
 *
 * For each clip ID in the payload:
 *   1. Loads the clip time range (startSeconds, endSeconds) and parent YouTube URL
 *   2. Downloads ONLY that specific time range directly from YouTube via yt-dlp --download-sections
 *   3. Saves the clip MP4 to storage
 *   4. Creates / updates VideoAsset record
 *   5. Updates Clip processingStatus to COMPLETED
 */

import { Job } from 'bullmq';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys } from '../../lib/storage';
import type { CreateClipsPayload } from '../../lib/queue/jobs';

const YTDLP_BIN = process.env.YTDLP_PATH ?? 'yt-dlp';

async function downloadClipSection(
  youtubeUrl: string,
  startSec: number,
  endSec: number,
  outputPattern: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const args = [
    '-4',
    '--download-sections',
    `*${startSec}-${endSec}`,
    '--force-keyframes-at-cuts',
    '--merge-output-format',
    'mp4',
    '--output',
    outputPattern,
    '--no-playlist',
    '--js-runtimes',
    'node',
    '--newline',
    '--extractor-args',
    'youtube:player_client=web_embedded',
    youtubeUrl,
  ];

  await new Promise<void>((resolve, reject) => {
    let stderrOutput = '';
    const child = spawn(YTDLP_BIN, args, {
      timeout: 5 * 60 * 1000, // 5 minutes max per clip
    });

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (match && onProgress) {
        const pct = parseFloat(match[1]);
        if (!isNaN(pct)) {
          onProgress(pct);
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
}

export async function processClips(job: Job<CreateClipsPayload>): Promise<void> {
  const { jobId, videoId, userId, clipIds } = job.data;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', progress: 5, startedAt: new Date(), attempts: { increment: 1 } },
  });

  await job.updateProgress(5);

  try {
    const storage = getStorage();
    const total = clipIds.length;

    for (let i = 0; i < total; i++) {
      const clipId = clipIds[i];

      // Load clip metadata along with the parent video
      const clip = await prisma.clip.findUnique({
        where: { id: clipId },
        include: {
          viralAnalysis: {
            include: {
              video: {
                select: { id: true, youtubeUrl: true },
              },
            },
          },
        },
      });

      if (!clip) {
        console.warn(`[clip.processor] Clip ${clipId} not found, skipping.`);
        continue;
      }

      const youtubeUrl = clip.viralAnalysis.video.youtubeUrl;
      if (!youtubeUrl) {
        console.warn(`[clip.processor] Clip ${clipId} has no youtubeUrl, skipping.`);
        continue;
      }

      await prisma.clip.update({
        where: { id: clipId },
        data: { processingStatus: 'PROCESSING', processingError: null },
      });

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-clip-sec-${clipId}-`));
      const tmpFile = path.join(tmpDir, 'clip.%(ext)s');

      try {
        let lastReportedPct = 0;
        // Download only the needed section via yt-dlp
        await downloadClipSection(
          youtubeUrl,
          clip.startSeconds,
          clip.endSeconds,
          tmpFile,
          async (clipDownloadPct) => {
            const clipBase = 10 + (i / total) * 80;
            const clipContrib = ((clipDownloadPct / 100) * 0.85) * (80 / total);
            const overallPct = Math.min(92, Math.round(clipBase + clipContrib));

            if (overallPct > lastReportedPct + 1) {
              lastReportedPct = overallPct;
              await job.updateProgress(overallPct);
              await prisma.job.update({
                where: { id: jobId },
                data: { progress: overallPct },
              }).catch(() => {});
            }
          }
        );

        // Find the actual output MP4 file
        const files = await fs.readdir(tmpDir);
        const mp4 = files.find((f) => f.endsWith('.mp4'));
        if (!mp4) {
          throw new Error('yt-dlp finished but no .mp4 file was produced for the clip.');
        }
        const downloadedPath = path.join(tmpDir, mp4);
        const fileStat = await fs.stat(downloadedPath);

        // Save clip to storage
        const clipKey = StorageKeys.clipVideo(userId, clipId);
        await storage.save(clipKey, downloadedPath);

        // Upsert VideoAsset
        const existingAsset = await prisma.videoAsset.findUnique({
          where: { clipId },
        });

        if (existingAsset) {
          await prisma.videoAsset.update({
            where: { id: existingAsset.id },
            data: {
              storagePath: clipKey,
              mimeType: 'video/mp4',
              fileSize: BigInt(fileStat.size),
              duration: clip.durationSeconds,
            },
          });
        } else {
          await prisma.videoAsset.create({
            data: {
              type: 'clip',
              storagePath: clipKey,
              mimeType: 'video/mp4',
              fileSize: BigInt(fileStat.size),
              duration: clip.durationSeconds,
              videoId,
              clipId,
            },
          });
        }

        await prisma.clip.update({
          where: { id: clipId },
          data: { processingStatus: 'COMPLETED', processingError: null },
        });
      } catch (clipErr) {
        const message = clipErr instanceof Error ? clipErr.message : String(clipErr);
        await prisma.clip.update({
          where: { id: clipId },
          data: { processingStatus: 'FAILED', processingError: message },
        });
        console.error(`[clip.processor] Failed to process clip ${clipId}: ${message}`);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }

      // Report progress (10% → 95% across clips)
      const progress = Math.round(10 + ((i + 1) / total) * 85);
      await job.updateProgress(progress);
      await prisma.job.update({
        where: { id: jobId },
        data: { progress },
      });
    }

    // Mark job complete
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
    throw err;
  }
}

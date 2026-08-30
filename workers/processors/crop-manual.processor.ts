/**
 * workers/processors/manual-crop.processor.ts
 *
 * For a given clip:
 *   1. Load the original clip video file
 *   2. Perform direct 9:16 manual crop using provided coordinates and scale
 *   3. Render the vertical video using FFmpeg
 *   4. Save the result to storage
 *   5. Update job status in database
 */

import { Job } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '../../lib/storage';
import { cropVerticalManual } from '../../lib/ffmpeg';
import type { ManualCropPayload } from '../../lib/queue/jobs';
import { setJobProgress } from '..';

export async function processManualCrop(job: Job<ManualCropPayload>): Promise<void> {
  const { jobId, userId, clipId, xCenterNorm, yCenterNorm, scale } = job.data;

  // 1. Mark job as processing
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', progress: 5, startedAt: new Date(), attempts: { increment: 1 } },
  });

  await setJobProgress(jobId, job, 5);

  try {
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { asset: true },
    });

    if (!clip) throw new Error(`Clip ${clipId} not found.`);

    const storage = getStorage();
    const clipKey = StorageKeys.clipVideo(userId, clipId);

    const exists = await storage.exists(clipKey);
    if (!exists) {
      throw new Error(`Clip video file not found in storage: ${clipKey}`);
    }

    let clipVideoPath: string;
    if (storage instanceof LocalStorageService) {
      clipVideoPath = storage.getAbsolutePath(clipKey);
    } else {
      clipVideoPath = await storage.get(clipKey);
    }

    await setJobProgress(jobId, job, 15);

    // 2. Setup temporary directory for FFmpeg output
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-manual-crop-${clipId}-`));
    const croppedTmp = path.join(tmpDir, 'clip_vertical.mp4');

    console.log(`[manual-crop.processor] Processing manual crop for clip ${clipId}...`);

    try {
      // 3. Execute FFmpeg crop
      await cropVerticalManual({
        videoPath: clipVideoPath,
        outputPath: croppedTmp,
        xCenterNorm,
        yCenterNorm,
        scale,
      });

      await setJobProgress(jobId, job, 75);

      // 4. Save the 9:16 vertical video into storage
      const verticalKey = StorageKeys.clipVertical(userId, clipId);
      await storage.save(verticalKey, croppedTmp);

      await setJobProgress(jobId, job, 90);

    } finally {
      // 5. Cleanup temporary files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
    }

    // 6. Mark job as completed
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    await job.updateProgress(100);
    console.log(`[manual-crop.processor] ✓ Successfully created 9:16 manual vertical clip for ${clipId}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[manual-crop.processor] ✗ Failed to process manual crop:`, message);

    // Mark job as failed
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });
    throw err;
  }
}
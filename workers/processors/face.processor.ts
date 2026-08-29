/**
 * workers/processors/face.processor.ts
 *
 * For a given clip:
 *   1. Load the original clip video file
 *   2. Run face detection and landmark analysis across video frames
 *   3. Identify active speaker with multi-face support & lip motion dynamics
 *   4. Compute a cinematic, smooth, jitter-free 9:16 vertical crop trajectory
 *   5. Save detection records to FaceDetection table
 *   6. Render dynamic 9:16 vertical video using FFmpeg and save to storage
 */

import { Job } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '../../lib/storage';
import { cropVerticalDynamic } from '../../lib/ffmpeg';
import { detectFacesInVideo, computeSmoothCropTrajectory } from '../../lib/face/face-tracker';
import type { FaceDetectionPayload } from '../../lib/queue/jobs';

async function setFaceProgress(jobId: string, job: Job<FaceDetectionPayload>, progress: number) {
  await job.updateProgress(progress);
  await prisma.job.update({
    where: { id: jobId },
    data: { progress },
  }).catch(() => { });
}

export async function processFaceDetection(job: Job<FaceDetectionPayload>): Promise<void> {
  const { jobId, userId, clipId } = job.data;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', progress: 5, startedAt: new Date(), attempts: { increment: 1 } },
  });

  await setFaceProgress(jobId, job, 5);

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

    await setFaceProgress(jobId, job, 15);

    // 1. Detect faces and landmarks across video frames
    console.log(`[face.processor] Analyzing faces and active speakers for clip ${clipId}...`);
    const { frames, videoInfo } = await detectFacesInVideo(
      clipVideoPath,
      2,
      async (processed, total) => {
        if (processed % 5 === 0 || processed === total) {
          const progress = 15 + Math.round((processed / total) * 35);
          await setFaceProgress(jobId, job, progress);
        }
      }
    );

    await setFaceProgress(jobId, job, 50);

    // 2. Compute smooth active-speaker framing trajectory
    const { cropFilter } = computeSmoothCropTrajectory(frames, videoInfo);

    await setFaceProgress(jobId, job, 60);

    // 3. Render 9:16 vertical crop with FFmpeg
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-face-crop-${clipId}-`));
    const croppedTmp = path.join(tmpDir, 'clip_vertical.mp4');

    // 4. Update hasFaceDetection
    await prisma.clip.update({
      where: { id: clipId },
      data: { hasFaceDetection: true },
    });
    await setFaceProgress(jobId, job, 75);

    try {
      await cropVerticalDynamic({
        videoPath: clipVideoPath,
        outputPath: croppedTmp,
        cropFilter,
      });

      await setFaceProgress(jobId, job, 90);

      // 4. Save 9:16 vertical video to storage
      const verticalKey = StorageKeys.clipVertical(userId, clipId);
      await storage.save(verticalKey, croppedTmp);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
    }

    // 5. Mark job complete
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    await job.updateProgress(100);
    console.log(`[face.processor] ✓ Successfully created 9:16 vertical clip for ${clipId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[face.processor] ✗ Failed to process face detection:`, message);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });
    throw err;
  }
}

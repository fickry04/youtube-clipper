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

export async function processFaceDetection(job: Job<FaceDetectionPayload>): Promise<void> {
  const { jobId, userId, clipId } = job.data;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  await job.updateProgress(5);

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

    await job.updateProgress(15);

    // 1. Detect faces and landmarks across video frames
    console.log(`[face.processor] Analyzing faces and active speakers for clip ${clipId}...`);
    const { frames, videoInfo } = await detectFacesInVideo(
      clipVideoPath,
      2,
      async (processed, total) => {
        if (processed % 5 === 0 || processed === total) {
          const progress = 15 + Math.round((processed / total) * 35);
          await job.updateProgress(progress);
        }
      }
    );

    await job.updateProgress(50);

    // 2. Compute smooth active-speaker framing trajectory
    const { cropFilter, detections } = computeSmoothCropTrajectory(frames, videoInfo);

    // console.log(`[face.processor] Computed crop filter: ${cropFilter}`);

    await job.updateProgress(65);

    // 3. Persist face detection points to database
    if (detections.length > 0) {
      await prisma.faceDetection.deleteMany({ where: { clipId } });
      await prisma.faceDetection.createMany({
        data: detections.map((d) => ({
          clipId,
          timestamp: d.timestamp,
          x: d.x,
          y: d.y,
          width: d.width,
          height: d.height,
          confidence: d.confidence,
        })),
      });
    }

    await job.updateProgress(75);

    // 4. Render 9:16 vertical crop with FFmpeg
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-face-crop-${clipId}-`));
    const croppedTmp = path.join(tmpDir, 'clip_vertical.mp4');

    try {
      await cropVerticalDynamic({
        videoPath: clipVideoPath,
        outputPath: croppedTmp,
        cropFilter,
      });

      await job.updateProgress(90);

      // 5. Save 9:16 vertical video to storage
      const verticalKey = StorageKeys.clipVertical(userId, clipId);
      await storage.save(verticalKey, croppedTmp);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
    }

    // 6. Mark job complete
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

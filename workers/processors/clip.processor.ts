/**
 * workers/processors/clip.processor.ts
 *
 * For each clip ID in the payload:
 *   1. Resolves the source video path from storage
 *   2. Calls FFmpeg to cut the segment
 *   3. Saves the clip to storage
 *   4. Creates / updates VideoAsset record
 *   5. Updates Clip processingStatus
 *
 * After all clips are cut, enqueues a GENERATE_SUBTITLE job for each.
 */

import { Job } from 'bullmq';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '../../lib/storage';
import { cutVideo } from '../../lib/ffmpeg';
import type { CreateClipsPayload } from '../../lib/queue/jobs';

export async function processClips(job: Job<CreateClipsPayload>): Promise<void> {
  const { jobId, videoId, userId, clipIds } = job.data;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  await job.updateProgress(5);

  try {
    // Locate source video in storage
    const storage = getStorage();
    const sourceKey = StorageKeys.videoSource(userId, videoId);
    const sourcePath = await storage.get(sourceKey);

    const total = clipIds.length;

    for (let i = 0; i < total; i++) {
      const clipId = clipIds[i];

      // Load clip metadata
      const clip = await prisma.clip.findUnique({ where: { id: clipId } });
      if (!clip) {
        console.warn(`[clip.processor] Clip ${clipId} not found, skipping.`);
        continue;
      }

      await prisma.clip.update({
        where: { id: clipId },
        data: { processingStatus: 'PROCESSING' },
      });

      const clipKey = StorageKeys.clipVideo(userId, clipId);

      // Resolve absolute output path (local storage only)
      let outputPath: string;
      if (storage instanceof LocalStorageService) {
        outputPath = storage.getAbsolutePath(clipKey);
      } else {
        // For remote storage, we write to a temp path and then upload
        const { mkdtemp } = await import('fs/promises');
        const { join } = await import('path');
        const os = await import('os');
        const tmpDir = await mkdtemp(join(os.tmpdir(), `vc-clip-${clipId}-`));
        outputPath = join(tmpDir, 'clip.mp4');
      }

      try {
        await cutVideo({
          sourcePath,
          startSeconds: clip.startSeconds,
          endSeconds: clip.endSeconds,
          outputPath,
        });

        // If remote storage, upload from tmp
        if (!(storage instanceof LocalStorageService)) {
          await storage.save(clipKey, outputPath);
          const { rm } = await import('fs/promises');
          await rm(outputPath, { force: true });
        }

        // Get file size
        const { stat } = await import('fs/promises');
        const fileStat = await stat(outputPath).catch(() => null);

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
              fileSize: fileStat ? BigInt(fileStat.size) : undefined,
              duration: clip.durationSeconds,
            },
          });
        } else {
          await prisma.videoAsset.create({
            data: {
              type: 'clip',
              storagePath: clipKey,
              mimeType: 'video/mp4',
              fileSize: fileStat ? BigInt(fileStat.size) : undefined,
              duration: clip.durationSeconds,
              videoId,
              clipId,
            },
          });
        }

        await prisma.clip.update({
          where: { id: clipId },
          data: { processingStatus: 'COMPLETED' },
        });
      } catch (clipErr) {
        const message = clipErr instanceof Error ? clipErr.message : String(clipErr);
        await prisma.clip.update({
          where: { id: clipId },
          data: { processingStatus: 'FAILED', processingError: message },
        });
        console.error(`[clip.processor] Failed to process clip ${clipId}: ${message}`);
      }

      // Report progress (10% → 90% across clips)
      const progress = Math.round(10 + ((i + 1) / total) * 80);
      await job.updateProgress(progress);
      await prisma.job.update({
        where: { id: jobId },
        data: { progress },
      });
    }

    // Mark job complete. Pipeline stops here — the user triggers subtitle generation manually.
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

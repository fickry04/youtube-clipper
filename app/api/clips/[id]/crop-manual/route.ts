/**
 * POST /api/clips/[id]/crop-manual — perform direct 9:16 manual crop without AI face tracker
 */

import type { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '@/lib/storage';
import { cropVerticalManual } from '@/lib/ffmpeg';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const { id: clipId } = await params;

  const clip = await prisma.clip.findFirst({
    where: {
      id: clipId,
      viralAnalysis: {
        video: { project: { userId: session.user.id } },
      },
    },
    include: {
      viralAnalysis: { select: { videoId: true } },
      asset: { select: { id: true } },
    },
  });

  if (!clip) {
    return Response.json(
      { success: false, error: 'Clip tidak ditemukan atau akses ditolak.' },
      { status: 404 }
    );
  }

  if (!clip.asset) {
    return Response.json(
      { success: false, error: 'Video klip belum diunduh. Silakan unduh klip terlebih dahulu.' },
      { status: 422 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Support either 0.0-1.0 or 0-100% ranges
    let xCenterNorm = typeof body.xCenterNorm === 'number' ? body.xCenterNorm : (typeof body.xCenter === 'number' ? body.xCenter : 0.5);
    if (xCenterNorm > 1.0) xCenterNorm = xCenterNorm / 100;
    xCenterNorm = Math.max(0, Math.min(1, xCenterNorm));

    let yCenterNorm = typeof body.yCenterNorm === 'number' ? body.yCenterNorm : (typeof body.yCenter === 'number' ? body.yCenter : 0.5);
    if (yCenterNorm > 1.0) yCenterNorm = yCenterNorm / 100;
    yCenterNorm = Math.max(0, Math.min(1, yCenterNorm));

    const scale = typeof body.scale === 'number' ? Math.max(1.0, Math.min(3.0, body.scale)) : 1.0;

    const storage = getStorage();
    const clipKey = StorageKeys.clipVideo(session.user.id, clipId);
    const exists = await storage.exists(clipKey);
    if (!exists) {
      return Response.json(
        { success: false, error: 'File video asli klip tidak ditemukan di storage.' },
        { status: 404 }
      );
    }

    let clipVideoPath: string;
    if (storage instanceof LocalStorageService) {
      clipVideoPath = storage.getAbsolutePath(clipKey);
    } else {
      clipVideoPath = await storage.get(clipKey);
    }

    // Process FFmpeg crop in a temporary directory
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-manual-crop-${clipId}-`));
    const croppedTmp = path.join(tmpDir, 'clip_vertical.mp4');

    // Create a job record
    const videoId = clip.viralAnalysis.videoId;
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId: videoId,
        type: 'MANUAL_CROP',
        status: 'PROCESSING',
        startedAt: new Date(),
        progress: 15
      },
    });

    try {
      await cropVerticalManual({
        videoPath: clipVideoPath,
        outputPath: croppedTmp,
        xCenterNorm,
        yCenterNorm,
        scale,
      });

      // Save the 9:16 vertical video into storage
      const verticalKey = StorageKeys.clipVertical(session.user.id, clipId);
      await storage.save(verticalKey, croppedTmp);

      // Mark job as completed
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed.';

      // Mark job as failed
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: message, completedAt: new Date() },
      });
    }
    finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
    }

    return Response.json({
      success: true,
      clipId,
      xCenterNorm,
      yCenterNorm,
      scale,
      message: 'Video vertikal 9:16 manual berhasil dibuat.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses manual crop.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

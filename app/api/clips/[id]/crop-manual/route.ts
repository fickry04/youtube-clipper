/**
 * POST /api/clips/[id]/crop-manual — Enqueue direct 9:16 manual crop without AI face tracker
 */

import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import type { ManualCropPayload } from '@/lib/queue/jobs';

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

  // 1. Validate clip existence and ownership
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
    // 2. Parse and validate body input
    const body = await request.json().catch(() => ({}));

    let xCenterNorm = typeof body.xCenterNorm === 'number' ? body.xCenterNorm : (typeof body.xCenter === 'number' ? body.xCenter : 0.5);
    if (xCenterNorm > 1.0) xCenterNorm = xCenterNorm / 100;
    xCenterNorm = Math.max(0, Math.min(1, xCenterNorm));

    let yCenterNorm = typeof body.yCenterNorm === 'number' ? body.yCenterNorm : (typeof body.yCenter === 'number' ? body.yCenter : 0.5);
    if (yCenterNorm > 1.0) yCenterNorm = yCenterNorm / 100;
    yCenterNorm = Math.max(0, Math.min(1, yCenterNorm));

    const scale = typeof body.scale === 'number' ? Math.max(1.0, Math.min(3.0, body.scale)) : 1.0;

    const videoId = clip.viralAnalysis.videoId;

    // 3. Create job record in database
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId: videoId,
        type: 'MANUAL_CROP',
        status: 'QUEUED',
        payload: { clipId, xCenterNorm, yCenterNorm, scale },
      },
    });

    // 4. Enqueue job to BullMQ
    await getQueue(QUEUE_NAMES.MANUAL_CROP).add(
      'manual-crop',
      {
        jobId: job.id,
        userId: session.user.id,
        clipId,
        xCenterNorm,
        yCenterNorm,
        scale,
      } satisfies ManualCropPayload,
      { jobId: job.id }
    );

    return Response.json({
      success: true,
      jobId: job.id,
      message: 'Manual crop job berhasil diantrekan.',
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memulai manual crop.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
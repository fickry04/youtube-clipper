/**
 * POST /api/clips/[id]/crop  — enqueue face detection & vertical crop worker job
 * GET  /api/clips/[id]/crop  — check vertical crop status and availability
 */

import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import { getStorage, StorageKeys } from '@/lib/storage';
import type { FaceDetectionPayload } from '@/lib/queue/jobs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const { id: clipId } = await params;

  try {
    const clip = await prisma.clip.findFirst({
      where: {
        id: clipId,
        viralAnalysis: {
          video: { project: { userId: session.user.id } },
        },
      },
    });

    if (!clip) {
      return Response.json(
        { success: false, error: 'Clip not found or access denied.' },
        { status: 404 }
      );
    }

    const storage = getStorage();
    const verticalKey = StorageKeys.clipVertical(session.user.id, clipId);
    const hasVertical = await storage.exists(verticalKey);

    return Response.json({
      success: true,
      clipId,
      hasVertical,
      hasFaceDetections: clip.hasFaceDetection,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get crop status.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
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
      { success: false, error: 'Clip not found or access denied.' },
      { status: 404 }
    );
  }

  if (!clip.asset) {
    return Response.json(
      { success: false, error: 'Clip video is not yet downloaded. Cut the clip first.' },
      { status: 422 }
    );
  }

  try {
    const videoId = clip.viralAnalysis.videoId;

    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId: videoId,
        type: 'FACE_DETECTION',
        status: 'QUEUED',
        payload: { clipId },
      },
    });

    await getQueue(QUEUE_NAMES.FACE_DETECTION).add(
      'face-detection',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        clipId,
      } satisfies FaceDetectionPayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue face crop job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

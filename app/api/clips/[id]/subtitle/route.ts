/**
 * GET  /api/clips/[id]/subtitle  — fetch existing SRT subtitle content
 * POST /api/clips/[id]/subtitle  — enqueue subtitle generation worker job
 *
 * Ownership chain: clip → viralAnalysis → video → project → user
 */

import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import type { GenerateSubtitlePayload } from '@/lib/queue/jobs';

export async function GET(
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
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'srt';

  try {
    // Ownership check
    const clip = await db.clip.findFirst({
      where: {
        id: clipId,
        viralAnalysis: {
          video: { project: { userId: session.user.id } },
        },
      },
      select: { id: true },
    });

    if (!clip) {
      return Response.json(
        { success: false, error: 'Clip not found or access denied.' },
        { status: 404 }
      );
    }

    const subtitle = await db.subtitle.findUnique({
      where: { clipId_format: { clipId, format } },
    });

    if (!subtitle) {
      return Response.json(
        { success: false, error: `No subtitle in format "${format}" found for this clip.` },
        { status: 404 }
      );
    }

    if (format === 'srt') {
      // Return raw SRT as text/plain for direct use by video players
      return new Response(subtitle.content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    return Response.json({
      success: true,
      clipId,
      format: subtitle.format,
      content: subtitle.content,
      createdAt: subtitle.createdAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subtitle.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — enqueue subtitle generation worker job
// ---------------------------------------------------------------------------

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

  const clip = await db.clip.findFirst({
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
      { success: false, error: 'Clip has no video asset yet. Cut the clip first.' },
      { status: 422 }
    );
  }

  try {
    const videoId = clip.viralAnalysis.videoId;

    const job = await db.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'GENERATE_SUBTITLE',
        status: 'QUEUED',
        payload: { clipId },
      },
    });

    await getQueue(QUEUE_NAMES.SUBTITLE).add(
      'subtitle',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        clipId,
      } satisfies GenerateSubtitlePayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue subtitle job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

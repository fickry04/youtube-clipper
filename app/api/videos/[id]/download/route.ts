/**
 * POST /api/videos/[id]/download
 *
 * Enqueues a DOWNLOAD_VIDEO worker job for the given video.
 * Requires the video to not already have a source asset.
 */

import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import type { DownloadVideoPayload } from '@/lib/queue/jobs';

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

  const { id: videoId } = await params;

  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    include: {
      assets: { where: { type: 'source' }, take: 1 },
    },
  });

  if (!video) {
    return Response.json(
      { success: false, error: 'Video not found or access denied.' },
      { status: 404 }
    );
  }

  if (video.assets.length > 0) {
    return Response.json(
      { success: false, error: 'Video source already downloaded.' },
      { status: 409 }
    );
  }

  try {
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'DOWNLOAD_VIDEO',
        status: 'QUEUED',
        payload: { youtubeId: video.youtubeId, youtubeUrl: video.youtubeUrl },
      },
    });

    await getQueue(QUEUE_NAMES.VIDEO).add(
      'download',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        youtubeId: video.youtubeId,
        youtubeUrl: video.youtubeUrl,
      } satisfies DownloadVideoPayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue download.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

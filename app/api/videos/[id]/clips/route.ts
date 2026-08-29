import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import type { CreateClipsPayload } from '@/lib/queue/jobs';

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

  const { id: videoId } = await params;

  // Verify ownership
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    select: { id: true },
  });

  if (!video) {
    return Response.json(
      { success: false, error: 'Video not found or access denied.' },
      { status: 404 }
    );
  }

  try {
    const viralAnalysis = await prisma.viralAnalysis.findUnique({
      where: { videoId },
      include: {
        clips: {
          orderBy: { rank: 'asc' },
          include: {
            asset: {
              select: {
                type: true,
                storagePath: true,
                mimeType: true,
                duration: true,
                width: true,
                height: true,
              },
            },
          },
        },
      },
    });

    if (!viralAnalysis) {
      return Response.json(
        { success: false, error: 'No viral analysis found for this video.' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, viralAnalysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch clips.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — enqueue the clip-cutting worker job (downloads time slices via yt-dlp)
// ---------------------------------------------------------------------------

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

  const { id: videoId } = await params;
  let body: { clipId?: string; clipIds?: string[] } = {};

  try {
    body = JSON.parse(await request.json());
  } catch {
    // Ignore invalid JSON if body wasn't JSON
  }

  console.log(body)

  // Ownership + guard checks
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    include: {
      viralAnalysis: {
        include: { clips: { select: { id: true } } },
      },
    },
  });

  if (!video) {
    return Response.json(
      { success: false, error: 'Video not found or access denied.' },
      { status: 404 }
    );
  }

  if (!video.viralAnalysis || video.viralAnalysis.clips.length === 0) {
    return Response.json(
      { success: false, error: 'No viral analysis found. Run analysis first.' },
      { status: 422 }
    );
  }

  const validClipIds = new Set(video.viralAnalysis.clips.map((c) => c.id));
  let targetClipIds: string[] = [];

  if (body.clipId) {
    if (!validClipIds.has(body.clipId)) {
      return Response.json(
        { success: false, error: `Clip ${body.clipId} not found in this video.` },
        { status: 404 }
      );
    }
    targetClipIds = [body.clipId];
  } else if (Array.isArray(body.clipIds) && body.clipIds.length > 0) {
    targetClipIds = body.clipIds.filter((id) => validClipIds.has(id));
    if (targetClipIds.length === 0) {
      return Response.json(
        { success: false, error: 'None of the provided clip IDs belong to this video.' },
        { status: 400 }
      );
    }
  } else {
    targetClipIds = video.viralAnalysis.clips.map((c) => c.id);
  }

  try {
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'CREATE_CLIPS',
        status: 'QUEUED',
        payload: { viralAnalysisId: video.viralAnalysis.id, clipIds: targetClipIds },
      },
    });

    await getQueue(QUEUE_NAMES.CLIP).add(
      'clip',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        viralAnalysisId: video.viralAnalysis.id,
        clipIds: targetClipIds,
      } satisfies CreateClipsPayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id, clipIds: targetClipIds }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue clip job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

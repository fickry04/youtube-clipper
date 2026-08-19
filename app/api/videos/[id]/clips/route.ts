import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
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
  const video = await db.video.findFirst({
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
    const viralAnalysis = await db.viralAnalysis.findUnique({
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
// POST — enqueue the FFmpeg clip-cutting worker job
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

  const { id: videoId } = await params;

  // Ownership + guard checks
  const video = await db.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    include: {
      assets: { where: { type: 'source' }, take: 1 },
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

  if (video.assets.length === 0) {
    return Response.json(
      { success: false, error: 'Video source not downloaded yet. Run the download step first.' },
      { status: 422 }
    );
  }

  if (!video.viralAnalysis || video.viralAnalysis.clips.length === 0) {
    return Response.json(
      { success: false, error: 'No viral analysis found. Run analysis first.' },
      { status: 422 }
    );
  }

  try {
    const clipIds = video.viralAnalysis.clips.map((c) => c.id);

    const job = await db.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'CREATE_CLIPS',
        status: 'QUEUED',
        payload: { viralAnalysisId: video.viralAnalysis.id, clipIds },
      },
    });

    await getQueue(QUEUE_NAMES.CLIP).add(
      'clip',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        viralAnalysisId: video.viralAnalysis.id,
        clipIds,
      } satisfies CreateClipsPayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue clip job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

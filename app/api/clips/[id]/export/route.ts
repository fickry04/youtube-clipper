import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getStorage, StorageKeys } from '@/lib/storage';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import type { ExportVideoPayload } from '@/lib/queue/jobs';
import type { CaptionCue, SubtitleStyleConfig } from '@/remotion/types';


// ---------------------------------------------------------------------------
// POST — enqueue export remotion worker job
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

  const { id: clipId } = await params;

  let aspectRatio: '16:9' | '9:16' | 'all' = '9:16';
  let styleConfig: SubtitleStyleConfig | undefined = undefined;
  let cues: CaptionCue[] | undefined = undefined;
  try {
    const body = await request.json();
    if (body.aspectRatio) aspectRatio = body.aspectRatio;
    if (body.styleConfig) styleConfig = body.styleConfig;
    if (Array.isArray(body.cues) && body.cues.length > 0) cues = body.cues;
  } catch {
    // Ignore JSON parsing errors and use default
  }

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
      { success: false, error: 'Klip belum memiliki video asset. Silakan download klip terlebih dahulu.' },
      { status: 422 }
    );
  }

  const storage = getStorage();
  const verticalKey = StorageKeys.clipVertical(session.user.id, clipId);
  const hasVertical = await storage.exists(verticalKey);
  if (!hasVertical) {
    return Response.json(
      { success: false, error: 'Video vertikal 9:16 belum dibuat. Lakukan Auto-Crop 9:16 (Face AI) terlebih dahulu.' },
      { status: 422 }
    );
  }

  try {
    const videoId = clip.viralAnalysis.videoId;

    if (cues && cues.length > 0 && styleConfig) {
      await prisma.subtitle.upsert({
        where: { clipId_format: { clipId, format: 'json' } },
        update: {
          content: JSON.stringify({ cues, styleConfig, updatedAt: new Date().toISOString() }),
          updatedAt: new Date(),
        },
        create: {
          clipId,
          format: 'json',
          content: JSON.stringify({ cues, styleConfig, updatedAt: new Date().toISOString() }),
        },
      }).catch(() => { });
    }

    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'EXPORT_VIDEO',
        status: 'QUEUED',
        payload: JSON.stringify({ clipId, aspectRatio, cues, styleConfig }),
      },
    });

    await getQueue(QUEUE_NAMES.EXPORT_VIDEO).add(
      'export-video',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        clipId,
        aspectRatio,
        cues,
        styleConfig,
      } satisfies ExportVideoPayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue subtitle job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

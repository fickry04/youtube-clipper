import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import { parseTranscriptSegments, formatTimestamp } from '@/lib/utils';
import type { ViralAnalysisPayload } from '@/lib/queue/jobs';

const MAX_TRANSCRIPT_BYTES = 2_000_000;

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

  // 1. Verify ownership
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    include: {
      transcript: true,
    },
  });

  if (!video) {
    return Response.json({ success: false, error: 'Video not found or access denied.' }, { status: 404 });
  }

  // 2. Validate transcript existence
  const segments = parseTranscriptSegments(video.transcript?.segments);
  if (!video.transcript || segments.length === 0) {
    return Response.json({ success: false, error: 'No transcript available. Fetch the transcript first.' }, { status: 422 });
  }

  // 3. Validate transcript size
  const transcriptStr = segments
    .map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`)
    .join('\n');

  const byteLength = Buffer.byteLength(transcriptStr, 'utf8');
  if (byteLength > MAX_TRANSCRIPT_BYTES) {
    return Response.json({ success: false, error: `Transcript too large (${Math.round(byteLength / 1024)} KB).` }, { status: 400 });
  }

  try {
    // 4. Create a job record in database
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'VIRAL_ANALYSIS',
        status: 'QUEUED',
      },
    });

    // 5. Enqueue job to BullMQ
    await getQueue(QUEUE_NAMES.VIRAL_ANALYSIS).add(
      'viral-analysis',
      {
        jobId: job.id,
        userId: session.user.id,
        videoId,
      } satisfies ViralAnalysisPayload,
      { jobId: job.id }
    );

    return Response.json({
      success: true,
      jobId: job.id,
      message: 'Viral analysis job successfully queued.'
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue viral analysis job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
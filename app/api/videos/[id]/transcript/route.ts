import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { fetchTranscript } from 'youtube-transcript-plus';
import { decodeHtmlEntities } from '@/lib/utils';
import type { TranscriptSegment } from '@/lib/types';

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

  const { id: videoId } = await params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') ?? undefined;

  // Verify ownership
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    include: {
      transcript: true,
    },
  });

  if (!video) {
    return Response.json(
      { success: false, error: 'Video not found or access denied.' },
      { status: 404 }
    );
  }

  // Return cached transcript from DB if available
  if (video.transcript && !lang) {
    const cachedSegments = (video.transcript.segments as unknown as TranscriptSegment[]) ?? [];
    return Response.json({
      success: true,
      source: 'database',
      videoId,
      languageCode: video.transcript.languageCode,
      segments: cachedSegments,
    });
  }

  // Fetch fresh transcript from YouTube
  try {
    const rawSegments = await fetchTranscript(video.youtubeId, {
      ...(lang && { lang }),
    });

    if (!rawSegments || rawSegments.length === 0) {
      return Response.json(
        { success: false, error: 'No transcript found for this video.' },
        { status: 404 }
      );
    }

    const segments: TranscriptSegment[] = rawSegments.map((s) => ({
      text: decodeHtmlEntities(s.text),
      offset: s.offset,
      duration: s.duration,
      lang: s.lang ?? null,
    }));

    // Persist to DB (upsert transcript in 1 row)
    await prisma.transcript.upsert({
      where: { videoId },
      update: {
        languageCode: lang ?? 'default',
        segments: segments as any,
        updatedAt: new Date(),
      },
      create: {
        videoId,
        languageCode: lang ?? 'default',
        segments: segments as any,
      },
    });

    return Response.json({
      success: true,
      source: 'youtube',
      videoId,
      languageCode: lang ?? 'default',
      segments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

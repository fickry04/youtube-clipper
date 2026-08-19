import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { listLanguages } from 'youtube-transcript-plus';
import type { ListLanguagesResponse, ErrorResponse } from '@/lib/types';

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

  // Verify ownership & get youtubeId
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId: session.user.id } },
    select: { youtubeId: true },
  });

  if (!video) {
    return Response.json(
      { success: false, error: 'Video not found or access denied.' } satisfies ErrorResponse,
      { status: 404 }
    );
  }

  try {
    const languages = await listLanguages(video.youtubeId);

    if (!languages || languages.length === 0) {
      return Response.json(
        { success: false, error: 'No captions or transcripts are available for this video.' } satisfies ErrorResponse,
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      videoId,
      languages,
    } satisfies ListLanguagesResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch available languages.';
    return Response.json(
      { success: false, error: message } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}

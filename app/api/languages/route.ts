import { listLanguages } from 'youtube-transcript-plus';
import type { NextRequest } from 'next/server';
import { extractVideoId } from '@/lib/utils';
import type { ListLanguagesResponse, ErrorResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json(
      { success: false, error: 'Missing "url" query parameter.' } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return Response.json(
      { success: false, error: 'Could not extract a valid YouTube video ID from the provided URL.' } satisfies ErrorResponse,
      { status: 400 }
    );
  }

  try {
    const languages = await listLanguages(videoId);

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

import { fetchTranscript } from 'youtube-transcript-plus';
import type { NextRequest } from 'next/server';
import { extractVideoId, decodeHtmlEntities } from '@/lib/utils';
import type { FetchTranscriptResponse, ErrorResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const lang = searchParams.get('lang') ?? undefined;

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
    const segments = await fetchTranscript(videoId, {
      ...(lang && { lang }),
    });

    if (!segments || segments.length === 0) {
      return Response.json(
        { success: false, error: 'No transcript segments found for this video and language.' } satisfies ErrorResponse,
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      videoId,
      languageCode: lang ?? 'default',
      segments: segments.map((s) => ({ ...s, text: decodeHtmlEntities(s.text) })),
    } satisfies FetchTranscriptResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript.';
    return Response.json(
      { success: false, error: message } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}

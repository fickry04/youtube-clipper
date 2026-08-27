import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { parseTranscriptSegments } from '@/lib/utils';
import {
  generatePlatformCaptions,
  parseCachedCaptions,
} from '@/lib/social/captions';

const TRANSCRIPT_EXCERPT_CHARS = 1200;

/**
 * GET /api/clips/[id]/social-captions
 * Returns the cached per-platform captions for a clip (or null when none exist yet).
 */
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

  const { id: clipId } = await params;

  try {
    // Ownership chain: clip → viralAnalysis → video → project → user
    const clip = await prisma.clip.findFirst({
      where: {
        id: clipId,
        viralAnalysis: { video: { project: { userId: session.user.id } } },
      },
      select: { socialCaptions: true },
    });

    if (!clip) {
      return Response.json(
        { success: false, error: 'Clip not found or access denied.' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, captions: parseCachedCaptions(clip.socialCaptions) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load social captions.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/clips/[id]/social-captions
 * Generates fresh per-platform captions via Gemini and caches them on the clip.
 */
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

  try {
    const clip = await prisma.clip.findFirst({
      where: {
        id: clipId,
        viralAnalysis: { video: { project: { userId: session.user.id } } },
      },
      include: {
        viralAnalysis: {
          include: { video: { include: { transcript: true } } },
        },
      },
    });

    if (!clip) {
      return Response.json(
        { success: false, error: 'Clip not found or access denied.' },
        { status: 404 }
      );
    }

    const segments = parseTranscriptSegments(clip.viralAnalysis.video.transcript?.segments);
    const excerptSource = segments.length
      ? segments.map((s) => s.text).join(' ')
      : `${clip.summary} ${clip.whyViral}`;

    const captions = await generatePlatformCaptions({
      clipTitle: clip.title,
      hook: clip.hook,
      summary: clip.summary,
      whyViral: clip.whyViral,
      categories: clip.category,
      durationSeconds: clip.durationSeconds,
      videoTitle: clip.viralAnalysis.video.title,
      transcriptExcerpt: excerptSource.slice(0, TRANSCRIPT_EXCERPT_CHARS),
    });

    const cached = { generatedAt: new Date().toISOString(), captions };
    await prisma.clip.update({
      where: { id: clip.id },
      data: { socialCaptions: cached },
    });

    return Response.json({ success: true, captions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate social captions.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

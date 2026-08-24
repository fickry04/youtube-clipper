import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';

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
    const clip = await db.clip.findFirst({
      where: {
        id: clipId,
        viralAnalysis: {
          video: {
            project: { userId: session.user.id },
          },
        },
      },
      include: {
        viralAnalysis: {
          select: {
            id: true,
            videoId: true,
            overallSummary: true,
          },
        },
        asset: true,
        subtitles: { select: { format: true, createdAt: true } },
        faceDetections: {
          orderBy: { timestamp: 'asc' },
          take: 50,
        },
      },
    });

    if (!clip) {
      return Response.json(
        { success: false, error: 'Clip not found or access denied.' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, clip });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch clip.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

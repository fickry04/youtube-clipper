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

  const { id } = await params;

  try {
    // Ownership check: video → project → user
    const video = await db.video.findFirst({
      where: {
        id,
        project: { userId: session.user.id },
      },
      include: {
        project: { select: { id: true, name: true } },
        transcript: {
          select: { id: true, languageCode: true, createdAt: true },
        },
        viralAnalysis: {
          select: {
            id: true,
            createdAt: true,
            _count: { select: { clips: true } },
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            progress: true,
            error: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!video) {
      return Response.json(
        { success: false, error: 'Video not found or access denied.' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, video });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch video.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

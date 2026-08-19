import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';

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

// ---------------------------------------------------------------------------
// DELETE — remove video and all associated clips/files
// ---------------------------------------------------------------------------

export async function DELETE(
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

  // Ownership check + collect all asset storage paths
  const video = await db.video.findFirst({
    where: {
      id,
      project: { userId: session.user.id },
    },
    select: {
      id: true,
      assets: { select: { storagePath: true } },
      viralAnalysis: {
        select: {
          clips: {
            select: {
              id: true,
              asset: { select: { storagePath: true } },
            },
          },
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

  try {
    const userId = session.user.id;
    const clips = video.viralAnalysis?.clips ?? [];

    // Delete DB record — cascade handles ViralAnalysis, Clips, Transcript, Jobs
    await db.video.delete({ where: { id } });

    // Delete physical files and directories (best-effort, errors are non-fatal)
    const storage = getStorage();

    const fileDeletions = [
      ...video.assets.map((a) => storage.delete(a.storagePath)),
      ...clips.filter((c) => c.asset).map((c) => storage.delete(c.asset!.storagePath)),
    ];

    const dirDeletions = [
      // Video source directory: users/{userId}/videos/{videoId}/
      storage.deleteDirectory(`users/${userId}/videos/${id}`),
      // Each clip directory: users/{userId}/clips/{clipId}/
      ...clips.map((c) => storage.deleteDirectory(`users/${userId}/clips/${c.id}`)),
    ];

    await Promise.allSettled([...fileDeletions, ...dirDeletions]);

    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete video.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

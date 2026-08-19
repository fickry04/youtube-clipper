import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';

// ---------------------------------------------------------------------------
// DELETE — remove project and all associated videos, clips, and files
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

  const { id: projectId } = await params;

  // Ownership check + collect all asset storage paths
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      userId: session.user.id,
    },
    select: {
      id: true,
      videos: {
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
      },
    },
  });

  if (!project) {
    return Response.json(
      { success: false, error: 'Project not found or access denied.' },
      { status: 404 }
    );
  }

  // Collect all storage paths across all videos and their clips
  const storagePaths: string[] = [];
  for (const video of project.videos) {
    for (const asset of video.assets) {
      storagePaths.push(asset.storagePath);
    }
    for (const clip of video.viralAnalysis?.clips ?? []) {
      if (clip.asset) {
        storagePaths.push(clip.asset.storagePath);
      }
    }
  }

  try {
    const userId = session.user.id;

    // Delete DB record — cascade handles Videos, ViralAnalysis, Clips, Transcripts, Jobs
    await db.project.delete({ where: { id: projectId } });

    // Delete physical files and directories (best-effort, errors are non-fatal)
    const storage = getStorage();
    const fileDeletions: Promise<void>[] = [];
    const dirDeletions: Promise<void>[] = [];

    for (const video of project.videos) {
      const clips = video.viralAnalysis?.clips ?? [];

      // Individual files
      for (const asset of video.assets) {
        fileDeletions.push(storage.delete(asset.storagePath));
      }
      for (const clip of clips) {
        if (clip.asset) fileDeletions.push(storage.delete(clip.asset.storagePath));
      }

      // Whole directories
      dirDeletions.push(storage.deleteDirectory(`users/${userId}/videos/${video.id}`));
      for (const clip of clips) {
        dirDeletions.push(storage.deleteDirectory(`users/${userId}/clips/${clip.id}`));
      }
    }

    await Promise.allSettled([...fileDeletions, ...dirDeletions]);

    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete project.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

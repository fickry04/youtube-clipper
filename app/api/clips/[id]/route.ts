import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getStorage, StorageKeys } from '@/lib/storage';

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
        subtitles: { select: { format: true, createdAt: true } }
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const userId = session.user.id;
  const { id: clipId } = await params;

  // Ownership + guard checks
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, viralAnalysis: { video: { project: { userId: session.user.id } } } },
    include: {
      viralAnalysis: {
        include: { clips: { select: { id: true } } },
      },
    },
  });

  if (!clip) {
    return Response.json(
      { success: false, error: 'Video not found or access denied.' },
      { status: 404 }
    );
  }

  if (!clip.viralAnalysis || clip.viralAnalysis.clips.length === 0) {
    return Response.json(
      { success: false, error: 'No viral analysis found. Run analysis first.' },
      { status: 422 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const asset = await tx.videoAsset.findFirst({
        where: {
          clipId: clipId
        }
      })

      // Delete physical files and directories (best-effort, errors are non-fatal)
      const storage = getStorage();
      let fileDeletions: Promise<void>[] = []
      let dirDeletions: Promise<void>[] = []
      if (asset && asset.storagePath) {
        fileDeletions = [
          storage.delete(asset?.storagePath ?? ""),
          storage.delete(StorageKeys.clipVertical(userId, clipId)),
          storage.delete(StorageKeys.clipSubtitle(userId, clipId)),
          storage.delete(StorageKeys.clipVerticalSubtitled(userId, clipId))
        ];
        dirDeletions = [
          storage.deleteDirectory(`users/${userId}/clips/${clipId}`),
        ];
      }

      await Promise.allSettled([...fileDeletions, ...dirDeletions]);

      await tx.videoAsset.deleteMany({
        where: {
          clipId: clipId
        }
      })
    })
    return Response.json({ success: true }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue delete clip job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
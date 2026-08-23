import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
import { getStorage, StorageKeys } from '@/lib/storage';
import * as fs from 'fs';

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

  const { id: clipId } = await params;
  const { searchParams } = new URL(request.url);
  const wantSubtitled = searchParams.get('subtitled') === 'true' || searchParams.get('subtitled') === '1';

  // Ownership chain check
  const clip = await db.clip.findFirst({
    where: {
      id: clipId,
      viralAnalysis: { video: { project: { userId: session.user.id } } },
    },
    include: { asset: true },
  });

  if (!clip) {
    return Response.json(
      { success: false, error: 'Clip not found or access denied.' },
      { status: 404 }
    );
  }

  if (!clip.asset) {
    return Response.json(
      { success: false, error: 'Clip video is not yet processed.' },
      { status: 404 }
    );
  }

  try {
    const storage = getStorage();
    let targetKey = clip.asset.storagePath;

    if (wantSubtitled) {
      const subtitledKey = StorageKeys.clipSubtitled(session.user.id, clipId);
      const legacyBurnedKey = `users/${session.user.id}/clips/${clipId}/clip_burned.mp4`;

      if (await storage.exists(subtitledKey)) {
        targetKey = subtitledKey;
      } else if (await storage.exists(legacyBurnedKey)) {
        targetKey = legacyBurnedKey;
      }
    } else {
      // Clean original video
      const originalKey = StorageKeys.clipVideo(session.user.id, clipId);
      if (await storage.exists(originalKey)) {
        targetKey = originalKey;
      }
    }

    const filePath = await storage.get(targetKey);

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const headers = new Headers({
      'Content-Type': clip.asset.mimeType || 'video/mp4',
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-cache',
    });

    const stream = fs.createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve video.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

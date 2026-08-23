import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
import { getStorage, StorageKeys } from '@/lib/storage';
import * as fs from 'fs';

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

  // Ownership chain check
  const clip = await db.clip.findFirst({
    where: {
      id: clipId,
      viralAnalysis: { video: { project: { userId: session.user.id } } },
    },
  });

  if (!clip) {
    return Response.json(
      { success: false, error: 'Clip not found or access denied.' },
      { status: 404 }
    );
  }

  try {
    const storage = getStorage();
    const verticalKey = StorageKeys.clipVertical(session.user.id, clipId);

    const exists = await storage.exists(verticalKey);
    if (!exists) {
      return Response.json(
        { success: false, error: 'Vertical 9:16 video has not been created yet.' },
        { status: 404 }
      );
    }

    const filePath = await storage.get(verticalKey);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    });

    const stream = fs.createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve vertical video.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

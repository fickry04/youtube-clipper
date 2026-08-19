import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/prisma';
import { getStorage, LocalStorageService } from '@/lib/storage';
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
    const filePath = await storage.get(clip.asset.storagePath);

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const headers = new Headers({
      'Content-Type': clip.asset.mimeType || 'video/mp4',
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    });

    const stream = fs.createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve video.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

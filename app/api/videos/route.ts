import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { extractVideoId } from '@/lib/utils';
import { z } from 'zod';

const CreateVideoSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  youtubeUrl: z.string().url('Invalid URL').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.hostname.includes('youtube.com') ||
          parsed.hostname === 'youtu.be'
        );
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid YouTube URL.' }
  ),
});

export async function POST(request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = CreateVideoSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error?.message ?? 'Validation error.' },
      { status: 400 }
    );
  }

  const { projectId, youtubeUrl } = parsed.data;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });

  if (!project) {
    return Response.json(
      { success: false, error: 'Project not found or access denied.' },
      { status: 404 }
    );
  }

  // Extract YouTube video ID
  const youtubeId = extractVideoId(youtubeUrl);
  if (!youtubeId) {
    return Response.json(
      { success: false, error: 'Could not extract a valid YouTube video ID.' },
      { status: 400 }
    );
  }

  // Check for duplicate
  const existing = await prisma.video.findFirst({
    where: { projectId, youtubeId },
  });

  if (existing) {
    return Response.json(
      { success: true, video: existing, duplicate: true }
    );
  }

  try {
    // Create the video record only — no job is enqueued yet.
    // The user manually triggers each pipeline step from the video detail page.
    const video = await prisma.video.create({
      data: {
        youtubeUrl,
        youtubeId,
        projectId,
      },
    });

    return Response.json({ success: true, video }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create video.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

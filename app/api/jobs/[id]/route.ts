import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

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

  const { id: jobId } = await params;

  try {
    // Ownership check: job.userId must match authenticated user
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: session.user.id },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        attempts: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        videoId: true,
      },
    });

    if (!job) {
      return Response.json(
        { success: false, error: 'Job not found or access denied.' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, job });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

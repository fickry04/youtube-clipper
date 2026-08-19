import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from "@/lib/prisma";
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { videos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ success: true, projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch projects.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

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

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error.' },
      { status: 400 }
    );
  }


  try {
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        userId: session.user.id,
      },
    });

    return Response.json({ success: true, project }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create project.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

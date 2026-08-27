import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const UpdateSocialAccountSchema = z.object({
  platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'X', 'THREADS']),
  displayName: z.string().trim().min(1, 'Display name is required').max(60, 'Display name too long'),
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(50, 'Username too long')
    .transform((value) => value.replace(/^@+/, '')),
  profileUrl: z.union([z.string().url('Invalid profile URL'), z.literal('')]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const { id: accountId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = UpdateSocialAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error.' },
      { status: 400 }
    );
  }

  try {
    // Ownership in the where clause — other users' rows look like 404s.
    const existing = await prisma.socialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return Response.json(
        { success: false, error: 'Social account not found or access denied.' },
        { status: 404 }
      );
    }

    const account = await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        platform: parsed.data.platform,
        displayName: parsed.data.displayName,
        username: parsed.data.username,
        profileUrl: parsed.data.profileUrl ? parsed.data.profileUrl : null,
      },
    });

    return Response.json({ success: true, account });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update social account.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

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

  const { id: accountId } = await params;

  try {
    const existing = await prisma.socialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return Response.json(
        { success: false, error: 'Social account not found or access denied.' },
        { status: 404 }
      );
    }

    await prisma.socialAccount.delete({ where: { id: accountId } });

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete social account.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

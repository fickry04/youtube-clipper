import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { decryptJson, encryptJson } from '@/lib/crypto';

const CreateSocialAccountSchema = z.object({
  platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'X', 'THREADS', 'FACEBOOK']),
  displayName: z.string().trim().min(1, 'Display name is required').max(60, 'Display name too long'),
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(50, 'Username too long')
    .transform((value) => value.replace(/^@+/, '')),
  profileUrl: z.union([z.string().url('Invalid profile URL'), z.literal('')]).optional(),
  credential: z.string()
});

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId: session.user.id },
      orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }],
    });

    const decryptedAccounts = await Promise.all(accounts.map(async (account) => {
      if (!account.encryptedCredential) {
        return account;
      }
      const decryptedCredential = await decryptJson(account.encryptedCredential);
      return {
        ...account,
        decryptedCredential: decryptedCredential,
      };
    }));

    return Response.json({ success: true, accounts: decryptedAccounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch social accounts.';
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

  const parsed = CreateSocialAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error.' },
      { status: 400 }
    );
  }

  const encryptedCredential = await encryptJson(parsed.data.credential)

  try {
    const account = await prisma.socialAccount.create({
      data: {
        userId: session.user.id,
        platform: parsed.data.platform,
        displayName: parsed.data.displayName,
        username: parsed.data.username,
        encryptedCredential: encryptedCredential,
        profileUrl: parsed.data.profileUrl ? parsed.data.profileUrl : null,
      },
    });

    return Response.json({ success: true, account }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create social account.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

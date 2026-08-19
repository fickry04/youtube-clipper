import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
} | null;

/**
 * Get the current session (returns null if not authenticated).
 * Use in Server Components and API Route Handlers.
 */
export async function getSession(): Promise<AuthSession> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Require authentication. Throws a Response (401) if not authenticated.
 * Use in API Route Handlers to enforce auth.
 */
export async function requireSession(): Promise<NonNullable<AuthSession>> {
  const session = await getSession();
  if (!session) {
    throw Response.json(
      { success: false, error: 'Authentication required.' },
      { status: 401 }
    );
  }
  return session;
}

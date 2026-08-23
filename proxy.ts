import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

// Routes that are always public (no auth required)
const PUBLIC_API_PREFIXES = [
  '/api/auth',       // Better Auth endpoints
];

const AUTH_PAGE_PREFIXES = [
  '/login',
  '/register',
];

const PUBLIC_PAGE_PREFIXES = [
  '/login',
  '/register',
  '/(auth)',
];

function isPublicRoute(pathname: string): boolean {
  if (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return true;
  }
  for (const prefix of PUBLIC_PAGE_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If user is already authenticated and visits /login or /register, redirect to /dashboard
  const isAuthPage = AUTH_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isAuthPage) {
    const hasSessionToken =
      request.cookies.has('better-auth.session_token') ||
      request.cookies.has('__Secure-better-auth.session_token');

    if (hasSessionToken) {
      try {
        const session = await getSession();
        if (session) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      } catch {
        // Invalid or expired session, continue to auth page
      }
    }
    return NextResponse.next();
  }

  // Allow public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Protect /dashboard/* and /api/* (except public prefixes above)
  const needsAuth =
    pathname.startsWith('/dashboard') || pathname.startsWith('/api/');

  if (!needsAuth) {
    return NextResponse.next();
  }

  try {
    const session = await getSession();
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required.' },
          { status: 401 }
        );
      }
      // Redirect browser requests to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

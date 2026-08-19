'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from '@/lib/auth/client';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/projects', label: 'Projects' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/dashboard" className="navbar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#nb1)" opacity="0.9" />
            <path d="M2 17l10 5 10-5" stroke="url(#nb2)" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 12l10 5 10-5" stroke="url(#nb3)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="nb1" x1="2" y1="7" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="nb2" x1="2" y1="17" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="nb3" x1="2" y1="12" x2="22" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="navbar-logo-text">Youtube Clipper</span>
        </Link>

        {/* Nav links */}
        <div className="navbar-links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navbar-link ${pathname === link.href ? 'navbar-link-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User info + logout */}
        <div className="navbar-user">
          {session?.user && (
            <span className="navbar-user-name">
              {session.user.name || session.user.email}
            </span>
          )}
          <button
            id="navbar-signout-btn"
            onClick={handleSignOut}
            className="navbar-signout-btn"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

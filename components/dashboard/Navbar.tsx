'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from '@/lib/auth/client';

interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

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
        <Link href="/" className="navbar-logo">
          <Image
            src="/logo.png"
            alt="YouTube Clipper Logo"
            width={60}
            height={40}
            priority
          />
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
          {user && (
            <span className="navbar-user-name">
              {user.name || user.email}
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

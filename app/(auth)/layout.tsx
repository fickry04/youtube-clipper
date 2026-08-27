import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Authentication — YouTube Clipper',
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="auth-bg">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-container">
        <div className="auth-logo">
          {/* Logo */}
          <Image
            src="/logo.png"
            alt="YouTube Clipper Logo"
            width={60}
            height={40}
            priority
          />
          <span className="auth-logo-text">Viral Clipper</span>
        </div>
        {children}
      </div>
    </div>
  );
}

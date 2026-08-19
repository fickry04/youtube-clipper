import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication — YouTube Viral Clipper',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-bg">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-container">
        <div className="auth-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#al1)" opacity="0.9" />
            <path d="M2 17l10 5 10-5" stroke="url(#al2)" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 12l10 5 10-5" stroke="url(#al3)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="al1" x1="2" y1="7" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="al2" x1="2" y1="17" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="al3" x1="2" y1="12" x2="22" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="auth-logo-text">Viral Clipper</span>
        </div>
        {children}
      </div>
    </div>
  );
}

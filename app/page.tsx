import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-main">
      {/* Background effects */}
      <div className="landing-bg-orb1" aria-hidden="true" />
      <div className="landing-bg-orb2" aria-hidden="true" />
      <div className="landing-bg-orb3" aria-hidden="true" />
      <div className="landing-bg-grid" aria-hidden="true" />

      {/* ── Navigation ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          {/* Logo */}
          <Link href="/" className="landing-nav-logo" aria-label="YouTube video Clipper home">
            <Image
              src="/logo.png"
              alt="YouTube Clipper Logo"
              width={60}
              height={40}
              className="landing-logo-image"
              priority
            />
            <span className="landing-nav-logo-text">Youtube Clipper</span>
          </Link>

          {/* Nav links */}
          <div className="landing-nav-links">
            <Link href="#features" className="landing-nav-link">Features</Link>
            <Link href="#how-it-works" className="landing-nav-link">How it works</Link>
          </div>

          {/* Auth buttons */}
          <div className="landing-nav-actions">
            <Link href="/login" id="nav-login-btn" className="landing-btn-ghost">
              Log in
            </Link>
            <Link href="/register" id="nav-register-btn" className="landing-btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero" aria-label="Hero">
        <div className="landing-hero-badge">
          <span className="landing-hero-badge-dot" aria-hidden="true" />
          AI-Powered Video Clip Analysis
        </div>

        <h1 className="landing-hero-title">
          Turn any YouTube video into{' '}
          <span className="landing-hero-title-gradient">video clips</span>
        </h1>

        <p className="landing-hero-subtitle">
          Paste a YouTube link, pick your language, and let AI identify the moments
          your audience will watch — and share — over and over again.
        </p>

        <div className="landing-hero-cta">
          <Link href="/register" id="hero-cta-primary" className="landing-cta-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start clipping for free
          </Link>
          <Link href="/login" id="hero-cta-secondary" className="landing-cta-secondary">
            Already have an account? Log in
          </Link>
        </div>

        {/* Stat pills */}
        <div className="landing-hero-stats">
          {[
            { value: 'Fast', label: 'analysis' },
            { value: 'Multi-language', label: 'support' },
            { value: '100%', label: 'free' },
          ].map((s) => (
            <div key={s.label} className="landing-stat-pill">
              <span className="landing-stat-value">{s.value}</span>
              <span className="landing-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="landing-section" aria-label="Features">
        <div className="landing-section-header">
          <h2 className="landing-section-title">Everything you need to go viral</h2>
          <p className="landing-section-subtitle">
            From raw transcript to ranked clip suggestions in seconds
          </p>
        </div>

        <div className="landing-feature-grid">
          {[
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
                </svg>
              ),
              title: 'Instant transcript',
              desc: 'Supports full URLs, shortened links, and video IDs. Any YouTube video with captions.',
              color: 'purple',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ),
              title: 'Multi languages',
              desc: 'Pick from all available captions, including auto-generated ones in dozens of languages.',
              color: 'blue',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              ),
              title: 'Viral score ranking',
              desc: 'AI assigns each clip a viral score with hooks, strengths, weaknesses, and category tags.',
              color: 'pink',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              ),
              title: 'Project management',
              desc: 'Organise videos into projects, track progress, and revisit your clip analyses any time.',
              color: 'cyan',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              ),
              title: 'Interactive viewer',
              desc: 'Click any transcript line to jump to that exact moment in the video.',
              color: 'purple',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              ),
              title: 'Clip summaries',
              desc: 'Each suggested clip includes a hook, summary, and "why it will go viral" explanation.',
              color: 'blue',
            },
          ].map((f) => (
            <div key={f.title} className={`landing-feature-card landing-feature-card--${f.color}`}>
              <div className={`landing-feature-icon landing-feature-icon--${f.color}`}>
                {f.icon}
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="landing-section" aria-label="How it works">
        <div className="landing-section-header">
          <h2 className="landing-section-title">Three steps to your next viral clip</h2>
          <p className="landing-section-subtitle">No editing skills required</p>
        </div>

        <div className="landing-steps-row">
          {[
            {
              step: '01',
              title: 'Paste your YouTube URL',
              desc: 'Drop in any YouTube link. We instantly fetch all available caption tracks.',
            },
            {
              step: '02',
              title: 'Choose a language',
              desc: 'Pick the transcript language that matches your target audience.',
            },
            {
              step: '03',
              title: 'Get your clip list',
              desc: 'AI analyses the transcript and returns a ranked list of viral-ready moments.',
            },
          ].map((s) => (
            <div key={s.step} className="landing-step-card">
              <div className="landing-step-number">{s.step}</div>
              <h3 className="landing-step-title">{s.title}</h3>
              <p className="landing-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="landing-cta-banner" aria-label="Call to action">
        <div className="landing-cta-banner-inner">
          <h2 className="landing-cta-banner-title">Ready to find your next video clip moments?</h2>
          <p className="landing-cta-banner-subtitle">
            Join creators who are already shipping better content, faster.
          </p>
          <div className="landing-cta-banner-actions">
            <Link href="/register" id="banner-cta-primary" className="landing-cta-primary">
              Create free account
            </Link>
            <Link href="/login" id="banner-cta-login" className="landing-cta-secondary">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-logo">
            <Image
              src="/logo.png"
              alt="YouTube Clipper Logo"
              width={22}
              height={22}
              className="landing-logo-image"
            />
            <span className="landing-footer-logo-text">Youtube Clipper</span>
          </div>
          <p className="landing-footer-copy">© {new Date().getFullYear()} YouTube Video Clipper. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Background effects */}
      <div className={styles.bgOrb1} aria-hidden="true" />
      <div className={styles.bgOrb2} aria-hidden="true" />
      <div className={styles.bgOrb3} aria-hidden="true" />
      <div className={styles.bgGrid} aria-hidden="true" />

      {/* ── Navigation ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          {/* Logo */}
          <Link href="/" className={styles.navLogo} aria-label="YouTube video Clipper home">
            <div className={styles.logoMark} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#g1)" opacity="0.9" />
                <path d="M2 17l10 5 10-5" stroke="url(#g2)" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="url(#g3)" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="g1" x1="2" y1="7" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="g2" x1="2" y1="17" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="g3" x1="2" y1="12" x2="22" y2="17" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={styles.navLogoText}>Youtube Clipper</span>
          </Link>

          {/* Nav links */}
          <div className={styles.navLinks}>
            <Link href="#features" className={styles.navLink}>Features</Link>
            <Link href="#how-it-works" className={styles.navLink}>How it works</Link>
          </div>

          {/* Auth buttons */}
          <div className={styles.navActions}>
            <Link href="/login" id="nav-login-btn" className={styles.btnGhost}>
              Log in
            </Link>
            <Link href="/register" id="nav-register-btn" className={styles.btnPrimary}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero} aria-label="Hero">
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} aria-hidden="true" />
          AI-Powered Video Clip Analysis
        </div>

        <h1 className={styles.heroTitle}>
          Turn any YouTube video into{' '}
          <span className={styles.heroTitleGradient}>video clips</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Paste a YouTube link, pick your language, and let AI identify the moments
          your audience will watch — and share — over and over again.
        </p>

        <div className={styles.heroCta}>
          <Link href="/register" id="hero-cta-primary" className={styles.ctaPrimary}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start clipping for free
          </Link>
          <Link href="/login" id="hero-cta-secondary" className={styles.ctaSecondary}>
            Already have an account? Log in
          </Link>
        </div>

        {/* Stat pills */}
        <div className={styles.heroStats}>
          {[
            { value: 'Fast', label: 'analysis' },
            { value: 'Multi-language', label: 'support' },
            { value: '100%', label: 'free' },
          ].map((s) => (
            <div key={s.label} className={styles.statPill}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className={styles.section} aria-label="Features">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Everything you need to go viral</h2>
          <p className={styles.sectionSubtitle}>
            From raw transcript to ranked clip suggestions in seconds
          </p>
        </div>

        <div className={styles.featureGrid}>
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
            <div key={f.title} className={`${styles.featureCard} ${styles[`featureCard--${f.color}`]}`}>
              <div className={`${styles.featureIcon} ${styles[`featureIcon--${f.color}`]}`}>
                {f.icon}
              </div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className={styles.section} aria-label="How it works">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Three steps to your next viral clip</h2>
          <p className={styles.sectionSubtitle}>No editing skills required</p>
        </div>

        <div className={styles.stepsRow}>
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
          ].map((s, i) => (
            <div key={s.step} className={styles.stepCard}>
              <div className={styles.stepNumber}>{s.step}</div>
              {i < 2 && <div className={styles.stepConnector} aria-hidden="true" />}
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className={styles.ctaBanner} aria-label="Call to action">
        <div className={styles.ctaBannerInner}>
          <h2 className={styles.ctaBannerTitle}>Ready to find your next video clip moments?</h2>
          <p className={styles.ctaBannerSubtitle}>
            Join creators who are already shipping better content, faster.
          </p>
          <div className={styles.ctaBannerActions}>
            <Link href="/register" id="banner-cta-primary" className={styles.ctaPrimary}>
              Create free account
            </Link>
            <Link href="/login" id="banner-cta-login" className={styles.ctaSecondary}>
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <div className={styles.logoMark} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#gf1)" opacity="0.9" />
                <path d="M2 17l10 5 10-5" stroke="url(#gf2)" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="url(#gf3)" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="gf1" x1="2" y1="7" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="gf2" x1="2" y1="17" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="gf3" x1="2" y1="12" x2="22" y2="17" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={styles.footerLogoText}>Youtube Clipper</span>
          </div>
          <p className={styles.footerCopy}>© {new Date().getFullYear()} YouTube Video Clipper. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

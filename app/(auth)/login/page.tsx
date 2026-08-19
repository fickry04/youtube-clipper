'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'Invalid email or password.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="login-email" className="auth-label">Email</label>
          <input
            id="login-email"
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="login-password" className="auth-label">Password</label>
          <input
            id="login-password"
            type="password"
            className="auth-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="auth-link">
          Create one
        </Link>
      </p>
    </div>
  );
}

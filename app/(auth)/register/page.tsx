'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth/client';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'Registration failed. Please try again.');
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
        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">Start clipping viral moments today</p>
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
          <label htmlFor="register-name" className="auth-label">Full Name</label>
          <input
            id="register-name"
            type="text"
            className="auth-input"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            disabled={isLoading}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="register-email" className="auth-label">Email</label>
          <input
            id="register-email"
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
          <label htmlFor="register-password" className="auth-label">Password</label>
          <input
            id="register-password"
            type="password"
            className="auth-input"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="register-confirm-password" className="auth-label">Confirm Password</label>
          <input
            id="register-confirm-password"
            type="password"
            className="auth-input"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />
        </div>

        <button
          id="register-submit-btn"
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account?{' '}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </div>
  );
}

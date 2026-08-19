'use client';

import styles from './UrlInput.module.css';
import { useState } from 'react';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.inputGroup}>
        <div className={styles.iconWrapper} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
          </svg>
        </div>
        <input
          id="youtube-url-input"
          className={styles.input}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube URL or video ID..."
          aria-label="YouTube video URL"
          disabled={isLoading}
          autoComplete="off"
          spellCheck={false}
        />
        {url && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => setUrl('')}
            aria-label="Clear URL"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      <button
        id="transcribe-submit-btn"
        type="submit"
        className={styles.submitBtn}
        disabled={isLoading || !url.trim()}
      >
        {isLoading ? (
          <span className={styles.loadingDots}>
            <span /><span /><span />
          </span>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Transcribe</span>
          </>
        )}
      </button>
    </form>
  );
}

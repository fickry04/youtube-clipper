'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface GenerateSubtitleButtonProps {
  clipId: string;
  hasSubtitle: boolean;
  hasClipAsset: boolean;
}

export function GenerateSubtitleButton({
  clipId,
  hasSubtitle,
  hasClipAsset,
}: GenerateSubtitleButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/clips/${clipId}/subtitle`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to start subtitle generation.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [clipId, router]);

  if (hasSubtitle) {
    return (
      <div className="clip-subtitle-badge clip-subtitle-done">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Subtitles Ready</span>
      </div>
    );
  }

  return (
    <div className="clip-subtitle-action">
      <button
        id={`generate-subtitle-btn-${clipId}`}
        onClick={handleGenerate}
        disabled={loading || !hasClipAsset}
        className="subtitle-btn"
        title={!hasClipAsset ? 'Cut the clip first' : 'Generate & burn subtitles'}
      >
        {loading ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            <span>Queuing…</span>
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="M7 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H7" />
              <path d="M15 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
            </svg>
            <span>Generate Subtitles</span>
          </>
        )}
      </button>
      {error && <p className="form-error" role="alert" style={{ marginTop: '6px' }}>{error}</p>}
    </div>
  );
}

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
      <div
        className="clip-badge-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '99px',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#4ade80',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Subtitles Ready</span>
      </div>
    );
  }

  return (
    <div className="clip-subtitle-action" style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <button
        id={`generate-subtitle-btn-${clipId}`}
        onClick={handleGenerate}
        disabled={loading || !hasClipAsset}
        className="action-btn action-btn-secondary"
        style={{
          fontSize: '0.78rem',
          padding: '5px 12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: (!hasClipAsset || loading) ? 'not-allowed' : 'pointer',
        }}
        title={!hasClipAsset ? 'Cut the clip first' : 'Generate & burn subtitles'}
      >
        {loading ? (
          <>
            <span className="auth-spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} aria-hidden="true" />
            <span>Queuing…</span>
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="M7 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H7" />
              <path d="M15 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
            </svg>
            <span>Generate Subtitles</span>
          </>
        )}
      </button>
      {error && <p className="form-error" role="alert" style={{ marginTop: '4px', fontSize: '0.72rem' }}>{error}</p>}
    </div>
  );
}

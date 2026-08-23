'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface GenerateSubtitleButtonProps {
  clipId: string;
  hasSubtitle: boolean;
  hasClipAsset: boolean;
  hasVertical: boolean;
  isJobRunning?: boolean;
  onJobStarted?: (newJob: any) => void;
}

export function GenerateSubtitleButton({
  clipId,
  hasSubtitle,
  hasClipAsset,
  hasVertical,
  isJobRunning = false,
  onJobStarted,
}: GenerateSubtitleButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/clips/${clipId}/subtitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspectRatio: '9:16' }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Gagal memulai pembuatan subtitle 9:16.');
        return;
      }
      if (data.jobId && onJobStarted) {
        onJobStarted({
          id: data.jobId,
          type: 'GENERATE_SUBTITLE',
          status: 'QUEUED',
          progress: 5,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
      }
      router.refresh();
    } catch {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  }, [clipId, router, onJobStarted]);

  if (hasSubtitle) {
    return (
      <div className="clip-subtitle-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div className="clip-badge-pill pill-green">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>9:16 Subtitles Ready</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || isJobRunning || !hasClipAsset || !hasVertical}
          className="clip-btn-reprocess"
          title="Proses ulang pembuatan subtitle bergerak (Moving Pill) 9:16"
        >
          {loading ? (
            <>
              <span className="auth-spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }} aria-hidden="true" />
              <span>Queuing…</span>
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              <span>Re-Generate (9:16 Subtitles)</span>
            </>
          )}
        </button>
        {error && <span className="form-error" style={{ fontSize: '0.7rem', display: 'block', width: '100%' }}>{error}</span>}
      </div>
    );
  }

  const isGenerateDisabled = !hasClipAsset || !hasVertical || loading || isJobRunning;
  const buttonTitle = !hasClipAsset
    ? 'Download klip terlebih dahulu'
    : !hasVertical
      ? 'Lakukan Auto-Crop 9:16 (Face AI) terlebih dahulu agar subtitle dapat di-burn ke video vertikal'
      : 'Generate & burn subtitle bergerak (Moving Pill) 9:16';

  return (
    <div className="clip-subtitle-action" style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <button
        id={`generate-subtitle-btn-${clipId}`}
        onClick={handleGenerate}
        disabled={isGenerateDisabled}
        className="clip-action-pill-btn clip-btn-subtitle"
        style={{
          opacity: (!hasClipAsset || !hasVertical) ? 0.6 : 1,
          cursor: isGenerateDisabled ? 'not-allowed' : 'pointer',
        }}
        title={buttonTitle}
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
            <span>{!hasVertical ? 'Generate 9:16 Subtitles (Perlu Crop 9:16)' : 'Generate 9:16 Subtitles'}</span>
          </>
        )}
      </button>
      {error && <p className="form-error" role="alert" style={{ marginTop: '4px', fontSize: '0.72rem' }}>{error}</p>}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CropFaceButtonProps {
  clipId: string;
  hasClipAsset: boolean;
  hasVertical: boolean;
  isJobRunning?: boolean;
  onJobStarted?: (newJob: any) => void;
}

export function CropFaceButton({
  clipId,
  hasClipAsset,
  hasVertical,
  isJobRunning = false,
  onJobStarted,
}: CropFaceButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCrop = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/clips/${clipId}/crop`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Gagal memulai auto-crop video.');
        return;
      }
      if (data.jobId && onJobStarted) {
        onJobStarted({
          id: data.jobId,
          type: 'FACE_DETECTION',
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

  if (hasVertical) {
    return (
      <div className="clip-vertical-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div className="clip-badge-pill pill-blue">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
          </svg>
          <span>9:16 Crop Ready</span>
        </div>
        <button
          onClick={handleCrop}
          disabled={loading || isJobRunning || !hasClipAsset}
          className="clip-btn-reprocess"
          title="Proses ulang auto-crop 9:16 (Face AI)"
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
              <span>Re-Crop Face AI</span>
            </>
          )}
        </button>
        {error && <span className="form-error" style={{ fontSize: '0.7rem', display: 'block', width: '100%' }}>{error}</span>}
      </div>
    );
  }

  return (
    <div className="clip-crop-action" style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <button
        id={`crop-face-btn-${clipId}`}
        onClick={handleCrop}
        disabled={loading || isJobRunning || !hasClipAsset}
        className="clip-action-pill-btn clip-btn-face-crop"
        title={!hasClipAsset ? 'Download klip terlebih dahulu' : 'Auto-crop vertikal 9:16 dengan deteksi wajah & pembicara aktif'}
      >
        {loading ? (
          <>
            <span className="auth-spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} aria-hidden="true" />
            <span>Queuing…</span>
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m0 6v4a2 2 0 0 0 2 2h4m6 0h4a2 2 0 0 0 2-2v-4m0-6V5a2 2 0 0 0-2-2h-4" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Crop 9:16 (Face AI)</span>
          </>
        )}
      </button>
      {error && <p className="form-error" role="alert" style={{ marginTop: '4px', fontSize: '0.72rem' }}>{error}</p>}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CropFaceButtonProps {
  clipId: string;
  hasClipAsset: boolean;
  hasVertical: boolean;
  isJobRunning?: boolean;
}

export function CropFaceButton({
  clipId,
  hasClipAsset,
  hasVertical,
  isJobRunning = false,
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
      router.refresh();
    } catch {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  }, [clipId, router]);

  if (hasVertical) {
    return (
      <div className="clip-vertical-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <div className="clip-subtitle-badge clip-subtitle-done" style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
          </svg>
          <span>9:16 Face Crop Ready</span>
        </div>
        <button
          onClick={handleCrop}
          disabled={loading || isJobRunning || !hasClipAsset}
          className="action-btn action-btn-secondary"
          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          title="Proses ulang auto-crop 9:16"
        >
          {loading ? 'Queuing…' : 'Re-Crop'}
        </button>
      </div>
    );
  }

  return (
    <div className="clip-crop-action" style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <button
        id={`crop-face-btn-${clipId}`}
        onClick={handleCrop}
        disabled={loading || isJobRunning || !hasClipAsset}
        className="subtitle-btn"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
          borderColor: 'rgba(168, 85, 247, 0.4)',
          color: '#c084fc',
        }}
        title={!hasClipAsset ? 'Download klip terlebih dahulu' : 'Auto-crop vertikal 9:16 dengan deteksi wajah & pembicara aktif'}
      >
        {loading ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            <span>Queuing…</span>
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m0 6v4a2 2 0 0 0 2 2h4m6 0h4a2 2 0 0 0 2-2v-4m0-6V5a2 2 0 0 0-2-2h-4" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Crop 9:16 (Face AI)</span>
          </>
        )}
      </button>
      {error && <p className="form-error" role="alert" style={{ marginTop: '6px', fontSize: '0.75rem' }}>{error}</p>}
    </div>
  );
}

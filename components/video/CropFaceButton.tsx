'use client';

import { useState, useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { JobInfo } from './VideoDetailManager';

interface CropFaceButtonProps {
  clipId: string;
  hasClipAsset: boolean;
  hasVertical: boolean;
  isJobRunning?: boolean;
  onJobStarted?: (newJob: JobInfo) => void;
}

export function CropFaceButton({
  clipId,
  hasClipAsset,
  hasVertical,
  isJobRunning = false,
  onJobStarted,
}: CropFaceButtonProps) {
  const router = useRouter();
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const [error, setError] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual crop parameters
  const [xCenter, setXCenter] = useState<number>(50);
  const [yCenter, setYCenter] = useState<number>(50);
  const [scale, setScale] = useState<number>(1.0);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const xSliderId = useId();
  const ySliderId = useId();
  const scaleSliderId = useId();

  const handleFaceCrop = useCallback(async () => {
    setError('');
    setLoadingAi(true);
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
      setLoadingAi(false);
    }
  }, [clipId, router, onJobStarted]);

  const handleManualCropSubmit = useCallback(async () => {
    setError('');
    setLoadingManual(true);
    setShowManualModal(false);
    if (onJobStarted) {
      onJobStarted({
        id: "temp_job_id", // biar keren aja langsung muncul sebenarnya perlu refresh
        type: 'MANUAL_CROP',
        status: 'PROCESSING',
        progress: 5,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    try {
      const res = await fetch(`/api/clips/${clipId}/crop-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xCenterNorm: xCenter / 100,
          yCenterNorm: yCenter / 100,
          scale,
        }),
      });
      router.refresh()
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Manual Crop failed.');
        if (data.jobId && onJobStarted) {
          onJobStarted({
            id: data.jobId,
            type: 'MANUAL_CROP',
            status: 'FAILED',
            progress: 100,
            error: data.error ?? 'Manual Crop failed.',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          });
        }
        return;
      }

      if (data.jobId && onJobStarted) {
        onJobStarted({
          id: data.jobId,
          type: 'MANUAL_CROP',
          status: 'QUEUED',
          progress: 10,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
      }
      router.refresh();
    } catch {
      setError('Terjadi kesalahan jaringan saat manual crop.');
    } finally {
      setLoadingManual(false);
    }
  }, [clipId, xCenter, yCenter, scale, router, onJobStarted]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => { });
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const baseCropWidthPercent = (9 / 16) / (16 / 9) * 100;
  const scaledWidthPercent = Math.max(10, Math.min(100, baseCropWidthPercent / scale));
  const scaledHeightPercent = Math.max(20, Math.min(100, 100 / scale));
  const cropLeftPercent = (100 - scaledWidthPercent) * (xCenter / 100);
  const cropTopPercent = (100 - scaledHeightPercent) * (yCenter / 100);

  return (
    <div className="clip-crop-actions-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {hasVertical ? (
        <>
          <div className="clip-badge-pill pill-blue">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
            <span>9:16 Ready</span>
          </div>

          <button
            onClick={handleFaceCrop}
            disabled={loadingAi || loadingManual || isJobRunning || !hasClipAsset}
            className="clip-btn-reprocess"
            title="Proses ulang auto-crop 9:16 dengan AI Face Tracker"
          >
            {loadingAi ? (
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
                <span>Re-Crop AI</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            disabled={loadingAi || loadingManual || isJobRunning || !hasClipAsset}
            className="clip-btn-reprocess"
            style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
            title="Ubah posisi crop 9:16 manual sambil melihat live video & overlay"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
            <span>Manual Crop</span>
          </button>
        </>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            id={`crop-face-btn-${clipId}`}
            onClick={handleFaceCrop}
            disabled={loadingAi || loadingManual || isJobRunning || !hasClipAsset}
            className="clip-action-pill-btn clip-btn-face-crop"
            title={!hasClipAsset ? 'Download klip terlebih dahulu' : 'Auto-crop vertikal 9:16 dengan deteksi wajah & pembicara aktif'}
          >
            {loadingAi ? (
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

          <button
            id={`crop-manual-btn-${clipId}`}
            onClick={() => setShowManualModal(true)}
            disabled={loadingAi || loadingManual || isJobRunning || !hasClipAsset}
            className="clip-action-pill-btn clip-btn-manual-crop"
            title={!hasClipAsset ? 'Download klip terlebih dahulu' : 'Crop manual 9:16 dengan preview video dan overlay interaktif'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
            <span>Crop Manual 9:16</span>
          </button>
        </div>
      )}

      {error && <p className="form-error" role="alert" style={{ marginTop: '4px', fontSize: '0.72rem', width: '100%' }}>{error}</p>}

      {showManualModal && createPortal(
        <div
          className="manual-crop-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(12px)',
            zIndex: 99,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => e.preventDefault()}
        >
          <div
            className="manual-crop-modal-dialog"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#0b1120',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px',
              boxShadow: '0 25px 70px -12px rgba(0, 0, 0, 0.98)',
              padding: '22px',
              color: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                    <path d="M12 18h.01" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>Manual Crop 9:16</h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>Lihat preview video asli dengan overlay crop 9:16 di depannya</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Live Video Canvas Container with 9:16 Interactive Framing Overlay */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                backgroundColor: '#020617',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                marginBottom: '16px',
              }}
            >
              <video
                ref={videoRef}
                src={`/api/clips/${clipId}/video`}
                autoPlay
                playsInline
                loop
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${cropLeftPercent}%`,
                    top: `${cropTopPercent}%`,
                    width: `${scaledWidthPercent}%`,
                    height: `${scaledHeightPercent}%`,
                    border: '2px solid #38bdf8',
                    borderRadius: '4px',
                    boxShadow: '0 0 0 9999px rgba(3, 7, 18, 0.68), 0 0 16px rgba(56, 189, 248, 0.7)',
                    transition: 'all 0.08s ease-out',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px' }}>
                    <span
                      style={{
                        backgroundColor: '#38bdf8',
                        color: '#020617',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      9:16 CROP
                    </span>
                    <span
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: '#ffffff',
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '3px',
                      }}
                    >
                      {scale.toFixed(1)}x
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                    <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                    <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                    <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3px' }}>
                    <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: '3px' }}>
                      X: {xCenter}%
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  display: 'flex',
                  gap: '6px',
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={togglePlayPause}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.82)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.82)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isMuted ? '🔇 Unmute' : '🔊 Muted'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Preset Cepat Posisi Horizontal
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { label: 'Kiri (15%)', val: 15 },
                  { label: 'Tengah (50%)', val: 50 },
                  { label: 'Kanan (85%)', val: 85 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setXCenter(preset.val)}
                    style={{
                      padding: '7px 8px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      border: xCenter === preset.val ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: xCenter === preset.val ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.6)',
                      color: xCenter === preset.val ? '#38bdf8' : '#cbd5e1',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                  <label htmlFor={xSliderId} style={{ color: '#cbd5e1', fontWeight: 600 }}>Posisi Horizontal (X)</label>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{xCenter}%</span>
                </div>
                <input
                  id={xSliderId}
                  type="range"
                  min="0"
                  max="100"
                  value={xCenter}
                  onChange={(e) => setXCenter(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                  <label htmlFor={ySliderId} style={{ color: '#cbd5e1', fontWeight: 600 }}>Posisi Vertikal (Y)</label>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{yCenter}%</span>
                </div>
                <input
                  id={ySliderId}
                  type="range"
                  min="0"
                  max="100"
                  value={yCenter}
                  onChange={(e) => setYCenter(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                  <label htmlFor={scaleSliderId} style={{ color: '#cbd5e1', fontWeight: 600 }}>Zoom Scale</label>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{scale.toFixed(2)}x</span>
                </div>
                <input
                  id={scaleSliderId}
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>
            </div>

            {error && (
              <div className="form-error" style={{ marginBottom: '14px', fontSize: '0.78rem' }} role="alert">
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                disabled={loadingManual}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleManualCropSubmit}
                disabled={loadingAi || loadingManual || isJobRunning || !hasClipAsset}
                style={{
                  flex: 2,
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)',
                }}
              >
                {loadingManual ? (
                  <>
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                    <span>Memproses Crop 9:16…</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Terapkan Crop 9:16</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body // 3. Render modal ini langsung ke dalam <body> html
      )}
    </div>
  );
}
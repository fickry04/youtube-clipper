'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ExpandedPhoneModalProps {
  clip: {
    id: string;
    rank: number;
    title: string;
    durationSeconds: number;
    startTime: string;
    endTime: string;
    viralScore: number;
    hasVertical?: boolean;
    hasVerticalSubtitled?: boolean;
  };
  initialViewMode?: 'vertical' | 'original';
  initialSubOn?: boolean;
  onClose: () => void;
  onViewModeChange?: (clipId: string, mode: 'vertical' | 'original') => void;
  onSubChange?: (clipId: string, isSubOn: boolean) => void;
}

export function ExpandedPhoneModal({
  clip,
  initialViewMode = 'vertical',
  initialSubOn = true,
  onClose,
  onViewModeChange,
  onSubChange,
}: ExpandedPhoneModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isVerticalView, setIsVerticalView] = useState<boolean>(
    clip.hasVertical ? initialViewMode === 'vertical' : false
  );

  const hasSubtitles = Boolean(clip.hasVerticalSubtitled);
  const [isSubOn, setIsSubOn] = useState<boolean>(
    hasSubtitles ? initialSubOn : false
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to close modal, lock body scroll, and pause background videos
  useEffect(() => {
    // Immediately pause any video currently playing on the page
    if (typeof document !== 'undefined') {
      document.querySelectorAll('video').forEach((v) => {
        try {
          (v as HTMLVideoElement).pause();
        } catch (_) {}
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleToggleView = useCallback(
    (mode: 'vertical' | 'original') => {
      setIsVerticalView(mode === 'vertical');
      onViewModeChange?.(clip.id, mode);
    },
    [clip.id, onViewModeChange]
  );

  const handleToggleSub = useCallback(() => {
    const nextSub = !isSubOn;
    setIsSubOn(nextSub);
    onSubChange?.(clip.id, nextSub);
  }, [clip.id, isSubOn, onSubChange]);

  const videoSrc = isVerticalView
    ? `/api/clips/${clip.id}/vertical${isSubOn && hasSubtitles ? '?subtitled=true' : ''}`
    : `/api/clips/${clip.id}/video`;

  const downloadSrc = videoSrc;
  const downloadFilename = `clip_${clip.rank}_${isVerticalView ? '9-16' : '16-9'}_${isVerticalView && isSubOn && hasSubtitles ? 'subtitled_' : ''}${clip.startTime.replace(':', '-')}.mp4`;

  if (!mounted) return null;

  const modalContent = (
    <div
      className="phone-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview Video Clip #${clip.rank}`}
    >
      <div
        className="phone-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Bar (Controls & Actions) */}
        <div className="phone-modal-top-bar">
          <div className="phone-modal-clip-info">
            <span className="phone-modal-rank-badge">#{clip.rank}</span>
            <div className="phone-modal-title-block">
              <h3 className="phone-modal-title">{clip.title}</h3>
              <p className="phone-modal-subtitle">
                {clip.startTime} → {clip.endTime} ({Math.round(clip.durationSeconds)}s) • Viral Score {clip.viralScore}/100
              </p>
            </div>
          </div>

          <div className="phone-modal-actions">
            {/* Aspect Ratio Switcher */}
            {clip.hasVertical && (
              <div className="phone-modal-toggle-group">
                <button
                  type="button"
                  onClick={() => handleToggleView('vertical')}
                  className={`phone-modal-pill-btn ${isVerticalView ? 'active' : ''}`}
                  title="Tampilan Vertikal 9:16 (Shorts/Reels)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                  </svg>
                  <span>9:16 Shorts</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleView('original')}
                  className={`phone-modal-pill-btn ${!isVerticalView ? 'active' : ''}`}
                  title="Tampilan Landscape 16:9 Asli"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect width="20" height="14" x="2" y="5" rx="2" ry="2" />
                  </svg>
                  <span>16:9 Asli</span>
                </button>
              </div>
            )}

            {/* Subtitle Toggle (if vertical & subtitled video exists) */}
            {isVerticalView && hasSubtitles && (
              <button
                type="button"
                onClick={handleToggleSub}
                className={`phone-modal-pill-btn ${isSubOn ? 'sub-active' : ''}`}
                title={isSubOn ? 'Matikan Subtitle' : 'Nyalakan Remotion Subtitle'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="M7 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H7" />
                  <path d="M15 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
                </svg>
                <span>{isSubOn ? '✨ Subtitle ON' : 'Subtitle OFF'}</span>
              </button>
            )}

            {/* Download MP4 */}
            <a
              href={downloadSrc}
              download={downloadFilename}
              className="phone-modal-download-btn"
              title="Download File Video MP4"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="phone-modal-close-btn"
              title="Tutup Preview (ESC)"
              aria-label="Tutup Preview"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Center Phone Chassis Container */}
        <div className="phone-modal-device-container">
          <div className={`phone-modal-device ${isVerticalView ? 'device-9-16' : 'device-16-9'}`}>
            {/* Dynamic Island / Smartphone Notch (Only in 9:16) */}
            {isVerticalView && (
              <div className="phone-modal-dynamic-island">
                <div className="phone-modal-island-camera" />
                <div className="phone-modal-island-sensor" />
              </div>
            )}

            {/* Phone Screen Video Area */}
            <div className="phone-modal-screen">
              <video
                key={`${clip.id}-${isVerticalView ? 'vert' : 'orig'}-${isVerticalView && isSubOn && hasSubtitles ? 'sub' : 'clean'}`}
                src={videoSrc}
                controls
                autoPlay
                playsInline
                className="phone-modal-video-player"
              />
            </div>

            {/* Smartphone Home Indicator bar (Only in 9:16) */}
            {isVerticalView && (
              <div className="phone-modal-home-bar" />
            )}
          </div>
        </div>

        {/* Hint footer */}
        <div className="phone-modal-footer-hint">
          <span>Tekan <kbd>ESC</kbd> atau klik di luar untuk menutup preview</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

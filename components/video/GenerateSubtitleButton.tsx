'use client';

import { useState } from 'react';
import { SubtitleStudioModal } from '../remotion/SubtitleStudioModal';

interface GenerateSubtitleButtonProps {
  clipId: string;
  clipTitle?: string;
  clipRank?: number;
  durationSeconds?: number;
  hasSubtitle: boolean;
  hasClipAsset: boolean;
  hasVertical: boolean;
  isJobRunning?: boolean;
  onJobStarted?: (newJob: any) => void;
}

export function GenerateSubtitleButton({
  clipId,
  clipTitle = 'Clip Video',
  clipRank = 1,
  durationSeconds = 30,
  hasSubtitle,
  hasClipAsset,
  hasVertical,
  isJobRunning = false,
  onJobStarted,
}: GenerateSubtitleButtonProps) {
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const isGenerateDisabled = !hasClipAsset || !hasVertical || isJobRunning;
  const buttonTitle = !hasClipAsset
    ? 'Download klip terlebih dahulu'
    : !hasVertical
      ? 'Lakukan Auto-Crop 9:16 (Face AI) terlebih dahulu agar subtitle dapat di-burn ke video vertikal'
      : 'Buka Remotion Subtitle Studio (Live Preview & Styling)';

  return (
    <>
      <div className="clip-subtitle-action" style={{ display: 'inline-flex', flexDirection: 'column' }}>
        {hasSubtitle ? (
          <div className="clip-subtitle-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div className="clip-badge-pill pill-green">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>9:16 Remotion Subtitles Ready</span>
            </div>
            <button
              onClick={() => setIsStudioOpen(true)}
              disabled={!hasClipAsset || !hasVertical || isJobRunning}
              className="clip-btn-reprocess"
              title="Buka Remotion Subtitle Studio untuk ubah gaya / re-generate"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Subtitle Studio</span>
            </button>
          </div>
        ) : (
          <button
            id={`generate-subtitle-btn-${clipId}`}
            onClick={() => setIsStudioOpen(true)}
            disabled={isGenerateDisabled}
            className="clip-action-pill-btn clip-btn-subtitle"
            style={{
              opacity: (!hasClipAsset || !hasVertical) ? 0.6 : 1,
              cursor: isGenerateDisabled ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
            }}
            title={buttonTitle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="M7 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H7" />
              <path d="M15 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
            </svg>
            <span>{!hasVertical ? 'Subtitle Studio (Perlu Crop 9:16)' : '✨ Remotion Subtitle Studio'}</span>
          </button>
        )}
      </div>

      {isStudioOpen && (
        <SubtitleStudioModal
          clipId={clipId}
          clipTitle={clipTitle}
          clipRank={clipRank}
          durationSeconds={durationSeconds}
          onClose={() => setIsStudioOpen(false)}
          onExportStarted={onJobStarted}
        />
      )}
    </>
  );
}

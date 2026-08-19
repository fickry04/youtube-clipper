'use client';

/**
 * VideoActionsPanel
 *
 * Shows the pipeline actions the user can manually trigger for a video:
 *  1. Download Video (yt-dlp)
 *  2. Fetch Transcript (inline API, no worker)     ← handled by VideoTranscriptSection
 *  3. Analyze Viral Clips (inline Gemini API)      ← handled by AnalyzeTrigger
 *  4. Cut Clips (FFmpeg worker)
 *  5. Generate Subtitles (per-clip, FFmpeg worker)
 *
 * This component covers steps 1 and 4. Step 5 is rendered per-clip in the clip card.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface VideoActionsPanelProps {
  videoId: string;
  /** True if the source video has already been downloaded */
  hasSourceVideo: boolean;
  /** True if viral analysis + clips exist */
  hasAnalysis: boolean;
  /** True if a download or clip job is currently QUEUED/PROCESSING */
  isJobRunning: boolean;
}

export function VideoActionsPanel({
  videoId,
  hasSourceVideo,
  hasAnalysis,
  isJobRunning,
}: VideoActionsPanelProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [cuttingClips, setCuttingClips] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = useCallback(async () => {
    setError('');
    setDownloading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/download`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to start download.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [videoId, router]);

  const handleCutClips = useCallback(async () => {
    setError('');
    setCuttingClips(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/clips`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to start clip cutting.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCuttingClips(false);
    }
  }, [videoId, router]);

  return (
    <div className="video-actions-panel">
      <h2 className="dash-section-title">Pipeline Actions</h2>

      <div className="pipeline-steps">
        {/* Step 1: Download */}
        <div className={`pipeline-step ${hasSourceVideo ? 'step-done' : ''}`}>
          <div className="step-indicator">
            {hasSourceVideo ? (
              <span className="step-check" aria-hidden="true">✓</span>
            ) : (
              <span className="step-num" aria-hidden="true">1</span>
            )}
          </div>

          <div className="step-content">
            <p className="step-title">Download Video</p>
            <p className="step-desc">
              {hasSourceVideo
                ? 'Source video downloaded to local storage.'
                : 'Download the full video via yt-dlp for FFmpeg processing.'}
            </p>

            {!hasSourceVideo && (
              <button
                id="download-video-btn"
                onClick={handleDownload}
                disabled={downloading || isJobRunning}
                className="action-btn action-btn-primary"
              >
                {downloading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    Queuing download…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Video
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Steps 2 & 3 hint (handled by existing components) */}
        <div className={`pipeline-step ${hasAnalysis ? 'step-done' : ''}`}>
          <div className="step-indicator">
            {hasAnalysis ? (
              <span className="step-check" aria-hidden="true">✓</span>
            ) : (
              <span className="step-num" aria-hidden="true">2–3</span>
            )}
          </div>

          <div className="step-content">
            <p className="step-title">Transcript &amp; Analysis</p>
            <p className="step-desc">
              {hasAnalysis
                ? 'Transcript fetched and viral clips identified.'
                : 'Fetch the transcript below, then run the Viral Clip Analysis.'}
            </p>
          </div>
        </div>

        {/* Step 4: Cut Clips */}
        <div className="pipeline-step">
          <div className="step-indicator">
            <span className="step-num" aria-hidden="true">4</span>
          </div>

          <div className="step-content">
            <p className="step-title">Cut Clips with FFmpeg</p>
            <p className="step-desc">
              Requires source video downloaded + analysis completed.
            </p>

            <button
              id="cut-clips-btn"
              onClick={handleCutClips}
              disabled={cuttingClips || isJobRunning || !hasSourceVideo || !hasAnalysis}
              className="action-btn action-btn-secondary"
              title={
                !hasSourceVideo
                  ? 'Download the video first'
                  : !hasAnalysis
                  ? 'Run viral analysis first'
                  : 'Cut clips with FFmpeg'
              }
            >
              {cuttingClips ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Queuing…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <line x1="20" y1="4" x2="8.12" y2="15.88" />
                    <line x1="14.47" y1="14.48" x2="20" y2="20" />
                    <line x1="8.12" y1="8.12" x2="12" y2="12" />
                  </svg>
                  Cut Clips
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">{error}</p>
      )}

      {isJobRunning && (
        <p className="pipeline-hint">
          A job is currently running. Refresh the page to see updates.
        </p>
      )}
    </div>
  );
}

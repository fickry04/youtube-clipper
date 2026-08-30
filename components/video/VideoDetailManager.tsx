'use client';

import { useState, useCallback } from 'react';
import { VideoTranscriptSection } from './VideoTranscriptSection';
import { AnalyzeTrigger } from './AnalyzeTrigger';
import { GenerateSubtitleButton } from './GenerateSubtitleButton';
import { CropFaceButton } from './CropFaceButton';
import { ExpandedPhoneModal } from './ExpandedPhoneModal';
import { PostSocialButton } from '@/components/social/PostSocialButton';
import { JobToast } from './JobToast'; // Import komponen toast baru
import { useJobToasts } from '@/hooks/useJobToasts'; // Import hook baru

import { parseTranscriptSegments } from '@/lib/utils';
import type { JobInfo, ClipInfo, VideoInfo } from '@/lib/types'; // Pindahkan interface ke types.ts
import { useRouter } from 'next/navigation';
import { DeleteClipButton } from './DeleteClipButton';

interface VideoDetailManagerProps {
  initialVideo: VideoInfo;
  videoId: string;
}

export function VideoDetailManager({ initialVideo, videoId }: VideoDetailManagerProps) {
  const [transcript, setTranscript] = useState(initialVideo.transcript);
  const [activeClipAction, setActiveClipAction] = useState<string | null>(null);
  const [videoViews, setVideoViews] = useState<Record<string, 'original' | 'vertical'>>({});
  const [subtitleViews, setSubtitleViews] = useState<Record<string, boolean>>({});
  const [expandedPreviewClip, setExpandedPreviewClip] = useState<ClipInfo | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  // Gunakan custom hook untuk polling dan toast
  const {
    jobs,
    setJobs,
    isJobRunning,
    dismissedToastIds,
    closingToastIds,
    dismissToastWithAnimation
  } = useJobToasts(initialVideo.jobs, videoId);

  // Cari jobs yang relevan
  const cutJob = jobs.find((j) => j.type === 'CREATE_CLIPS');
  const faceJob = jobs.find((j) => j.type === 'FACE_DETECTION');
  const analyzeJob = jobs.find((j) => j.type === 'VIRAL_ANALYSIS');
  const exportVideoJob = jobs.find((j) => j.type === 'EXPORT_VIDEO');
  const manualCropJob = jobs.find((j) => j.type === 'MANUAL_CROP');
  const aiTranscriptJob = jobs.find((j) => j.type === 'AI_TRANSCRIPT');
  const aiPublishJob = jobs.find((j) => j.type === 'SOCIAL_PUBLISH');

  // Handle Cut Clip (per clip)
  const handleCutClips = useCallback(async (targetClipId: string) => {
    setError('');
    setActiveClipAction(targetClipId);

    try {
      const res = await fetch(`/api/videos/${videoId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId: targetClipId }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to start clip download.');
        return;
      }
      if (data.jobId) {
        setJobs((prev) => [
          {
            id: data.jobId,
            type: 'CREATE_CLIPS',
            status: 'QUEUED',
            progress: 5,
            error: null,
            payload: { clipIds: [targetClipId] },
            createdAt: new Date().toISOString(),
            completedAt: null,
          },
          ...prev.filter((j) => j.id !== data.jobId),
        ]);
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActiveClipAction(null);
    }
  }, [videoId]);

  const segments = parseTranscriptSegments(transcript?.segments);
  const hasTranscript = segments.length > 0;
  const viralAnalysis = initialVideo.viralAnalysis;

  const totalClips = viralAnalysis?.clips.length ?? 0;
  const completedClipsCount = viralAnalysis?.clips.filter(
    (c) => c.processingStatus === 'COMPLETED' && c.asset
  ).length ?? 0;
  const clipsCutCompleted = totalClips > 0 && completedClipsCount === totalClips;

  const handleOpenExpandedPreview = useCallback((clip: ClipInfo) => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('video').forEach((v) => {
        try {
          (v as HTMLVideoElement).pause();
        } catch {
          // ignore pause errors
        }
      });
    }
    setExpandedPreviewClip(clip);
  }, []);

  // Array berisi job yang akan dirender sebagai toast
  const activeToasts = [
    aiTranscriptJob, analyzeJob, faceJob, manualCropJob,
    cutJob, exportVideoJob, aiPublishJob
  ].filter(Boolean) as JobInfo[];

  return (
    <div className="video-detail-manager">
      {error && (
        <div className="form-error" style={{ marginBottom: '16px' }} role="alert">
          {error}
        </div>
      )}

      {/* ================= TOAST CONTAINER ================= */}
      <div className="sticky-toast-container">
        {activeToasts.map((job) => (
          !dismissedToastIds[job.id] && (
            <JobToast
              key={job.id}
              job={job}
              isClosing={closingToastIds[job.id] || false}
              onDismiss={dismissToastWithAnimation}
              completedClipsCount={completedClipsCount}
              totalClips={totalClips}
            />
          )
        ))}
      </div>

      {/* =========================================================
          Main Workspace Grid (Always accessible immediately)
      ========================================================= */}
      <div className="video-workspace-grid">
        {/* Left Column: Video & Transcript */}
        <div className="workspace-column">
          <VideoTranscriptSection
            videoId={videoId}
            youtubeId={initialVideo.youtubeId}
            initialSegments={segments}
            initialLanguageCode={transcript?.languageCode ?? ''}
            onTranscriptUpdated={(newSegments, newLang) => {
              setTranscript({
                id: transcript?.id || '',
                languageCode: newLang,
                segments: newSegments,
              });
            }}
          />
        </div>

        {/* Right Column: Viral Analysis & Direct Clip Extraction */}
        <div className="workspace-column">
          <section className="dash-section">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Viral Clip Analysis</h2>
              {clipsCutCompleted ? (
                <span className="header-badge-ready">✓ All {totalClips} Clips Ready</span>
              ) : completedClipsCount > 0 ? (
                <span className="header-badge-ready">{completedClipsCount}/{totalClips} Clips Ready</span>
              ) : null}
            </div>

            {/* Trigger Analysis if not completed */}
            <AnalyzeTrigger
              videoId={videoId}
              hasTranscript={hasTranscript}
              hasAnalysis={Boolean(viralAnalysis)}
              isJobRunning={isJobRunning}
              onJobStarted={(newJob) => {
                setJobs((prev) => [
                  newJob as JobInfo,
                  ...prev.filter((j) => j.id !== newJob.id),
                ]);
              }}
            />

            {viralAnalysis && (
              <div style={{ marginTop: '20px' }}>
                {/* Overall summary */}
                <div className="analysis-summary-card">
                  <p className="analysis-summary-label">Overall Analysis</p>
                  <p className="analysis-summary-text">{viralAnalysis.overallSummary}</p>
                </div>

                {/* Clips list */}
                <div className="clips-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {viralAnalysis.clips.map((clip) => {
                    const cutPayload = cutJob?.payload as { clipIds?: string[]; clipId?: string } | undefined;
                    const isThisClipInCutJob =
                      cutJob &&
                      (cutJob.status === 'QUEUED' || cutJob.status === 'PROCESSING') &&
                      (Array.isArray(cutPayload?.clipIds)
                        ? cutPayload.clipIds.includes(clip.id)
                        : cutPayload?.clipId === clip.id);

                    const isThisClipActive = activeClipAction === clip.id || Boolean(isThisClipInCutJob);
                    const isProcessing = clip.processingStatus === 'PROCESSING' || isThisClipActive;
                    const isCompleted = clip.processingStatus === 'COMPLETED' && !!clip.asset;
                    const isFailed = clip.processingStatus === 'FAILED';

                    // Default to vertical 9:16 if vertical crop is ready, unless user explicitly switched to 'original'
                    const isVerticalView = clip.hasVertical
                      ? videoViews[clip.id] !== 'original'
                      : false;

                    const hasSubtitles = Boolean(clip.hasVerticalSubtitled);
                    const isSubOn = subtitleViews[clip.id] !== undefined ? subtitleViews[clip.id] : hasSubtitles;

                    const currentVideoSrc = isVerticalView
                      ? `/api/clips/${clip.id}/vertical${isSubOn && hasSubtitles ? '?subtitled=true' : ''}`
                      : `/api/clips/${clip.id}/video`;

                    return (
                      <article
                        key={clip.id}
                        className="clip-card"
                        data-rank={clip.rank}
                      >
                        {/* Left Column: Video Mockup / Action */}
                        <div className="clip-card-left">
                          <div
                            className={`clip-video-mockup ${isVerticalView ? 'mode-9-16' : 'mode-16-9'} ${isCompleted ? 'is-clickable' : ''}`}
                            onClick={() => {
                              if (isCompleted) {
                                handleOpenExpandedPreview(clip);
                              }
                            }}
                            title={isCompleted ? "Klik untuk memutar & melihat preview di mode besar" : undefined}
                            role={isCompleted ? "button" : undefined}
                            tabIndex={isCompleted ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleOpenExpandedPreview(clip);
                              }
                            }}
                          >
                            <div className="clip-video-area-inner">
                              {isCompleted ? (
                                <>
                                  <video
                                    key={`${clip.id}-${isVerticalView ? 'vert' : 'orig'}-${isVerticalView && isSubOn && hasSubtitles ? 'sub' : 'clean'}`}
                                    className="clip-video-player"
                                    src={currentVideoSrc}
                                    preload="metadata"
                                    muted
                                    playsInline
                                    aria-label={`Thumbnail Clip ${clip.rank}: ${clip.title}`}
                                  />
                                  <div className="clip-thumbnail-play-overlay">
                                    <div className="clip-thumbnail-play-circle">
                                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="6 3 20 12 6 21 6 3" />
                                      </svg>
                                    </div>
                                    <span className="clip-thumbnail-badge">
                                      {isVerticalView ? '📱 9:16 Shorts' : '🖥️ 16:9'}
                                    </span>
                                  </div>
                                </>
                              ) : isProcessing ? (
                                <div className="clip-video-processing">
                                  <span className="auth-spinner" aria-hidden="true" />
                                  <span style={{ fontSize: '0.8rem', marginTop: '6px' }}>Downloading clip…</span>
                                </div>
                              ) : isFailed ? (
                                <div className="clip-video-failed">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="12" y1="8" x2="12" y2="12" />
                                      <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Download Gagal</span>
                                  </div>

                                  <button
                                    id={`retry-clip-${clip.id}-btn`}
                                    onClick={() => handleCutClips(clip.id)}
                                    disabled={isThisClipActive}
                                    className="cut-clips-btn"
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '6px 12px',
                                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                      borderColor: 'rgba(239, 68, 68, 0.4)',
                                    }}
                                  >
                                    {isThisClipActive ? (
                                      <>
                                        <span className="auth-spinner" aria-hidden="true" />
                                        Downloading…
                                      </>
                                    ) : (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                          <path d="M3 3v5h5" />
                                          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                          <path d="M16 16h5v5" />
                                        </svg>
                                        Download Ulang Clip
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="clip-video-pending">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="12" cy="10" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  <p style={{ fontSize: '0.8rem', margin: '4px 0 8px' }}>Not Downloaded</p>
                                  <button
                                    id={`cut-clip-${clip.id}-btn`}
                                    onClick={() => handleCutClips(clip.id)}
                                    disabled={isJobRunning || isThisClipActive}
                                    className="cut-clips-btn"
                                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                                  >
                                    {isThisClipActive ? (
                                      <>
                                        <span className="auth-spinner" aria-hidden="true" />
                                        Downloading…
                                      </>
                                    ) : (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download Clip
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <PostSocialButton clip={clip} />
                        </div>

                        {/* Right Column: Clip Details */}
                        <div className="clip-card-right">
                          {/* Clip Card Header */}
                          <div className="clip-card-header">
                            <div className="clip-rank-badge">#{clip.rank}</div>
                            <div className="clip-score-wrap">
                              <span className="clip-score">{clip.viralScore}/100</span>
                              <div className="clip-score-bar">
                                <div
                                  className="clip-score-fill"
                                  style={{ width: `${clip.viralScore}%` }}
                                />
                              </div>
                            </div>
                            <span className="clip-duration">{Math.round(clip.durationSeconds)}s</span>
                            {clip.asset && <DeleteClipButton
                              clipId={clip.id}
                              clipTitle={clip.title}
                            />}
                          </div>

                          {/* Clip Time Range */}
                          <div className="clip-timerange">
                            {clip.startTime} → {clip.endTime}
                          </div>

                          {/* Detail Error Worker if failed */}
                          {isFailed && clip.processingError && (
                            <div
                              className="clip-error-alert"
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#fca5a5',
                                fontSize: '0.78rem',
                                marginTop: '10px',
                                marginBottom: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#f87171', marginBottom: '6px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>Detail Error Worker:</span>
                              </div>
                              <pre
                                style={{
                                  margin: 0,
                                  fontSize: '0.72rem',
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  background: 'rgba(0, 0, 0, 0.35)',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  color: '#fecaca',
                                  maxHeight: '120px',
                                  overflowY: 'auto',
                                }}
                              >
                                {clip.processingError}
                              </pre>
                            </div>
                          )}

                          {/* Actions: Face Crop Row (Top) & Subtitle Row (Bottom) */}
                          <div className="clip-actions-container">
                            {/* Row 1: Face Crop & Framing */}
                            <div className="clip-action-row">
                              <div className="clip-action-group">
                                <CropFaceButton
                                  clipId={clip.id}
                                  hasClipAsset={isCompleted}
                                  hasVertical={!!clip.hasVertical}
                                  isJobRunning={isJobRunning}
                                  onJobStarted={(newJob) => {
                                    setJobs((prev) => [
                                      newJob as JobInfo,
                                      ...prev.filter((j) => j.id !== newJob.id),
                                    ]);
                                  }}
                                />
                              </div>

                              {clip.hasVertical && (
                                <div className="segmented-view-toggle">
                                  <button
                                    onClick={() => setVideoViews((prev) => ({ ...prev, [clip.id]: 'vertical' }))}
                                    className={`view-mode-btn ${isVerticalView ? 'active-vert' : ''}`}
                                    title="Tampilkan preview vertikal 9:16 (Shorts/Reels)"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                                    </svg>
                                    <span>9:16</span>
                                  </button>

                                  <button
                                    onClick={() => setVideoViews((prev) => ({ ...prev, [clip.id]: 'original' }))}
                                    className={`view-mode-btn ${!isVerticalView ? 'active-orig' : ''}`}
                                    title="Tampilkan preview horizontal 16:9 (Original)"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <rect width="20" height="14" x="2" y="5" rx="2" ry="2" />
                                    </svg>
                                    <span>16:9</span>
                                  </button>
                                </div>
                              )}

                              {clip.hasVertical && (
                                <a
                                  href={`/api/clips/${clip.id}/vertical${isSubOn && hasSubtitles ? '?subtitled=true' : ''}`}
                                  download={`clip_${clip.rank}_9-16_${isSubOn && hasSubtitles ? 'subtitled_' : ''}${clip.startTime.replace(':', '-')}.mp4`}
                                  className="action-btn action-btn-download-vert"
                                  title={isSubOn && hasSubtitles ? "Download video vertikal 9:16 dengan subtitle" : "Download video vertikal 9:16"}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  <span>Save 9:16 MP4 {isSubOn && hasSubtitles ? '(CC)' : ''}</span>
                                </a>
                              )}

                              {isCompleted && (
                                <a
                                  href={`/api/clips/${clip.id}/video`}
                                  download={`clip_${clip.rank}_16-9_${clip.startTime.replace(':', '-')}.mp4`}
                                  className="action-btn action-btn-secondary action-btn-download-orig"
                                  title="Download video original 16:9"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  <span>Save MP4 (16:9)</span>
                                </a>
                              )}
                            </div>

                            {/* Row 2: Subtitle & Captions (Vertical 9:16 Moving Pill) */}
                            <div className="clip-action-row">
                              <div className="clip-action-group">
                                <GenerateSubtitleButton
                                  clipId={clip.id}
                                  clipTitle={clip.title}
                                  clipRank={clip.rank}
                                  durationSeconds={clip.durationSeconds}
                                  hasSubtitle={hasSubtitles}
                                  hasClipAsset={isCompleted}
                                  hasVertical={Boolean(clip.hasVertical)}
                                  isJobRunning={isJobRunning}
                                  onJobStarted={(newJob) => {
                                    setJobs((prev) => [
                                      newJob as JobInfo,
                                      ...prev.filter((j) => j.id !== newJob.id),
                                    ]);
                                  }}
                                />

                                {clip.hasVertical && hasSubtitles && (
                                  <button
                                    type="button"
                                    onClick={() => setSubtitleViews((prev) => ({ ...prev, [clip.id]: !isSubOn }))}
                                    className={`clip-action-pill-btn ${isSubOn ? 'clip-btn-subtitle' : 'clip-btn-reprocess'}`}
                                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                    title={isSubOn ? 'Preview 9:16 sedang menampilkan subtitle (Klik untuk sembunyikan)' : 'Preview 9:16 tanpa subtitle (Klik untuk aktifkan subtitle)'}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect width="20" height="16" x="2" y="4" rx="2" />
                                      <path d="M7 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H7" />
                                      <path d="M15 10h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
                                    </svg>
                                    <span>Subtitle (9:16): {isSubOn ? 'ON' : 'OFF'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Clip Card Body */}
                          <div className="clip-card-body">
                            <h3 className="clip-title">{clip.title}</h3>

                            {clip.category.length > 0 && (
                              <div className="clip-categories">
                                {clip.category.map((cat) => (
                                  <span key={cat} className="category-tag">
                                    {cat.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="clip-info-rows">
                              <div className="clip-info-row">
                                <span className="clip-info-label">Hook</span>
                                <p className="clip-info-value">{clip.hook}</p>
                              </div>
                              <div className="clip-info-row">
                                <span className="clip-info-label">Summary</span>
                                <p className="clip-info-value">{clip.summary}</p>
                              </div>
                              <div className="clip-info-row">
                                <span className="clip-info-label">Why Viral</span>
                                <p className="clip-info-value">{clip.whyViral}</p>
                              </div>
                            </div>

                            <div className="clip-lists">
                              <div className="clip-list-block clip-list-strengths">
                                <span className="clip-list-label">Strengths</span>
                                {clip.strengths.map((str, idx) => (
                                  <div key={idx} className="clip-list-item">
                                    <span className="clip-list-icon clip-icon-strength">✓</span>
                                    <span>{str}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="clip-list-block clip-list-weaknesses">
                                <span className="clip-list-label">Weaknesses</span>
                                {clip.weaknesses.length > 0 ? (
                                  clip.weaknesses.map((weak, idx) => (
                                    <div key={idx} className="clip-list-item">
                                      <span className="clip-list-icon clip-icon-weakness">⚠</span>
                                      <span>{weak}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="clip-list-item">
                                    <span className="clip-list-icon clip-icon-strength">✓</span>
                                    <span>No weaknesses</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Expanded Smartphone Preview Center Modal */}
      {expandedPreviewClip && (
        <ExpandedPhoneModal
          clip={expandedPreviewClip}
          initialViewMode={videoViews[expandedPreviewClip.id] || (expandedPreviewClip.hasVertical ? 'vertical' : 'original')}
          initialSubOn={subtitleViews[expandedPreviewClip.id] !== undefined ? subtitleViews[expandedPreviewClip.id] : Boolean(expandedPreviewClip.hasVerticalSubtitled)}
          onClose={() => setExpandedPreviewClip(null)}
          onViewModeChange={(clipId, mode) => {
            setVideoViews((prev) => ({ ...prev, [clipId]: mode }));
          }}
          onSubChange={(clipId, isSubOn) => {
            setSubtitleViews((prev) => ({ ...prev, [clipId]: isSubOn }));
          }}
        />
      )}
    </div>
  );
}


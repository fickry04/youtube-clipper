'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VideoTranscriptSection } from './VideoTranscriptSection';
import { AnalyzeTrigger } from './AnalyzeTrigger';
import { GenerateSubtitleButton } from './GenerateSubtitleButton';
import { CropFaceButton } from './CropFaceButton';

interface JobInfo {
  id: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
}

interface ClipInfo {
  id: string;
  rank: number;
  viralScore: number;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  processingStatus: string;
  processingError: string | null;
  title: string;
  category: string[];
  hook: string;
  summary: string;
  whyViral: string;
  strengths: string[];
  weaknesses: string[];
  asset: { id: string; storagePath: string } | null;
  subtitles: { id: string; format: string }[];
  faceDetections?: { id: string }[];
  hasVertical?: boolean;
}

interface VideoInfo {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  projectId: string;
  project: {
    id: string;
    name: string;
  };
  assets: { id: string }[];
  transcript: {
    id: string;
    languageCode: string;
    segments: any[];
  } | null;
  viralAnalysis: {
    id: string;
    overallSummary: string;
    clips: ClipInfo[];
  } | null;
  jobs: JobInfo[];
}

interface VideoDetailManagerProps {
  initialVideo: VideoInfo;
  projectId: string;
  videoId: string;
}

export function VideoDetailManager({
  initialVideo,
  projectId,
  videoId,
}: VideoDetailManagerProps) {
  const router = useRouter();

  const [jobs, setJobs] = useState<JobInfo[]>(initialVideo.jobs);
  const [cuttingAll, setCuttingAll] = useState(false);
  const [activeClipAction, setActiveClipAction] = useState<string | null>(null);
  const [videoViews, setVideoViews] = useState<Record<string, 'original' | 'vertical'>>({});
  const [error, setError] = useState('');

  // Sync state with server-side props updates
  useEffect(() => {
    setJobs(initialVideo.jobs);
  }, [initialVideo.jobs]);

  // Find active jobs
  const cutJob = jobs.find((j) => j.type === 'CREATE_CLIPS');

  const isJobRunning = jobs.some(
    (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
  );

  // Poll job status every 2 seconds if any job is queued/processing
  useEffect(() => {
    if (!isJobRunning) return;

    let timer: ReturnType<typeof setInterval>;

    const pollJobs = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        const data = await res.json();
        if (data.success && data.video && data.video.jobs) {
          const fetchedJobs = data.video.jobs;
          setJobs(fetchedJobs);

          // Check if any previously running job completed or failed
          const wasRunning = jobs.some(
            (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
          );
          const nowRunning = fetchedJobs.some(
            (j: any) => j.status === 'QUEUED' || j.status === 'PROCESSING'
          );

          if (wasRunning && !nowRunning) {
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Error polling video jobs:', err);
      }
    };

    timer = setInterval(pollJobs, 2000);
    return () => clearInterval(timer);
  }, [isJobRunning, videoId, router, jobs]);

  // Handle Cut Clips (single clip or all)
  const handleCutClips = useCallback(async (targetClipId?: string) => {
    setError('');
    if (targetClipId) {
      setActiveClipAction(targetClipId);
    } else {
      setCuttingAll(true);
    }

    try {
      const body = targetClipId ? JSON.stringify({ clipId: targetClipId }) : JSON.stringify({});
      const res = await fetch(`/api/videos/${videoId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to start clip download.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActiveClipAction(null);
      setCuttingAll(false);
    }
  }, [videoId, router]);

  const transcript = initialVideo.transcript;
  const segments = Array.isArray(transcript?.segments) ? transcript.segments : [];
  const hasTranscript = segments.length > 0;
  const viralAnalysis = initialVideo.viralAnalysis;
  const hasAnalysis = !!viralAnalysis && viralAnalysis.clips.length > 0;

  const totalClips = viralAnalysis?.clips.length ?? 0;
  const completedClipsCount = viralAnalysis?.clips.filter(
    (c) => c.processingStatus === 'COMPLETED' && c.asset
  ).length ?? 0;
  const clipsCutCompleted = totalClips > 0 && completedClipsCount === totalClips;

  return (
    <div className="video-detail-manager">
      {error && (
        <div className="form-error" style={{ marginBottom: '16px' }} role="alert">
          {error}
        </div>
      )}

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
            />

            {viralAnalysis && (
              <div style={{ marginTop: '20px' }}>
                {/* Batch Cut Clips Card (When not all clips are cut) */}
                {!clipsCutCompleted && (
                  <div style={{ marginBottom: '24px' }}>
                    {!cutJob || cutJob.status === 'FAILED' ? (
                      <div className="cut-clips-card">
                        <div className="cut-clips-info">
                          <p className="cut-clips-title">Download &amp; Cut All Viral Clips</p>
                          <p className="cut-clips-desc">
                            Directly download the {viralAnalysis.clips.length} selected clip ranges ({viralAnalysis.clips.map((c) => `${c.startTime}-${c.endTime}`).join(', ')}) from YouTube without downloading the full video.
                          </p>
                        </div>
                        <button
                          id="cut-all-clips-btn"
                          onClick={() => handleCutClips()}
                          disabled={cuttingAll || isJobRunning}
                          className="cut-clips-btn"
                        >
                          {cuttingAll ? (
                            <>
                              <span className="auth-spinner" aria-hidden="true" />
                              Starting…
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
                              Cut All Clips
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="progress-container" style={{ maxWidth: '100%', marginBottom: '24px' }}>
                        <div className="progress-info">
                          <span className="progress-label">
                            {cutJob.status === 'QUEUED' ? 'Queued in clipper worker…' : 'Downloading & cutting clip ranges…'}
                          </span>
                          <span className="progress-value">{cutJob.progress}%</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${cutJob.progress}%`, background: 'var(--accent-gradient-warm)' }}
                          >
                            <div className="progress-fill-stripes" />
                          </div>
                        </div>
                      </div>
                    )}

                    {cutJob?.status === 'FAILED' && cutJob.error && (
                      <p className="form-error" role="alert" style={{ marginTop: '8px' }}>
                        Clipping failed: {cutJob.error}
                      </p>
                    )}
                  </div>
                )}

                {/* Overall summary */}
                <div className="analysis-summary-card">
                  <p className="analysis-summary-label">Overall Analysis</p>
                  <p className="analysis-summary-text">{viralAnalysis.overallSummary}</p>
                </div>

                {/* Clips list */}
                <div className="clips-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {viralAnalysis.clips.map((clip) => {
                    const isThisClipActive = activeClipAction === clip.id;
                    const isProcessing = clip.processingStatus === 'PROCESSING' || (cutJob?.status === 'PROCESSING' && clip.processingStatus === 'PENDING') || isThisClipActive;
                    const isCompleted = clip.processingStatus === 'COMPLETED' && !!clip.asset;
                    const isFailed = clip.processingStatus === 'FAILED';

                    const isVerticalView = videoViews[clip.id] === 'vertical' && !!clip.hasVertical;
                    const currentVideoSrc = isVerticalView
                      ? `/api/clips/${clip.id}/vertical`
                      : `/api/clips/${clip.id}/video`;

                    return (
                      <article
                        key={clip.id}
                        className="clip-card"
                        data-rank={clip.rank}
                      >
                        {/* Left Column: Video Mockup / Action */}
                        <div className="clip-card-left">
                          <div className="clip-video-mockup">
                            <div
                              className="clip-video-area-inner"
                              style={isVerticalView ? { display: 'flex', justifyContent: 'center', background: '#000' } : undefined}
                            >
                              {isCompleted ? (
                                <video
                                  key={`${clip.id}-${isVerticalView ? 'vert' : 'orig'}`}
                                  controls
                                  className="clip-video-player"
                                  style={isVerticalView ? { maxHeight: '280px', width: 'auto', aspectRatio: '9/16', objectFit: 'contain' } : undefined}
                                  src={currentVideoSrc}
                                  preload="metadata"
                                  aria-label={`Clip ${clip.rank}: ${clip.title}`}
                                />
                              ) : isProcessing ? (
                                <div className="clip-video-processing">
                                  <span className="auth-spinner" aria-hidden="true" />
                                  <span style={{ fontSize: '0.8rem', marginTop: '6px' }}>Downloading clip…</span>
                                </div>
                              ) : isFailed ? (
                                <div className="clip-video-failed">
                                  <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Download Failed</p>
                                  {clip.processingError && (
                                    <p className="clip-error-detail" style={{ fontSize: '0.7rem' }}>
                                      {clip.processingError}
                                    </p>
                                  )}
                                  <button
                                    onClick={() => handleCutClips(clip.id)}
                                    disabled={isJobRunning || isThisClipActive}
                                    className="form-submit-btn"
                                    style={{ marginTop: '8px', fontSize: '0.75rem', padding: '4px 8px' }}
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : (
                                <div className="clip-video-pending">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
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
                          </div>

                          {/* Clip Time Range */}
                          <div className="clip-timerange">
                            {clip.startTime} → {clip.endTime}
                          </div>

                          {/* Actions: Subtitle, Face Crop & Direct Downloads */}
                          <div className="clip-subtitle-row" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <GenerateSubtitleButton
                              clipId={clip.id}
                              hasSubtitle={clip.subtitles.some((s) => s.format === 'srt')}
                              hasClipAsset={isCompleted}
                            />

                            <CropFaceButton
                              clipId={clip.id}
                              hasClipAsset={isCompleted}
                              hasVertical={!!clip.hasVertical}
                              isJobRunning={isJobRunning}
                            />

                            {clip.hasVertical && (
                              <button
                                onClick={() => setVideoViews((prev) => ({
                                  ...prev,
                                  [clip.id]: prev[clip.id] === 'vertical' ? 'original' : 'vertical',
                                }))}
                                className="action-btn action-btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                title="Ganti tampilan player antara 16:9 dan 9:16"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                                </svg>
                                <span>{videoViews[clip.id] === 'vertical' ? 'View 16:9' : 'View 9:16'}</span>
                              </button>
                            )}

                            {isCompleted && (
                              <a
                                href={`/api/clips/${clip.id}/video`}
                                download={`clip_${clip.rank}_${clip.startTime.replace(':', '-')}.mp4`}
                                className="action-btn action-btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '6px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Save MP4
                              </a>
                            )}

                            {clip.hasVertical && (
                              <a
                                href={`/api/clips/${clip.id}/vertical`}
                                download={`clip_${clip.rank}_9-16_${clip.startTime.replace(':', '-')}.mp4`}
                                className="action-btn action-btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '6px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                                  <path d="M12 18h.01" />
                                </svg>
                                Save 9:16 MP4
                              </a>
                            )}
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
    </div>
  );
}


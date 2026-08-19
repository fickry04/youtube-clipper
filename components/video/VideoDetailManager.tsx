'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VideoTranscriptSection } from './VideoTranscriptSection';
import { AnalyzeTrigger } from './AnalyzeTrigger';
import { GenerateSubtitleButton } from './GenerateSubtitleButton';

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
  const [downloading, setDownloading] = useState(false);
  const [cuttingClips, setCuttingClips] = useState(false);
  const [error, setError] = useState('');

  // Sync state with server-side props updates
  useEffect(() => {
    setJobs(initialVideo.jobs);
  }, [initialVideo.jobs]);

  // Find active jobs
  const downloadJob = jobs.find((j) => j.type === 'DOWNLOAD_VIDEO');
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

  // Handle Download trigger
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

  // Handle Cut Clips trigger
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

  const hasSourceVideo = initialVideo.assets.length > 0;
  const transcript = initialVideo.transcript;
  const segments = transcript?.segments ?? [];
  const hasTranscript = segments.length > 0;
  const viralAnalysis = initialVideo.viralAnalysis;
  const hasAnalysis = !!viralAnalysis && viralAnalysis.clips.length > 0;

  // Determine if clips are currently being cut or are already cut
  const clipsCutCompleted = hasAnalysis && viralAnalysis.clips.every(
    (c) => c.processingStatus === 'COMPLETED'
  );

  return (
    <div className="video-detail-manager">
      {/* =========================================================
          Downloader Section (Shown if no source video available)
      ========================================================= */}
      {!hasSourceVideo && (
        <div className="download-card">
          <div className="download-icon-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          <h2 className="download-title">Download Video Source</h2>
          <p className="download-desc">
            We need to download the source video from YouTube to our server storage before we can process and crop the clips.
          </p>

          {/* Download trigger or progress */}
          {!downloadJob || downloadJob.status === 'FAILED' ? (
            <button
              id="download-video-btn"
              onClick={handleDownload}
              disabled={downloading || isJobRunning}
              className="download-btn"
            >
              {downloading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Starting download…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Start Download
                </>
              )}
            </button>
          ) : (
            <div className="progress-container">
              <div className="progress-info">
                <span className="progress-label">
                  {downloadJob.status === 'QUEUED' ? 'Queued in worker…' : 'Downloading source video…'}
                </span>
                <span className="progress-value">{downloadJob.progress}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${downloadJob.progress}%` }}
                >
                  <div className="progress-fill-stripes" />
                </div>
              </div>
            </div>
          )}

          {/* Job errors */}
          {downloadJob?.status === 'FAILED' && downloadJob.error && (
            <p className="form-error" style={{ marginTop: '12px' }} role="alert">
              Download failed: {downloadJob.error}
            </p>
          )}

          {error && (
            <p className="form-error" style={{ marginTop: '12px' }} role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {/* =========================================================
          Main Workspace Grid (Only shown when source is downloaded)
      ========================================================= */}
      {hasSourceVideo && (
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

          {/* Right Column: Viral Analysis & Clipping */}
          <div className="workspace-column">
            <section className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">Viral Clip Analysis</h2>
                {clipsCutCompleted && (
                  <span className="header-badge-ready">✓ Clips Cut</span>
                )}
              </div>

              {/* Trigger Analysis if not completed */}
              <AnalyzeTrigger
                videoId={videoId}
                hasTranscript={hasTranscript}
              />

              {viralAnalysis && (
                <div style={{ marginTop: '20px' }}>
                  {/* Clip Cutting Card / Loading Bar */}
                  {!clipsCutCompleted && (
                    <div style={{ marginBottom: '24px' }}>
                      {!cutJob || cutJob.status === 'FAILED' ? (
                        <div className="cut-clips-card">
                          <div className="cut-clips-info">
                            <p className="cut-clips-title">Ready to Cut Clips</p>
                            <p className="cut-clips-desc">
                              Run the FFmpeg processor to extract and cut the {viralAnalysis.clips.length} identified clips.
                            </p>
                          </div>
                          <button
                            id="cut-clips-btn"
                            onClick={handleCutClips}
                            disabled={cuttingClips || isJobRunning}
                            className="cut-clips-btn"
                          >
                            {cuttingClips ? (
                              <>
                                <span className="auth-spinner" aria-hidden="true" />
                                Cutting…
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
                      ) : (
                        <div className="progress-container" style={{ maxWidth: '100%', marginBottom: '24px' }}>
                          <div className="progress-info">
                            <span className="progress-label">
                              {cutJob.status === 'QUEUED' ? 'Queued in clipper worker…' : 'FFmpeg cutting clips…'}
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
                        <p className="form-error" role="alert">
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
                    {viralAnalysis.clips.map((clip) => (
                      <article
                        key={clip.id}
                        className="clip-card"
                        data-rank={clip.rank}
                      >
                        {/* Left Column: Smartphone Video Mockup */}
                        <div className="clip-card-left">
                          <div className="clip-video-mockup">
                            <div className="clip-video-area-inner">
                              {clip.processingStatus === 'COMPLETED' && clip.asset ? (
                                <video
                                  controls
                                  className="clip-video-player"
                                  src={`/api/clips/${clip.id}/video`}
                                  preload="metadata"
                                  aria-label={`Clip ${clip.rank}: ${clip.title}`}
                                />
                              ) : clip.processingStatus === 'PROCESSING' || (cutJob?.status === 'PROCESSING' && clip.processingStatus === 'PENDING') ? (
                                <div className="clip-video-processing">
                                  <span className="auth-spinner" aria-hidden="true" />
                                  <span>Processing...</span>
                                </div>
                              ) : clip.processingStatus === 'FAILED' ? (
                                <div className="clip-video-failed">
                                  <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Failed</p>
                                  {clip.processingError && (
                                    <p className="clip-error-detail" style={{ fontSize: '0.7rem' }}>
                                      {clip.processingError}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="clip-video-pending">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Pending Cut</p>
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

                          {/* Subtitle Generation Action */}
                          <div className="clip-subtitle-row" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <GenerateSubtitleButton
                              clipId={clip.id}
                              hasSubtitle={clip.subtitles.some((s) => s.format === 'srt')}
                              hasClipAsset={!!clip.asset && clip.processingStatus === 'COMPLETED'}
                            />
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
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

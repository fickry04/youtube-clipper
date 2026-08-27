'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { VideoTranscriptSection } from './VideoTranscriptSection';
import { AnalyzeTrigger } from './AnalyzeTrigger';
import { GenerateSubtitleButton } from './GenerateSubtitleButton';
import { CropFaceButton } from './CropFaceButton';
import { ExpandedPhoneModal } from './ExpandedPhoneModal';
import { PostSocialButton } from '@/components/social/PostSocialButton';

import type { TranscriptSegment } from '@/lib/types';
import { parseTranscriptSegments } from '@/lib/utils';

export interface JobInfo {
  id: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  payload?: unknown;
  createdAt: Date | string;
  completedAt: Date | string | null;
}

export interface ClipInfo {
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
  hasVerticalSubtitled?: boolean;
}

export interface VideoInfo {
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
  transcript: {
    id: string;
    languageCode: string;
    segments: TranscriptSegment[];
  } | null;
  viralAnalysis: {
    id: string;
    overallSummary: string | null;
    clips: ClipInfo[];
  } | null;
  jobs: JobInfo[];
}

interface VideoDetailManagerProps {
  initialVideo: VideoInfo;
  videoId: string;
}

export function VideoDetailManager({
  initialVideo,
  videoId,
}: VideoDetailManagerProps) {
  const router = useRouter();

  const [jobs, setJobs] = useState<JobInfo[]>(initialVideo.jobs);
  const [transcript, setTranscript] = useState(initialVideo.transcript);
  const [activeClipAction, setActiveClipAction] = useState<string | null>(null);
  const [videoViews, setVideoViews] = useState<Record<string, 'original' | 'vertical'>>({});
  const [subtitleViews, setSubtitleViews] = useState<Record<string, boolean>>({});
  const [expandedPreviewClip, setExpandedPreviewClip] = useState<ClipInfo | null>(null);
  const [error, setError] = useState('');
  const [dismissedToastIds, setDismissedToastIds] = useState<Record<string, boolean>>({});
  const [closingToastIds, setClosingToastIds] = useState<Record<string, boolean>>({});

  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const prevInitialJobsRef = useRef(initialVideo.jobs);
  useEffect(() => {
    if (prevInitialJobsRef.current !== initialVideo.jobs) {
      prevInitialJobsRef.current = initialVideo.jobs;
      setJobs(initialVideo.jobs);
    }
  }, [initialVideo.jobs]);

  // Find active jobs
  const cutJob = jobs.find((j) => j.type === 'CREATE_CLIPS');
  const faceJob = jobs.find((j) => j.type === 'FACE_DETECTION');
  const analyzeJob = jobs.find((j) => j.type === 'VIRAL_ANALYSIS');
  const subtitleJob = jobs.find((j) => j.type === 'GENERATE_SUBTITLE');
  const manualCropJob = jobs.find((j) => j.type === 'MANUAL_CROP');
  const aiTranscriptJob = jobs.find((j) => j.type === 'AI_TRANSCRIPT');

  const isJobRunning = jobs.some(
    (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
  );

  // Helper to dismiss toast with smooth exit animation
  const dismissToastWithAnimation = useCallback((id: string) => {
    setClosingToastIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setDismissedToastIds((prev) => ({ ...prev, [id]: true }));
      setClosingToastIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 350);
  }, []);

  // Automatically dismiss completed jobs after 2 seconds with exit animation
  useEffect(() => {
    const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
    if (completedJobs.length === 0) return;

    const timers = completedJobs.map((job) => {
      if (!dismissedToastIds[job.id] && !closingToastIds[job.id]) {
        return setTimeout(() => {
          dismissToastWithAnimation(job.id);
        }, 2000);
      }
      return null;
    });

    return () => {
      timers.forEach((t) => t && clearTimeout(t));
    };
  }, [jobs, dismissedToastIds, closingToastIds, dismissToastWithAnimation]);

  // Poll job status every 2000ms if any job is queued/processing
  useEffect(() => {
    if (!isJobRunning) return;

    const pollJobs = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        const data = await res.json();
        if (data.success && data.video && data.video.jobs) {
          const fetchedJobs: JobInfo[] = data.video.jobs;

          // Check if any previously running job completed or failed
          const wasRunning = jobsRef.current.some(
            (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
          );
          const nowRunning = fetchedJobs.some(
            (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
          );

          setJobs(fetchedJobs);

          if (wasRunning && !nowRunning) {
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Error polling video jobs:', err);
      }
    };

    const timer = setInterval(pollJobs, 2000);
    return () => clearInterval(timer);
  }, [isJobRunning, videoId, router]);

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
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActiveClipAction(null);
    }
  }, [videoId, router]);

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

  return (
    <div className="video-detail-manager">
      {error && (
        <div className="form-error" style={{ marginBottom: '16px' }} role="alert">
          {error}
        </div>
      )}

      {/* =========================================================
          Sticky Floating Progress Notifications (Bottom Right)
      ========================================================= */}
      <div className="sticky-toast-container">
        {/* AI Transcribing Toast */}
        {aiTranscriptJob && !dismissedToastIds[aiTranscriptJob.id] && (
          <aside
            className={`sticky-progress-toast ${closingToastIds[aiTranscriptJob.id] ? 'toast-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="AI Transcription progress"
          >
            <div className="sticky-toast-header">
              <div className="sticky-toast-title-wrap">
                {aiTranscriptJob.status === 'COMPLETED' ? (
                  <div className="sticky-toast-icon-completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : aiTranscriptJob.status === 'FAILED' ? (
                  <div className="sticky-toast-icon-failed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                ) : (
                  <div className="sticky-toast-icon-processing" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24' }}>
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px', borderTopColor: '#fbbf24' }} />
                  </div>
                )}

                <span className="sticky-toast-title">
                  {aiTranscriptJob.status === 'COMPLETED'
                    ? 'AI Transcription Finished'
                    : aiTranscriptJob.status === 'FAILED'
                      ? 'Transcription Failed'
                      : aiTranscriptJob.status === 'QUEUED'
                        ? 'Queued for Transcription...'
                        : 'Transcripting text from video…'}
                </span>
              </div>

              <button
                onClick={() => dismissToastWithAnimation(aiTranscriptJob.id)}
                className="sticky-toast-close-btn"
                title="Tutup notifikasi"
                aria-label="Close notification"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sticky-toast-body">
              <div className="sticky-toast-info">
                <span className="sticky-toast-status-text">
                  {aiTranscriptJob.status === 'COMPLETED'
                    ? 'Transcripting video completed.'
                    : aiTranscriptJob.status === 'FAILED'
                      ? (aiTranscriptJob.error || 'Failed to transcript video with ai')
                      : 'Processing trancript video with AI'}
                </span>
                <span className="sticky-toast-pct" style={{ color: '#fbbf24' }}>
                  {aiTranscriptJob.status === 'COMPLETED' ? '100%' : `${aiTranscriptJob.progress || 35}%`}
                </span>
              </div>

              <div className="progress-track" style={{ height: '6px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: aiTranscriptJob.status === 'COMPLETED' ? '100%' : `${aiTranscriptJob.progress || 35}%`,
                    background:
                      aiTranscriptJob.status === 'COMPLETED'
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : aiTranscriptJob.status === 'FAILED'
                          ? '#ef4444'
                          : 'linear-gradient(90deg, #f59e0b, #ec4899)',
                  }}
                >
                  {aiTranscriptJob.status !== 'COMPLETED' && aiTranscriptJob.status !== 'FAILED' && (
                    <div className="progress-fill-stripes" />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Viral Analysis Progress Toast */}
        {analyzeJob && !dismissedToastIds[analyzeJob.id] && (
          <aside
            className={`sticky-progress-toast ${closingToastIds[analyzeJob.id] ? 'toast-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="Viral clip analysis progress"
          >
            <div className="sticky-toast-header">
              <div className="sticky-toast-title-wrap">
                {analyzeJob.status === 'COMPLETED' ? (
                  <div className="sticky-toast-icon-completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : analyzeJob.status === 'FAILED' ? (
                  <div className="sticky-toast-icon-failed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                ) : (
                  <div className="sticky-toast-icon-processing" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24' }}>
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px', borderTopColor: '#fbbf24' }} />
                  </div>
                )}

                <span className="sticky-toast-title">
                  {analyzeJob.status === 'COMPLETED'
                    ? 'Analysis Finished'
                    : analyzeJob.status === 'FAILED'
                      ? 'Analysis Failed'
                      : analyzeJob.status === 'QUEUED'
                        ? 'Queued for Gemini AI…'
                        : 'Analyzing Viral Clips (Gemini AI)…'}
                </span>
              </div>

              <button
                onClick={() => dismissToastWithAnimation(analyzeJob.id)}
                className="sticky-toast-close-btn"
                title="Tutup notifikasi"
                aria-label="Close notification"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sticky-toast-body">
              <div className="sticky-toast-info">
                <span className="sticky-toast-status-text">
                  {analyzeJob.status === 'COMPLETED'
                    ? 'Top viral moments identified with scoring & hooks.'
                    : analyzeJob.status === 'FAILED'
                      ? (analyzeJob.error || 'Failed to analyze transcript')
                      : 'Scanning transcript for hooks, peak emotions & virality scores…'}
                </span>
                <span className="sticky-toast-pct" style={{ color: '#fbbf24' }}>
                  {analyzeJob.status === 'COMPLETED' ? '100%' : `${analyzeJob.progress || 35}%`}
                </span>
              </div>

              <div className="progress-track" style={{ height: '6px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: analyzeJob.status === 'COMPLETED' ? '100%' : `${analyzeJob.progress || 35}%`,
                    background:
                      analyzeJob.status === 'COMPLETED'
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : analyzeJob.status === 'FAILED'
                          ? '#ef4444'
                          : 'linear-gradient(90deg, #f59e0b, #ec4899)',
                  }}
                >
                  {analyzeJob.status !== 'COMPLETED' && analyzeJob.status !== 'FAILED' && (
                    <div className="progress-fill-stripes" />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Face AI Crop Progress Toast */}
        {faceJob && !dismissedToastIds[faceJob.id] && (
          <aside
            className={`sticky-progress-toast ${closingToastIds[faceJob.id] ? 'toast-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="Face tracking and vertical crop progress"
          >
            <div className="sticky-toast-header">
              <div className="sticky-toast-title-wrap">
                {faceJob.status === 'COMPLETED' ? (
                  <div className="sticky-toast-icon-completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : faceJob.status === 'FAILED' ? (
                  <div className="sticky-toast-icon-failed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                ) : (
                  <div className="sticky-toast-icon-face">
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                  </div>
                )}

                <span className="sticky-toast-title">
                  {faceJob.status === 'COMPLETED'
                    ? 'Face Crop Finished (9:16 Ready)'
                    : faceJob.status === 'FAILED'
                      ? 'Face Crop Failed'
                      : faceJob.status === 'QUEUED'
                        ? 'Queued in Face AI Worker…'
                        : (faceJob.progress || 0) < 50
                          ? 'Detecting Faces & Speaker…'
                          : (faceJob.progress || 0) < 75
                            ? 'Computing 9:16 Trajectory…'
                            : 'Rendering 9:16 Vertical Video…'}
                </span>
              </div>

              <button
                onClick={() => dismissToastWithAnimation(faceJob.id)}
                className="sticky-toast-close-btn"
                title="Tutup notifikasi"
                aria-label="Close notification"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sticky-toast-body">
              <div className="sticky-toast-info">
                <span className="sticky-toast-status-text">
                  {faceJob.status === 'COMPLETED'
                    ? '9:16 vertical crop generated successfully.'
                    : faceJob.status === 'FAILED'
                      ? (faceJob.error || 'Failed to crop vertical video')
                      : (faceJob.progress || 0) < 50
                        ? 'Detecting active speakers & facial landmarks…'
                        : (faceJob.progress || 0) < 75
                          ? 'Smoothing camera framing & trajectory…'
                          : 'Encoding vertical video with FFmpeg…'}
                </span>
                <span className="sticky-toast-pct" style={{ color: '#c084fc' }}>
                  {faceJob.status === 'COMPLETED' ? '100%' : `${faceJob.progress || 0}%`}
                </span>
              </div>

              <div className="progress-track" style={{ height: '6px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: faceJob.status === 'COMPLETED' ? '100%' : `${faceJob.progress || 5}%`,
                    background:
                      faceJob.status === 'COMPLETED'
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : faceJob.status === 'FAILED'
                          ? '#ef4444'
                          : 'linear-gradient(90deg, #6366f1, #a855f7)',
                  }}
                >
                  {faceJob.status !== 'COMPLETED' && faceJob.status !== 'FAILED' && (
                    <div className="progress-fill-stripes" />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Manual Crop Progress Toast */}
        {manualCropJob && !dismissedToastIds[manualCropJob.id] && (
          <aside
            className={`sticky-progress-toast ${closingToastIds[manualCropJob.id] ? 'toast-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="Manual vertical crop progress"
          >
            <div className="sticky-toast-header">
              <div className="sticky-toast-title-wrap">
                {manualCropJob.status === 'COMPLETED' ? (
                  <div className="sticky-toast-icon-completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : manualCropJob.status === 'FAILED' ? (
                  <div className="sticky-toast-icon-failed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                ) : (
                  <div className="sticky-toast-icon-face">
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                  </div>
                )}

                <span className="sticky-toast-title">
                  {manualCropJob.status === 'COMPLETED'
                    ? 'Manual Crop Finished (9:16 Ready)'
                    : manualCropJob.status === 'FAILED'
                      ? 'ManualCrop Failed'
                      : manualCropJob.status === 'QUEUED'
                        ? 'Queued in Manual Crop Worker…'
                        : (manualCropJob.progress || 0) < 99
                          ? 'Cropping video'
                          : 'Rendering 9:16 Vertical Video…'}
                </span>
              </div>

              <button
                onClick={() => dismissToastWithAnimation(manualCropJob.id)}
                className="sticky-toast-close-btn"
                title="Tutup notifikasi"
                aria-label="Close notification"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sticky-toast-body">
              <div className="sticky-toast-info">
                <span className="sticky-toast-status-text">
                  {manualCropJob.status === 'COMPLETED'
                    ? '9:16 vertical crop generated successfully.'
                    : manualCropJob.status === 'FAILED'
                      ? (manualCropJob.error || 'Failed to crop video')
                      : (manualCropJob.progress || 0) < 99
                        ? 'Cropping video...'
                        : 'Encoding vertical video with FFmpeg…'}
                </span>
                <span className="sticky-toast-pct" style={{ color: '#c084fc' }}>
                  {manualCropJob.status === 'COMPLETED' ? '100%' : `${manualCropJob.progress || 0}%`}
                </span>
              </div>

              <div className="progress-track" style={{ height: '6px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: manualCropJob.status === 'COMPLETED' ? '100%' : `${manualCropJob.progress || 5}%`,
                    background:
                      manualCropJob.status === 'COMPLETED'
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : manualCropJob.status === 'FAILED'
                          ? '#ef4444'
                          : 'linear-gradient(90deg, #6366f1, #a855f7)',
                  }}
                >
                  {manualCropJob.status !== 'COMPLETED' && manualCropJob.status !== 'FAILED' && (
                    <div className="progress-fill-stripes" />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Clip Download Progress Toast */}
        {cutJob && !dismissedToastIds[cutJob.id] && (
          <aside
            className={`sticky-progress-toast ${closingToastIds[cutJob.id] ? 'toast-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="Download and clipping progress"
          >
            <div className="sticky-toast-header">
              <div className="sticky-toast-title-wrap">
                {cutJob.status === 'COMPLETED' ? (
                  <div className="sticky-toast-icon-completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : cutJob.status === 'FAILED' ? (
                  <div className="sticky-toast-icon-failed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                ) : (
                  <div className="sticky-toast-icon-processing">
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                  </div>
                )}

                <span className="sticky-toast-title">
                  {cutJob.status === 'COMPLETED'
                    ? 'Download Finished'
                    : cutJob.status === 'FAILED'
                      ? 'Download Failed'
                      : cutJob.status === 'QUEUED'
                        ? 'Queued in Clipper Worker…'
                        : 'Downloading & Cutting Clips…'}
                </span>
              </div>

              <button
                onClick={() => dismissToastWithAnimation(cutJob.id)}
                className="sticky-toast-close-btn"
                title="Tutup notifikasi"
                aria-label="Close notification"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sticky-toast-body">
              <div className="sticky-toast-info">
                <span className="sticky-toast-status-text">
                  {cutJob.status === 'COMPLETED'
                    ? `All ${completedClipsCount || totalClips} clips ready to view and edit`
                    : cutJob.status === 'FAILED'
                      ? (cutJob.error || 'Failed to download clips')
                      : 'Downloading clip ranges directly from YouTube…'}
                </span>
                <span className="sticky-toast-pct">
                  {cutJob.status === 'COMPLETED' ? '100%' : `${cutJob.progress}%`}
                </span>
              </div>

              <div className="progress-track" style={{ height: '6px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: cutJob.status === 'COMPLETED' ? '100%' : `${cutJob.progress}%`,
                    background:
                      cutJob.status === 'COMPLETED'
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : cutJob.status === 'FAILED'
                          ? '#ef4444'
                          : 'var(--accent-gradient-warm)',
                  }}
                >
                  {cutJob.status !== 'COMPLETED' && cutJob.status !== 'FAILED' && (
                    <div className="progress-fill-stripes" />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Subtitle Generation & Burn-in Progress Toast */}
        {subtitleJob && !dismissedToastIds[subtitleJob.id] && (
          <aside
            className={`sticky-progress-toast ${closingToastIds[subtitleJob.id] ? 'toast-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label="Subtitle generation and burn-in progress"
          >
            <div className="sticky-toast-header">
              <div className="sticky-toast-title-wrap">
                {subtitleJob.status === 'COMPLETED' ? (
                  <div className="sticky-toast-icon-completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : subtitleJob.status === 'FAILED' ? (
                  <div className="sticky-toast-icon-failed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                ) : (
                  <div className="sticky-toast-icon-subtitle" style={{ background: 'rgba(34, 197, 94, 0.18)', color: '#4ade80', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px', borderTopColor: '#4ade80' }} />
                  </div>
                )}

                <span className="sticky-toast-title">
                  {subtitleJob.status === 'COMPLETED'
                    ? 'Remotion Animated Video Generated!'
                    : subtitleJob.status === 'FAILED'
                      ? 'Remotion Generation Failed'
                      : subtitleJob.status === 'QUEUED'
                        ? 'Queued in Remotion Worker…'
                        : (subtitleJob.progress || 0) < 25
                          ? 'Checking 9:16 Video & Data…'
                          : (subtitleJob.progress || 0) < 45
                            ? 'Extracting Word Timestamps (AI)…'
                            : (subtitleJob.progress || 0) < 93
                              ? 'Rendering Subtitled Video (Remotion)…'
                              : 'Saving Remotion Animated Video Assets…'}
                </span>
              </div>

              <button
                onClick={() => dismissToastWithAnimation(subtitleJob.id)}
                className="sticky-toast-close-btn"
                title="Tutup notifikasi"
                aria-label="Close notification"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sticky-toast-body">
              <div className="sticky-toast-info">
                <span className="sticky-toast-status-text">
                  {subtitleJob.status === 'COMPLETED'
                    ? '9:16 vertical video with Remotion animated captions rendered successfully.'
                    : subtitleJob.status === 'FAILED'
                      ? (subtitleJob.error || 'Failed to generate subtitle')
                      : (subtitleJob.progress || 0) < 25
                        ? 'Verifying 9:16 vertical video and loading clip transcript…'
                        : (subtitleJob.progress || 0) < 45
                          ? 'Extracting word-level timestamps from clip audio…'
                          : (subtitleJob.progress || 0) < 93
                            ? 'Rendering Remotion animated captions composition…'
                            : 'Saving Remotion subtitled video, SRT, and JSON cues…'}
                </span>
                <span className="sticky-toast-pct" style={{ color: '#4ade80' }}>
                  {subtitleJob.status === 'COMPLETED' ? '100%' : `${subtitleJob.progress || 0}%`}
                </span>
              </div>

              <div className="progress-track" style={{ height: '6px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: subtitleJob.status === 'COMPLETED' ? '100%' : `${subtitleJob.progress || 5}%`,
                    background:
                      subtitleJob.status === 'COMPLETED'
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : subtitleJob.status === 'FAILED'
                          ? '#ef4444'
                          : 'linear-gradient(90deg, #10b981, #34d399)',
                  }}
                >
                  {subtitleJob.status !== 'COMPLETED' && subtitleJob.status !== 'FAILED' && (
                    <div className="progress-fill-stripes" />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}
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

                                <PostSocialButton clip={clip} />
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


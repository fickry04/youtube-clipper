'use client';

import React from 'react';
import type { JobInfo } from '@/lib/types';

interface JobToastProps {
  job: JobInfo;
  isClosing: boolean;
  onDismiss: (id: string) => void;
  completedClipsCount?: number;
  totalClips?: number;
}

// Helper untuk mendapatkan teks dan warna berdasarkan tipe job
const getJobConfig = (job: JobInfo) => {
  switch (job.type) {
    case 'AI_TRANSCRIPT':
      return {
        titles: { COMPLETED: 'AI Transcription Finished', FAILED: 'Transcription Failed', QUEUED: 'Queued for Transcription...', PROCESSING: 'Transcripting text from video…' },
        bodyText: { COMPLETED: 'Transcripting video completed.', FAILED: job.error || 'Failed to transcript video with ai', DEFAULT: 'Processing trancript video with AI' },
        color: '#fbbf24',
        gradient: 'linear-gradient(90deg, #f59e0b, #ec4899)'
      };
    case 'VIRAL_ANALYSIS':
      return {
        titles: { COMPLETED: 'Analysis Finished', FAILED: 'Analysis Failed', QUEUED: 'Queued for Gemini AI…', PROCESSING: 'Analyzing Viral Clips (Gemini AI)…' },
        bodyText: { COMPLETED: 'Top viral moments identified with scoring & hooks.', FAILED: job.error || 'Failed to analyze transcript', DEFAULT: 'Scanning transcript for hooks, peak emotions & virality scores…' },
        color: '#fbbf24',
        gradient: 'linear-gradient(90deg, #f59e0b, #ec4899)'
      };
    case 'FACE_DETECTION':
      return {
        titles: {
          COMPLETED: 'Face Crop Finished (9:16 Ready)',
          FAILED: 'Face Crop Failed',
          QUEUED: 'Queued in Face AI Worker…',
          PROCESSING: (job.progress || 0) < 50 ? 'Detecting Faces & Speaker…' : (job.progress || 0) < 75 ? 'Computing 9:16 Trajectory…' : 'Rendering 9:16 Vertical Video…'
        },
        bodyText: {
          COMPLETED: '9:16 vertical crop generated successfully.',
          FAILED: job.error || 'Failed to crop vertical video',
          DEFAULT: (job.progress || 0) < 50 ? 'Detecting active speakers & facial landmarks…' : (job.progress || 0) < 75 ? 'Smoothing camera framing & trajectory…' : 'Encoding vertical video with FFmpeg…'
        },
        color: '#c084fc', // Warna ungu sesuai kode asli
        gradient: 'linear-gradient(90deg, #6366f1, #a855f7)'
      };
    case 'MANUAL_CROP':
      return {
        titles: {
          COMPLETED: 'Manual Crop Finished (9:16 Ready)',
          FAILED: 'ManualCrop Failed',
          QUEUED: 'Queued in Manual Crop Worker…',
          PROCESSING: (job.progress || 0) < 99 ? 'Cropping video' : 'Rendering 9:16 Vertical Video…'
        },
        bodyText: {
          COMPLETED: '9:16 vertical crop generated successfully.',
          FAILED: job.error || 'Failed to crop video',
          DEFAULT: (job.progress || 0) < 99 ? 'Cropping video...' : 'Encoding vertical video with FFmpeg…'
        },
        color: '#c084fc', // Warna ungu sesuai kode asli
        gradient: 'linear-gradient(90deg, #6366f1, #a855f7)'
      };
    case 'CREATE_CLIPS':
      return {
        titles: { COMPLETED: 'Download Finished', FAILED: 'Download Failed', QUEUED: 'Queued in Clipper Worker…', PROCESSING: 'Downloading & Cutting Clips…' },
        bodyText: {
          COMPLETED: 'All clips ready to view and edit', // Akan di-overwrite di komponen jika ada totalClips
          FAILED: job.error || 'Failed to download clips',
          DEFAULT: 'Downloading clip ranges directly from YouTube…'
        },
        color: '#fbbf24', // Default, di kode asli tidak set warna spesifik (mengikuti CSS)
        gradient: 'var(--accent-gradient-warm)'
      };
    case 'EXPORT_VIDEO':
      return {
        titles: {
          COMPLETED: 'Remotion Animated Video Generated!',
          FAILED: 'Remotion Generation Failed',
          QUEUED: 'Queued in Remotion Worker…',
          PROCESSING: (job.progress || 0) < 25 ? 'Checking 9:16 Video & Data…' : (job.progress || 0) < 45 ? 'Extracting Word Timestamps (AI)…' : (job.progress || 0) < 93 ? 'Rendering Subtitled Video (Remotion)…' : 'Saving Remotion Animated Video Assets…'
        },
        bodyText: {
          COMPLETED: '9:16 vertical video with Remotion animated captions rendered successfully.',
          FAILED: job.error || 'Failed to generate subtitle',
          DEFAULT: (job.progress || 0) < 25 ? 'Verifying 9:16 vertical video and loading clip transcript…' : (job.progress || 0) < 45 ? 'Extracting word-level timestamps from clip audio…' : (job.progress || 0) < 93 ? 'Rendering Remotion animated captions composition…' : 'Saving Remotion subtitled video, SRT, and JSON cues…'
        },
        color: '#4ade80', // Warna hijau sesuai kode asli
        gradient: 'linear-gradient(90deg, #10b981, #34d399)'
      };
    case 'SOCIAL_PUBLISH':
      return {
        titles: {
          COMPLETED: 'Video Posting to Social Media Finished',
          FAILED: 'Video Posting to Social Media Failed',
          QUEUED: 'Queued in Clipper Worker…',
          PROCESSING: 'Posting Clips to Social Media…'
        },
        bodyText: {
          COMPLETED: 'Video Posted Successfully.',
          FAILED: job.error || 'Failed to post Video',
          DEFAULT: (job.progress || 0) < 25 ? 'Verifying video...' : (job.progress || 0) < 45 ? 'Posting to Social Media...' : (job.progress || 0) < 93 ? 'Finishing' : 'Saving...'
        },
        color: '#4ade80', // Warna hijau sesuai kode asli
        gradient: 'var(--accent-gradient-warm)'
      };
    default:
      return {
        titles: { COMPLETED: 'Finished', FAILED: 'Failed', QUEUED: 'Queued…', PROCESSING: 'Processing…' },
        bodyText: { COMPLETED: 'Completed.', FAILED: job.error || 'Failed', DEFAULT: 'Processing…' },
        color: '#fbbf24',
        gradient: 'linear-gradient(90deg, #f59e0b, #ec4899)'
      };
  }
};

export const JobToast: React.FC<JobToastProps> = ({
  job,
  isClosing,
  onDismiss,
  completedClipsCount,
  totalClips
}) => {
  const config = getJobConfig(job);
  const progress = job.status === 'COMPLETED' ? 100 : (job.progress || 5);
  const isProcessing = job.status !== 'COMPLETED' && job.status !== 'FAILED';

  const title = config.titles[job.status as keyof typeof config.titles] || config.titles.PROCESSING;
  let bodyText = config.bodyText[job.status as keyof typeof config.bodyText] || config.bodyText.DEFAULT;

  // Kondisi khusus untuk cut job
  if (job.type === 'CREATE_CLIPS' && job.status === 'COMPLETED' && totalClips) {
    bodyText = `All ${completedClipsCount || totalClips} clips ready to view and edit`;
  }

  return (
    <aside
      className={`sticky-progress-toast ${isClosing ? 'toast-exit' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="sticky-toast-header">
        <div className="sticky-toast-title-wrap">
          {job.status === 'COMPLETED' ? (
            <div className="sticky-toast-icon-completed">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : job.status === 'FAILED' ? (
            <div className="sticky-toast-icon-failed">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          ) : (
            <div className="sticky-toast-icon-processing" style={{ background: 'rgba(245, 158, 11, 0.18)', color: config.color }}>
              <span className="auth-spinner" style={{ width: '13px', height: '13px', borderWidth: '2px', borderTopColor: config.color }} />
            </div>
          )}
          <span className="sticky-toast-title">{title}</span>
        </div>

        <button onClick={() => onDismiss(job.id)} className="sticky-toast-close-btn" title="Tutup notifikasi" aria-label="Close notification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="sticky-toast-body">
        <div className="sticky-toast-info">
          <span className="sticky-toast-status-text">{bodyText}</span>
          <span className="sticky-toast-pct" style={{ color: config.color }}>{progress}%</span>
        </div>
        <div className="progress-track" style={{ height: '6px' }}>
          <div className="progress-fill" style={{ width: `${progress}%`, background: job.status === 'COMPLETED' ? 'linear-gradient(90deg, #10b981, #34d399)' : job.status === 'FAILED' ? '#ef4444' : config.gradient }}>
            {isProcessing && <div className="progress-fill-stripes" />}
          </div>
        </div>
      </div>
    </aside>
  );
};
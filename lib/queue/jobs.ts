import type { CaptionCue, SubtitleStyleConfig } from '@/remotion/types';
import { SocialPlatform } from '../social/platforms';

// Job type definitions for BullMQ queues
// These are used by both the API (to enqueue) and the worker (to process)

export type JobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type JobType =
  | 'DOWNLOAD_VIDEO'
  | 'TRANSCRIPT'
  | 'VIRAL_ANALYSIS'
  | 'CREATE_CLIPS'
  | 'GENERATE_SUBTITLE'
  | 'FACE_DETECTION'
  | 'SOCIAL_PUBLISH';

// Queue names
export const QUEUE_NAMES = {
  VIDEO: 'video',
  TRANSCRIPT: 'transcript',
  ANALYSIS: 'analysis',
  CLIP: 'clip',
  SUBTITLE: 'subtitle',
  FACE_DETECTION: 'face-detection',
  MANUAL_CROP: 'manual-crop',
  AI_TRANSCRIPT: 'ai-transcript',
  SOCIAL_PUBLISH: 'social-publish',
};

// Payloads for each job type

export interface DownloadVideoPayload {
  jobId: string;
  videoId: string;
  userId: string;
  youtubeId: string;
  youtubeUrl: string;
}

export interface TranscriptPayload {
  jobId: string;
  videoId: string;
  userId: string;
  youtubeId: string;
  youtubeUrl: string;
  languageCode?: string;
}

export interface ViralAnalysisPayload {
  jobId: string;
  videoId: string;
  userId: string;
  transcriptId: string;
}

export interface CreateClipsPayload {
  jobId: string;
  videoId: string;
  userId: string;
  viralAnalysisId: string;
  clipIds: string[];
}

export interface GenerateSubtitlePayload {
  jobId: string;
  videoId: string;
  userId: string;
  clipId: string;
  aspectRatio?: '16:9' | '9:16' | 'all';
  cues?: CaptionCue[];
  styleConfig?: SubtitleStyleConfig;
  sttEngine?: 'whisper' | 'gemini';
}


export interface FaceDetectionPayload {
  jobId: string;
  videoId: string;
  userId: string;
  clipId: string;
}

export interface SocialPublishJobPayload {
  clipId: string;
  accountId: string;

  platform: SocialPlatform;

  caption: {
    hook: string;
    description: string;
  };

  videoVariant:
  | 'ORIGINAL'
  | 'VERTICAL'
  | 'VERTICAL_SUBTITLED';
}
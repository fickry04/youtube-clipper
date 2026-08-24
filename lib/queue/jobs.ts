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
  | 'GENERATE_EMBEDDING';

// Queue names
export const QUEUE_NAMES = {
  VIDEO: 'video',
  TRANSCRIPT: 'transcript',
  ANALYSIS: 'analysis',
  CLIP: 'clip',
  SUBTITLE: 'subtitle',
  FACE_DETECTION: 'face-detection',
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
  styleConfig?: any;
}


export interface FaceDetectionPayload {
  jobId: string;
  videoId: string;
  userId: string;
  clipId: string;
}

export interface GenerateEmbeddingPayload {
  jobId: string;
  videoId: string;
  userId: string;
  clipId: string;
}

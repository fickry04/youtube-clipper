'use client';

import { useState, useCallback } from 'react';
import type { JobInfo } from '@/lib/types';

interface AnalyzeTriggerProps {
  videoId: string;
  hasTranscript: boolean;
  hasAnalysis?: boolean;
  isJobRunning?: boolean;
  onJobStarted?: (newJob: JobInfo) => void;
}

export function AnalyzeTrigger({
  videoId,
  hasTranscript,
  hasAnalysis,
  isJobRunning = false,
  onJobStarted,
}: AnalyzeTriggerProps) {

  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isAnalyzed = Boolean(hasAnalysis);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setError('');

    try {
      const res = await fetch(`/api/videos/${videoId}/analyze`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Analysis failed.');
        return;
      }
      if (data.jobId && onJobStarted) {
        onJobStarted({
          id: data.jobId,
          type: 'VIRAL_ANALYSIS',
          status: 'QUEUED',
          progress: 5,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
      }
    } catch {
      setError('Network error.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoId, onJobStarted]);

  const running = isJobRunning || isAnalyzing;

  if (!hasTranscript) {
    return (
      <div className="analyze-trigger analyze-trigger-disabled">
        <p className="analyze-trigger-hint">
          Fetch the transcript first before analyzing.
        </p>
      </div>
    );
  }

  return (
    <div className="analyze-trigger">
      <button
        id="analyze-video-btn"
        onClick={handleAnalyze}
        className="analyze-btn"
        disabled={running}
      >
        {isAnalyzing ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            Analyzing with Gemini…
          </>
        ) : (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>

            {isAnalyzed
              ? 'Re-Analyze Viral Clips'
              : 'Analyze Viral Clips'}
          </>
        )}
      </button>

      {isAnalyzing && (
        <p className="analyze-hint">
          This may take 30–60 seconds for Gemini to analyze the transcript.
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
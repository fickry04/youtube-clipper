'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { JobInfo } from './VideoDetailManager';

interface AnalyzeTriggerProps {
  videoId: string;
  hasTranscript: boolean;
  hasAnalysis?: boolean;
  onJobStarted?: (newJob: JobInfo) => void;
}

export function AnalyzeTrigger({ videoId, hasTranscript, hasAnalysis, onJobStarted }: AnalyzeTriggerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const isAnalyzed = Boolean(hasAnalysis);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const tempJobId = `temp-analyze-${Date.now()}`;
    if (onJobStarted) {
      onJobStarted({
        id: tempJobId,
        type: 'VIRAL_ANALYSIS',
        status: 'PROCESSING',
        progress: 35,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    try {
      const res = await fetch(`/api/videos/${videoId}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Analysis failed.');
        if (data.jobId && onJobStarted) {
          onJobStarted({
            id: data.jobId,
            type: 'VIRAL_ANALYSIS',
            status: 'FAILED',
            progress: 100,
            error: data.error ?? 'Analysis failed.',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          });
        }
        return;
      }

      if (data.jobId && onJobStarted) {
        onJobStarted({
          id: data.jobId,
          type: 'VIRAL_ANALYSIS',
          status: 'COMPLETED',
          progress: 100,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      }

      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setIsLoading(false);
    }
  }, [videoId, router, onJobStarted]);

  if (!hasTranscript) {
    return (
      <div className="analyze-trigger analyze-trigger-disabled">
        <p className="analyze-trigger-hint">Fetch the transcript first before analyzing.</p>
      </div>
    );
  }

  return (
    <div className="analyze-trigger">
      <button
        id="analyze-video-btn"
        onClick={handleAnalyze}
        className="analyze-btn"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            Analyzing with Gemini…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {/*If has analyze then text is Re-Analyze Viral Clips otherwise Analyze Viral Clips */}
            {isAnalyzed ? 'Re-Analyze Viral Clips' : 'Analyze Viral Clips'}
          </>
        )}
      </button>
      {isLoading && (
        <p className="analyze-hint">This may take 30–60 seconds for Gemini to analyze the transcript.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

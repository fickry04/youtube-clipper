'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AnalyzeTriggerProps {
  videoId: string;
  hasTranscript: boolean;
}

export function AnalyzeTrigger({ videoId, hasTranscript }: AnalyzeTriggerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/videos/${videoId}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Analysis failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setIsLoading(false);
    }
  }, [videoId, router]);

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
            Analyze Viral Clips
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

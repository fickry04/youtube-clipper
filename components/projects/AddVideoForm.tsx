'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddVideoFormProps {
  projectId: string;
}

export function AddVideoForm({ projectId }: AddVideoFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!url.trim()) {
      setError('Please enter a YouTube URL.');
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, youtubeUrl: url.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Failed to add video.');
        return;
      }

      setUrl('');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-video-form">
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="add-video-input-row">
        <input
          id="add-video-url-input"
          type="url"
          className="form-input add-video-input"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={isLoading}
        />
        <button
          id="add-video-submit-btn"
          type="submit"
          className="form-submit-btn add-video-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Adding…' : 'Add Video'}
        </button>
      </div>
    </form>
  );
}

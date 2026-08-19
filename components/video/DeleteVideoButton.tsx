'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteVideoButtonProps {
  videoId: string;
  projectId: string;
  videoTitle: string;
  clipCount: number;
}

export function DeleteVideoButton({
  videoId,
  projectId,
  videoTitle,
  clipCount,
}: DeleteVideoButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setError('');
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to delete video.');
        setIsDeleting(false);
        return;
      }
      // Redirect to project page after deletion
      router.push(`/dashboard/projects/${projectId}`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setIsDeleting(false);
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        id="delete-video-btn"
        onClick={() => setShowDialog(true)}
        className="delete-btn"
        aria-label="Delete video"
        title="Delete video"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        Delete Video
      </button>

      {/* Confirmation Dialog */}
      {showDialog && (
        <div
          className="delete-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-video-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setShowDialog(false);
          }}
        >
          <div className="delete-dialog">
            <div className="delete-dialog-icon" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2 id="delete-video-dialog-title" className="delete-dialog-title">
              Delete Video?
            </h2>

            <p className="delete-dialog-desc">
              You&apos;re about to permanently delete{' '}
              <strong>&quot;{videoTitle}&quot;</strong>.
            </p>

            {clipCount > 0 && (
              <div className="delete-dialog-warning">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                This will also delete <strong>{clipCount} clip{clipCount !== 1 ? 's' : ''}</strong> and all associated files.
              </div>
            )}

            <p className="delete-dialog-note">This action cannot be undone.</p>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="delete-dialog-actions">
              <button
                id="delete-video-cancel-btn"
                onClick={() => setShowDialog(false)}
                disabled={isDeleting}
                className="delete-dialog-cancel-btn"
              >
                Cancel
              </button>
              <button
                id="delete-video-confirm-btn"
                onClick={handleDelete}
                disabled={isDeleting}
                className="delete-dialog-confirm-btn"
              >
                {isDeleting ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  'Delete Video'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

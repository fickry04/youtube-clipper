'use client';

import { useState } from 'react';
import { PostToSocialModal } from './PostToSocialModal';

export interface PostableClipInfo {
  id: string;
  rank: number;
  title: string;
  viralScore: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  processingStatus: string;
  hasVertical?: boolean;
}

interface PostSocialButtonProps {
  clip: PostableClipInfo;
}

/**
 * Per-clip action entry point for the social media posting flow.
 * Opens the Post-to-Social prep modal (caption package + upload page links).
 */
export function PostSocialButton({ clip }: PostSocialButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="clip-action-pill-btn clip-btn-social-post"
        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
        title={`Siapkan judul, deskripsi & hashtag lalu posting ke sosial media (Clip #${clip.rank})`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span>Post on Social Media</span>
      </button>

      {modalOpen && <PostToSocialModal clip={clip} onClose={() => setModalOpen(false)} />}
    </>
  );
}

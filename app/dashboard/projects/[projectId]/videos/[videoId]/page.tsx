import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { parseTranscriptSegments } from '@/lib/utils';
import { getStorage, StorageKeys } from '@/lib/storage';

import { VideoDetailManager } from '@/components/video/VideoDetailManager';
import { DeleteVideoButton } from '@/components/video/DeleteVideoButton';

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{
    projectId: string;
    videoId: string;
  }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { projectId, videoId } = await params;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      project: {
        id: projectId,
        userId: session.user.id,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      transcript: true,

      viralAnalysis: {
        include: {
          clips: {
            orderBy: {
              rank: 'asc',
            },
            include: {
              asset: true,
              subtitles: { select: { id: true, format: true } },
              faceDetections: { select: { id: true } },
            },
          },
        },
      },

      jobs: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
    },
  });

  if (!video) {
    notFound();
  }

  const storage = getStorage();
  const clipsWithVertical = await Promise.all(
    (video.viralAnalysis?.clips ?? []).map(async (clip) => {
      const verticalKey = StorageKeys.clipVertical(session.user.id, clip.id);
      const hasVertical = await storage.exists(verticalKey);
      const subtitledVerticalKey = StorageKeys.clipVerticalSubtitled(session.user.id, clip.id);
      const hasVerticalSubtitled = await storage.exists(subtitledVerticalKey);
      return {
        ...clip,
        hasVertical,
        hasVerticalSubtitled,
      };
    })
  );

  const transcript = video.transcript;
  const segments = parseTranscriptSegments(transcript?.segments);
  const hasTranscript = segments.length > 0;
  const viralAnalysis = video.viralAnalysis;

  const videoWithVertical = {
    ...video,
    transcript: video.transcript
      ? {
        ...video.transcript,
        segments,
      }
      : null,
    viralAnalysis: video.viralAnalysis
      ? {
        ...video.viralAnalysis,
        clips: clipsWithVertical,
      }
      : null,
  };

  return (
    <div className="dash-page">
      {/* =========================================================
          Breadcrumb
      ========================================================= */}
      <div className="breadcrumb">
        <Link
          href="/dashboard/projects"
          className="breadcrumb-link"
        >
          Projects
        </Link>

        <span className="breadcrumb-sep">›</span>

        <Link
          href={`/dashboard/projects/${projectId}`}
          className="breadcrumb-link"
        >
          {video.project.name}
        </Link>

        <span className="breadcrumb-sep">›</span>

        <span className="breadcrumb-current">
          {video.title ?? video.youtubeId}
        </span>
      </div>

      {/* =========================================================
          Video Header
      ========================================================= */}
      <div className="video-detail-header-card" style={{ marginBottom: '24px' }}>
        {/* Left: Thumbnail with duration badge & YouTube link overlay */}
        <div className="video-header-thumb-container">
          <div className="video-header-thumb-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
              alt={video.title ?? video.youtubeId}
              className="video-header-thumb-img"
              loading="eager"
            />
            {video.duration ? (
              <span className="video-header-duration-badge">
                {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
              </span>
            ) : null}
            <a
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-header-yt-overlay"
              title="Watch on YouTube"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff0000" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Center: Title, badges, link, description */}
        <div className="video-header-content">
          <div className="video-header-badges">
            <span className="badge badge-purple">
              📁 {video.project.name}
            </span>
            {hasTranscript ? (
              <span className="badge badge-success">
                ✓ {segments.length} Segments
              </span>
            ) : (
              <span className="badge badge-muted">
                No Transcript
              </span>
            )}
            {viralAnalysis && viralAnalysis.clips.length > 0 ? (
              <span className="badge badge-purple" style={{ background: 'rgba(236, 72, 153, 0.15)', borderColor: 'rgba(236, 72, 153, 0.3)', color: '#f472b6' }}>
                ✨ {viralAnalysis.clips.length} Viral Clips
              </span>
            ) : null}
          </div>

          <h1 className="video-header-title">
            {video.title ?? video.youtubeId}
          </h1>

          <div className="video-header-meta-row">
            <a
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-header-url-link"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>{video.youtubeUrl}</span>
            </a>
          </div>

          {video.description && (
            <p className="video-header-desc">
              {video.description.length > 150 ? `${video.description.slice(0, 150)}…` : video.description}
            </p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="video-header-actions">
          <DeleteVideoButton
            videoId={video.id}
            projectId={projectId}
            videoTitle={video.title ?? video.youtubeId}
            clipCount={viralAnalysis?.clips.length ?? 0}
          />
        </div>
      </div>

      {/* =========================================================
          Video Detail Manager (Handles transcript, viral clips, cutting)
      ========================================================= */}
      <VideoDetailManager
        initialVideo={videoWithVertical}
        videoId={video.id}
      />
    </div>
  );
}
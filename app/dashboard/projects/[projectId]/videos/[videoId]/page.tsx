import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { VideoDetailManager } from '@/components/video/VideoDetailManager';

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

      assets: {
        where: { type: 'source' },
        take: 1,
        select: { id: true },
      },

      transcript: {
        include: {
          segments: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },

      viralAnalysis: {
        include: {
          clips: {
            orderBy: {
              rank: 'asc',
            },
            include: {
              asset: true,
              subtitles: { select: { id: true, format: true } },
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

  const transcript = video.transcript;
  const segments = transcript?.segments ?? [];
  const hasTranscript = segments.length > 0;
  const viralAnalysis = video.viralAnalysis;
  const hasSourceVideo = video.assets.length > 0;
  const hasAnalysis = !!viralAnalysis && viralAnalysis.clips.length > 0;
  const isJobRunning = video.jobs.some(
    (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
  );

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
      <div className="video-detail-header" style={{ marginBottom: '24px' }}>
        <div className="video-detail-meta">
          <h1 className="dash-title video-detail-title">
            {video.title ?? video.youtubeId}
          </h1>

          <p className="video-detail-url">
            <a
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-detail-url-link"
            >
              {video.youtubeUrl}
            </a>
          </p>
        </div>
      </div>

      {/* =========================================================
          Video Detail Manager (Handles download, transcript, viral clips, cutting)
      ========================================================= */}
      <VideoDetailManager
        initialVideo={video as any}
        projectId={projectId}
        videoId={video.id}
      />
    </div>
  );
}
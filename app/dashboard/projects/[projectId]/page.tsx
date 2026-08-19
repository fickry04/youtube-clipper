import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { AddVideoForm } from '@/components/projects/AddVideoForm';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: {
      videos: {
        orderBy: { createdAt: 'desc' },
        include: {
          transcript: { select: { id: true } },
          viralAnalysis: {
            select: {
              id: true,
              _count: { select: { clips: true } },
            },
          },
          jobs: {
            where: { status: { in: ['QUEUED', 'PROCESSING'] } },
            take: 1,
            select: { id: true, type: true, status: true },
          },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="dash-page">
      <div className="dash-header">
        <div className="breadcrumb">
          <Link href="/dashboard/projects" className="breadcrumb-link">Projects</Link>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">{project.name}</span>
        </div>
        <h1 className="dash-title">{project.name}</h1>
        {project.description && (
          <p className="dash-subtitle">{project.description}</p>
        )}
      </div>

      {/* Add Video */}
      <section className="dash-section">
        <h2 className="dash-section-title">Add YouTube Video</h2>
        <AddVideoForm projectId={project.id} />
      </section>

      {/* Videos List */}
      <section className="dash-section">
        <h2 className="dash-section-title">
          Videos <span className="section-count">({project.videos.length})</span>
        </h2>
        {project.videos.length === 0 ? (
          <div className="dash-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
            </svg>
            <p>No videos yet. Add your first YouTube video above.</p>
          </div>
        ) : (
          <div className="videos-list">
            {project.videos.map((video) => (
              <Link
                key={video.id}
                href={`/dashboard/projects/${project.id}/videos/${video.id}`}
                className="video-list-item"
              >
                {/* YouTube thumbnail */}
                <div className="video-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title ?? video.youtubeId}
                    className="video-thumb-img"
                    loading="lazy"
                  />
                </div>

                <div className="video-list-info">
                  <h3 className="video-list-title">
                    {video.title ?? video.youtubeId}
                  </h3>
                  <div className="video-list-badges">
                    {video.transcript ? (
                      <span className="badge badge-success">Transcript</span>
                    ) : (
                      <span className="badge badge-muted">No Transcript</span>
                    )}
                    {video.viralAnalysis ? (
                      <span className="badge badge-purple">
                        {video.viralAnalysis._count.clips} Clips Analyzed
                      </span>
                    ) : null}
                    {video.jobs.length > 0 && (
                      <span className="badge badge-warning">
                        {video.jobs[0].type.replace(/_/g, ' ')} in progress…
                      </span>
                    )}
                  </div>
                </div>

                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

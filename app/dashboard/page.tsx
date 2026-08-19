import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [projects, recentJobs] = await Promise.all([
    prisma.project.findMany({
      where: { userId: session.user.id },
      include: { _count: { select: { videos: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.job.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        video: { select: { youtubeId: true, title: true } },
      },
    }),
  ]);

  const totalVideos = projects.reduce((s, p) => s + p._count.videos, 0);

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1 className="dash-title">
          Welcome back, <span className="dash-title-name">{session.user.name || 'Creator'}</span>
        </h1>
        <p className="dash-subtitle">
          Your AI-powered viral clip analysis platform
        </p>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        <div className="stat-card">
          <p className="stat-value">{projects.length}</p>
          <p className="stat-label">Projects</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{totalVideos}</p>
          <p className="stat-label">Videos</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">
            {recentJobs.filter((j) => j.status === 'COMPLETED').length}
          </p>
          <p className="stat-label">Completed Jobs</p>
        </div>
      </div>

      <div className="dash-grid">
        {/* Recent Projects */}
        <section className="dash-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Recent Projects</h2>
            <Link href="/dashboard/projects" className="dash-section-link">
              View all →
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="dash-empty">
              <p>No projects yet.</p>
              <Link href="/dashboard/projects" className="dash-create-btn">
                Create your first project
              </Link>
            </div>
          ) : (
            <div className="project-list">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="project-list-item"
                >
                  <div className="project-list-info">
                    <span className="project-list-name">{p.name}</span>
                    <span className="project-list-count">
                      {p._count.videos} video{p._count.videos !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent Jobs */}
        <section className="dash-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Recent Activity</h2>
          </div>
          {recentJobs.length === 0 ? (
            <div className="dash-empty">
              <p>No activity yet.</p>
            </div>
          ) : (
            <div className="job-list">
              {recentJobs.map((job) => (
                <div key={job.id} className="job-list-item">
                  <div className="job-list-info">
                    <span className="job-list-type">{job.type.replace(/_/g, ' ')}</span>
                    {job.video && (
                      <span className="job-list-video">
                        {job.video.title ?? job.video.youtubeId}
                      </span>
                    )}
                  </div>
                  <span className={`job-status-badge job-status-${job.status.toLowerCase()}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

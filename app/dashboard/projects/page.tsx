import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateProjectForm } from '@/components/projects/CreateProjectForm';

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { videos: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="dash-page">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Projects</h1>
          <p className="dash-subtitle">Organize your YouTube videos by project</p>
        </div>
      </div>

      <div className="projects-layout">
        {/* Create form */}
        <section className="dash-section create-section">
          <h2 className="dash-section-title">New Project</h2>
          <CreateProjectForm />
        </section>

        {/* Project list */}
        <section className="dash-section">
          <h2 className="dash-section-title">
            Your Projects <span className="section-count">({projects.length})</span>
          </h2>
          {projects.length === 0 ? (
            <div className="dash-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M3 7l9 6 9-6" />
              </svg>
              <p>No projects yet. Create your first one.</p>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="project-card"
                >
                  <div className="project-card-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                  </div>
                  <div className="project-card-body">
                    <h3 className="project-card-name">{p.name}</h3>
                    {p.description && (
                      <p className="project-card-desc">{p.description}</p>
                    )}
                    <span className="project-card-count">
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
      </div>
    </div>
  );
}

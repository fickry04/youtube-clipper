import { Navbar } from '@/components/dashboard/Navbar';
import { getSession } from '@/lib/auth/session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession()
  return (
    <div className="dashboard-layout">
      <Navbar user={session?.user ?? null} />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}

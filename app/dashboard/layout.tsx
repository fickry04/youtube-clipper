import type { Metadata } from 'next';
import { Navbar } from '@/components/dashboard/Navbar';

export const metadata: Metadata = {
  title: 'Dashboard — YouTube Viral Clipper',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-layout">
      <Navbar />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}

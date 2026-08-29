import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { SocialAccountsManager } from '@/components/social/SocialAccountsManager';

export default async function SocialAccountsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="social-accounts-page">
      <header className="social-accounts-header">
        <h1 className="social-accounts-title">
          <span className="social-accounts-title-icon">🔗</span>
          Social Media Accounts
        </h1>
        <p className="social-accounts-subtitle">
          Hubungkan akun sosial mediamu di satu tempat. Saat memposting clip, caption AI
          otomatis disesuaikan untuk setiap platform yang kamu pilih.
        </p>
      </header>

      <SocialAccountsManager />
    </div>
  );
}

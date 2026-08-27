'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PLATFORM_META, SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/social/platforms';
import { PlatformIcon } from './SocialIcons';
import { decryptJson } from '@/lib/crypto';

export interface SocialAccountInfo {
  id: string;
  platform: string;
  displayName: string;
  username: string;
  encryptedCredential?: string;
  profileUrl: string | null;
  createdAt: string;
  decryptedCredential?: string;
}

interface SocialAccountsManagerProps {
  initialAccounts: SocialAccountInfo[];
}

const EMPTY_FORM = {
  platform: 'YOUTUBE' as SocialPlatform,
  displayName: '',
  username: '',
  profileUrl: '',
  credential: ''
};

type FormState = typeof EMPTY_FORM;

const pfStyle = (color: string, color2?: string): CSSProperties =>
  ({ '--pf': color, ...(color2 ? { '--pf2': color2 } : {}) }) as CSSProperties;

export function SocialAccountsManager() {
  const [accounts, setAccounts] = useState<SocialAccountInfo[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEffect(() => {
    const loadAccounts = async () => {
      const res = await fetch('/api/social-accounts');

      if (!res.ok) {
        throw new Error('Failed to fetch social accounts');
      }

      const data = await res.json();

      setAccounts(data.accounts as SocialAccountInfo[]);
    };

    loadAccounts();
  }, []);

  const countsByPlatform = useMemo(() => {
    const counts: Partial<Record<SocialPlatform, number>> = {};
    for (const account of accounts) {
      const platform = account.platform as SocialPlatform;
      if (platform in PLATFORM_META) counts[platform] = (counts[platform] ?? 0) + 1;
    }
    return counts;
  }, [accounts]);

  const missingPlatforms = SOCIAL_PLATFORMS.filter((platform) => !countsByPlatform[platform]);

  function flashSuccess(message: string) {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg((current) => (current === message ? '' : current)), 2600);
  }

  function openCreateForm(platform?: SocialPlatform) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, ...(platform ? { platform } : {}) });
    setError('');
    setFormOpen(true);
  }

  async function openEditForm(account: SocialAccountInfo) {
    setEditingId(account.id);
    setForm({
      platform: account.platform as SocialPlatform,
      displayName: account.displayName,
      username: account.username,
      profileUrl: account.profileUrl ?? '',
      credential: account.decryptedCredential ?? '',
    });
    setError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    // Basic client-side validation before hitting the API.
    if (!form.displayName.trim()) return setError('Nama tampilan wajib diisi.');
    if (!form.username.trim()) return setError('Username wajib diisi.');

    setSaving(true);
    setError('');
    try {
      const payload = JSON.stringify(form);
      const isEdit = Boolean(editingId);
      const response = await fetch(
        isEdit ? `/api/social-accounts/${editingId}` : '/api/social-accounts',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan akun.');
      }

      const account = data.account as SocialAccountInfo;
      setAccounts((prev) =>
        isEdit ? prev.map((a) => (a.id === account.id ? account : a)) : [...prev, account]
      );
      closeForm();
      flashSuccess(isEdit ? 'Akun berhasil diperbarui ✨' : `Akun ${PLATFORM_META[account.platform as SocialPlatform].label} terhubung 🎉`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(accountId: string) {
    if (confirmDeleteId !== accountId) {
      setConfirmDeleteId(accountId);
      window.setTimeout(() => setConfirmDeleteId((current) => (current === accountId ? null : current)), 3500);
      return;
    }
    setConfirmDeleteId(null);
    try {
      const response = await fetch(`/api/social-accounts/${accountId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal menghapus akun.');
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      flashSuccess('Akun dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  }

  return (
    <section className="social-manager">
      {/* Platform coverage summary */}
      <div className="social-summary-row">
        {SOCIAL_PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform];
          const count = countsByPlatform[platform] ?? 0;
          return (
            <div key={platform} className={`social-summary-chip ${count > 0 ? 'is-connected' : 'is-empty'}`} style={pfStyle(meta.color)}>
              <span className="social-summary-icon">
                <PlatformIcon platform={platform} size={14} />
              </span>
              <span className="social-summary-label">{meta.shortLabel}</span>
              <span className="social-summary-count">{count > 0 ? `${count} akun` : 'kosong'}</span>
            </div>
          );
        })}
        <button type="button" className="social-add-btn" onClick={() => openCreateForm()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Akun
        </button>
      </div>

      {successMsg && <div className="social-status social-status-success">{successMsg}</div>}
      {error && !formOpen && <div className="form-error">{error}</div>}

      {/* Add / edit form */}
      {formOpen && (
        <form className="social-account-form" onSubmit={handleSubmit}>
          <h2 className="social-form-title">{editingId ? 'Edit Akun' : 'Hubungkan Akun Baru'}</h2>

          <div className="social-platform-picker">
            {SOCIAL_PLATFORMS.map((platform) => {
              const meta = PLATFORM_META[platform];
              const active = form.platform === platform;
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, platform }))}
                  className={`platform-tile ${active ? 'is-active' : ''}`}
                  style={pfStyle(meta.color, meta.color2 ?? meta.color)}
                >
                  <PlatformIcon platform={platform} size={20} />
                  <span>{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="social-form-grid">
            <label className="social-field">
              <span>Nama Tampilan</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="cth. Akun Utama"
                maxLength={60}
              />
            </label>
            <label className="social-field">
              <span>Username</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="@username"
                maxLength={50}
              />
            </label>
            <label className="social-field social-field-wide">
              <span>Link Profil <em>(opsional)</em></span>
              <input
                type="url"
                value={form.profileUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, profileUrl: e.target.value }))}
                placeholder={`https://${PLATFORM_META[form.platform].shortLabel.toLowerCase()}.com/kamu`}
              />
            </label>
            <label className="social-field social-field-wide">
              <span>Credentials</span>
              <input
                type="text"
                value={form.credential}
                onChange={(e) => setForm((prev) => ({ ...prev, credential: e.target.value }))}
                placeholder="place-your-credentials-here"
              />
            </label>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="social-form-actions">
            <button type="submit" className="social-submit-btn" disabled={saving}>
              {saving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Hubungkan Akun'}
            </button>
            <button type="button" className="social-cancel-btn" onClick={closeForm} disabled={saving}>
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Accounts grid */}
      {accounts.length === 0 && !formOpen ? (
        <div className="social-empty-state">
          <div className="social-empty-icon">🌐</div>
          <h3>Belum ada akun sosial media</h3>
          <p>
            Hubungkan minimal satu akun agar tombol <strong>Post on Social Media</strong> bisa
            menyiapkan caption yang pas untuk tiap platform.
          </p>
          <div className="social-empty-missing">
            {missingPlatforms.map((platform) => (
              <button key={platform} type="button" onClick={() => openCreateForm(platform)} style={pfStyle(PLATFORM_META[platform].color)}>
                <PlatformIcon platform={platform} size={13} />
                Hubungkan {PLATFORM_META[platform].shortLabel}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="social-accounts-grid">
          {accounts.map((account) => {
            const platform = account.platform as SocialPlatform;
            const meta = PLATFORM_META[platform];
            return (
              <article key={account.id} className="social-account-card" style={pfStyle(meta.color, meta.color2 ?? meta.color)}>
                <div className="social-card-head">
                  <span className="social-card-icon">
                    <PlatformIcon platform={platform} size={18} />
                  </span>
                  <div className="social-card-title">
                    <strong>{account.displayName}</strong>
                    <span className="social-card-platform">{meta.label}</span>
                  </div>
                </div>
                <div className="social-card-body">
                  <span className="social-card-handle">@{account.username}</span>
                  {account.profileUrl && (
                    <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className="social-card-link">
                      Lihat profil
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
                <div className="social-card-actions">
                  <button type="button" className="social-mini-btn" onClick={() => openEditForm(account)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`social-mini-btn social-mini-danger ${confirmDeleteId === account.id ? 'is-confirming' : ''}`}
                    onClick={() => handleDelete(account.id)}
                  >
                    {confirmDeleteId === account.id ? 'Yakin hapus?' : 'Hapus'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

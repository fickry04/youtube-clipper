'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  PLATFORM_META,
  SOCIAL_PLATFORMS,
  buildFullCaption,
  type PlatformCaption,
  type PlatformCaptionMap,
  type SocialPlatform,
} from '@/lib/social/platforms';
import { PlatformIcon } from './SocialIcons';
import type { SocialAccountInfo } from './SocialAccountsManager';
import type { ClipInfo } from '../video/VideoDetailManager';

interface PostToSocialModalProps {
  clip: ClipInfo;
  onClose: () => void;
}

type Drafts = PlatformCaptionMap;

const pfStyle = (color: string, color2?: string): CSSProperties =>
  ({ '--pf': color, ...(color2 ? { '--pf2': color2 } : {}) }) as CSSProperties;

const emptySubscribe = () => () => { };

/**
 * Guard against duplicate Gemini generations for the same clip — StrictMode
 * double-invokes mount effects in development, and each run costs an API call.
 */
const inFlightGenerations = new Set<string>();

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the execCommand fallback
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function PostToSocialModal({ clip, onClose }: PostToSocialModalProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [accounts, setAccounts] = useState<SocialAccountInfo[] | null>(null);
  const [accountsError, setAccountsError] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loadingCaptions, setLoadingCaptions] = useState(true);
  const [generateError, setGenerateError] = useState('');
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('YOUTUBE');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pause background page videos while the modal is open
  const pausedVideosRef = useRef<HTMLVideoElement[]>([]);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const videos = Array.from(document.querySelectorAll('video'));
      videos.forEach((v) => {
        try {
          if (!v.paused) {
            v.pause();
            pausedVideosRef.current.push(v);
          }
        } catch {
          // ignore pause error
        }
      });
    }
    return () => {
      pausedVideosRef.current.forEach((v) => {
        try {
          v.play().catch(() => undefined);
        } catch {
          // ignore resume error
        }
      });
      pausedVideosRef.current = [];
    };
  }, []);

  // ESC to close + scroll lock (same behavior as ExpandedPhoneModal)
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  // Load connected accounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/social-accounts');
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.success) throw new Error(data.error || 'Gagal memuat akun.');
        const list = data.accounts as SocialAccountInfo[];
        setAccounts(list);
      } catch (err) {
        if (!cancelled) setAccountsError(err instanceof Error ? err.message : 'Gagal memuat akun.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initializeDrafts = useCallback((captions: PlatformCaptionMap) => {
    setDrafts(captions);
    setLoadingCaptions(false);
  }, []);

  const generateCaptions = useCallback(async (): Promise<boolean> => {
    setGenerateError('');
    setLoadingCaptions(true);
    inFlightGenerations.add(clip.id);
    try {
      const response = await fetch(`/api/clips/${clip.id}/social-captions`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal membuat caption.');
      initializeDrafts(data.captions as PlatformCaptionMap);
      return true;
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Gagal membuat caption.');
      return false;
    } finally {
      inFlightGenerations.delete(clip.id);
    }
  }, [clip.id, initializeDrafts]);

  // On open: load cached captions; auto-generate once when there is no cache yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/clips/${clip.id}/social-captions`);
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.success && data.captions) {
          initializeDrafts(data.captions as PlatformCaptionMap);
          return;
        }
      } catch {
        // ignore fetch issues and continue to generation below
      }
      if (!cancelled && !inFlightGenerations.has(clip.id)) {
        await generateCaptions();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  const activeMeta = PLATFORM_META[activePlatform];
  const activeDraft: PlatformCaption =
    drafts[activePlatform] ?? { hook: '', description: '' };

  function updateActiveDraft(patch: Partial<PlatformCaption>) {
    setDrafts((prev) => ({
      ...prev,
      [activePlatform]: { ...activeDraft, ...patch },
    }));
  }

  const composedDescription = activeDraft.description.trim();

  const descChars = composedDescription.length;
  const descPercent = activeMeta.maxDescriptionChars > 0 ? descChars / activeMeta.maxDescriptionChars : 1;
  const descState = descChars > activeMeta.maxDescriptionChars ? 'over' : descPercent >= 0.8 ? 'warn' : '';
  const hookState =
    activeDraft.hook.length > activeMeta.maxHookChars
      ? 'over'
      : activeDraft.hook.length >= activeMeta.maxHookChars * 0.8
        ? 'warn'
        : '';

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    setCopiedKey(ok ? key : null);
    if (ok) window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
  }

  async function handleCopyAndOpen(platform: SocialPlatform) {
    const draft = drafts[platform];
    if (draft) await copyText(buildFullCaption(draft));
    window.open(PLATFORM_META[platform].uploadUrl, '_blank', 'noopener,noreferrer');
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }
  async function handleAutoPublish() {
    if (!activePlatform) return;

    const selectedAccounts = accounts?.filter((account) =>
      selectedAccountIds.has(account.id)
    );

    if (!selectedAccounts?.length) {
      window.alert('Pilih akun tujuan terlebih dahulu.');
      return;
    }

    const draft = drafts[activePlatform];

    if (!draft) {
      window.alert('Caption belum tersedia.');
      return;
    }

    for (const account of selectedAccounts) {
      try {
        const response = await fetch(
          `/api/clips/${clip.id}/publish`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              platform: activePlatform,
              accountId: account.id,
              caption: {
                hook: draft.hook,
                description: draft.description,
              },
            }),
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || 'Gagal memposting video.',
          );
        }

        console.log(
          `${activePlatform} berhasil diposting`,
          data,
        );
      } catch (error) {
        console.error(
          `Gagal posting ${activePlatform}`,
          error,
        );
      }
    }
  }

  const videoSrc = clip.hasVerticalSubtitled
    ? `/api/clips/${clip.id}/vertical?subtitled=true`
    : clip.hasVertical ? `/api/clips/${clip.id}/vertical` : `/api/clips/${clip.id}/video`;
  const downloadFilename = `clip_${clip.rank}_${clip.hasVertical ? '9-16' : '16-9'}_${clip.startTime.replace(':', '-')}.mp4`;

  if (!mounted) return null;

  const selectedCount = selectedAccountIds.size;

  const modalContent = (
    <div className="post-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Post Clip #${clip.rank} ke Sosial Media`}>
      <div className="post-modal-wrapper" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="post-modal-top-bar">
          <div className="post-modal-clip-info">
            <span className="post-modal-rank-badge">#{clip.rank}</span>
            <div className="post-modal-title-block">
              <h3 className="post-modal-title">{clip.title}</h3>
              <p className="post-modal-subtitle">
                {clip.startTime} → {clip.endTime} ({Math.round(clip.durationSeconds)}s) • Viral Score {clip.viralScore}/100
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="phone-modal-close-btn" title="Tutup (ESC)" aria-label="Tutup Modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="post-modal-grid">
          {/* Left: preview + meta */}
          <aside className="post-modal-preview-col">
            <div className={`post-modal-preview ${clip.processingStatus === 'COMPLETED' ? '' : 'is-empty'}`}>
              {clip.processingStatus === 'COMPLETED' ? (
                <video
                  key={`${clip.id}-social`}
                  src={videoSrc}
                  controls
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="post-modal-video"
                />
              ) : (
                <div className="post-modal-preview-placeholder">
                  <span>⏳</span>
                  <p>Video belum selesai diproses.<br />Caption tetap bisa disiapkan sekarang.</p>
                </div>
              )}
            </div>

            {clip.processingStatus === 'COMPLETED' && (
              <a href={videoSrc} download={downloadFilename} className="post-modal-download-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download MP4 ({clip.hasVertical ? '9:16' : '16:9'})
              </a>
            )}

            {/* Connected accounts strip */}
            <div className="post-modal-accounts">
              <div className="post-modal-accounts-head">
                <span>Akun Terhubung</span>
                <a href="/dashboard/accounts" target="_blank" rel="noopener noreferrer">Kelola ↗</a>
              </div>
              {accountsError && <div className="form-error">{accountsError}</div>}
              {accounts === null && !accountsError && <div className="post-modal-accounts-loading">Memuat akun…</div>}
              {accounts !== null && accounts.length === 0 && (
                <div className="post-modal-accounts-empty">
                  Belum ada akun terhubung.{' '}
                  <a href="/dashboard/accounts" target="_blank" rel="noopener noreferrer">Hubungkan sekarang</a>
                </div>
              )}
              {accounts !== null && accounts.length > 0 && (
                <div className="post-modal-account-chips">
                  {accounts.map((account) => {
                    const platform = account.platform as SocialPlatform;
                    const meta = PLATFORM_META[platform];
                    const selected = selectedAccountIds.has(account.id);
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => toggleAccount(account.id)}
                        className={`post-modal-account-chip ${selected ? 'is-selected' : ''}`}
                        style={pfStyle(meta.color)}
                        title={selected ? `Dipilih untuk diposting ke ${meta.label}` : `Klik untuk pilih ${meta.label}`}
                      >
                        <PlatformIcon platform={platform} size={11} />
                        <span>@{account.username}</span>
                        <em>{selected ? '✓' : '+'}</em>
                      </button>
                    );
                  })}
                </div>
              )}
              {accounts !== null && accounts.length > 0 && (
                <p className="post-modal-accounts-hint">{selectedCount} akun dipilih sebagai target posting.</p>
              )}
            </div>
          </aside>

          {/* Right: caption editor */}
          <section className="post-modal-editor-col">
            <div className="post-modal-tabs">
              {SOCIAL_PLATFORMS.map((platform) => {
                const meta = PLATFORM_META[platform];
                const isActive = platform === activePlatform;
                const ready = Boolean(drafts[platform]);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => setActivePlatform(platform)}
                    className={`post-modal-tab ${isActive ? 'is-active' : ''}`}
                    style={pfStyle(meta.color, meta.color2 ?? meta.color)}
                  >
                    <PlatformIcon platform={platform} size={13} />
                    <span>{meta.shortLabel}</span>
                    {ready && <i className="post-modal-tab-dot" />}
                  </button>
                );
              })}
            </div>

            {generateError && (
              <div className="post-modal-generate-error">
                <span>{generateError}</span>
                <button type="button" onClick={() => generateCaptions()}>Coba Lagi</button>
              </div>
            )}

            {loadingCaptions ? (
              <div className="post-modal-skeleton" aria-label="Sedang menyiapkan caption AI">
                <div className="post-modal-skeleton-row is-wide" />
                <div className="post-modal-skeleton-row" />
                <div className="post-modal-skeleton-row" />
                <div className="post-modal-skeleton-chips">
                  <span /><span /><span />
                </div>
                <p className="post-modal-skeleton-hint">
                  ✨ AI sedang menyusun judul hook, deskripsi &amp; hashtag untuk{' '}
                  {SOCIAL_PLATFORMS.length} platform…
                </p>
              </div>
            ) : (
              <>
                <div className="post-field">
                  <div className="post-field-head">
                    <label htmlFor={`hook-${clip.id}-${activePlatform}`}>Judul Hook</label>
                    <span className={`post-char-counter ${hookState}`}>
                      {activeDraft.hook.length}/{activeMeta.maxHookChars}
                    </span>
                  </div>
                  <input
                    id={`hook-${clip.id}-${activePlatform}`}
                    type="text"
                    value={activeDraft.hook}
                    onChange={(e) => updateActiveDraft({ hook: e.target.value })}
                    placeholder="Judul yang bikin orang berhenti scroll…"
                  />
                </div>

                <div className="post-field">
                  <div className="post-field-head">
                    <label htmlFor={`desc-${clip.id}-${activePlatform}`}>Deskripsi</label>
                    <span className={`post-char-counter ${descState}`} title="Termasuk hashtag saat disalin">
                      {descChars}/{activeMeta.maxDescriptionChars}
                      {activePlatform === 'X' ? ' • total gabungan' : ''}
                    </span>
                  </div>
                  <textarea
                    id={`desc-${clip.id}-${activePlatform}`}
                    value={activeDraft.description}
                    onChange={(e) => updateActiveDraft({ description: e.target.value })}
                    rows={4}
                    placeholder="Deskripsi video…"
                  />
                </div>
                <div className="post-copy-row">
                  <button
                    type="button"
                    className={`post-copy-btn ${copiedKey === 'hook' ? 'is-copied' : ''}`}
                    onClick={() => handleCopy(`hook:${activePlatform}`, activeDraft.hook)}
                  >
                    {copiedKey === 'hook' ? '✓ Tersalin' : 'Salin Hook'}
                  </button>
                  <button
                    type="button"
                    className={`post-copy-btn ${copiedKey === 'desc' ? 'is-copied' : ''}`}
                    onClick={() => handleCopy(`desc:${activePlatform}`, composedDescription)}
                  >
                    {copiedKey === 'desc' ? '✓ Tersalin' : 'Salin Deskripsi'}
                  </button>
                  <button
                    type="button"
                    className={`post-copy-btn ${copiedKey === `all:${activePlatform}` ? 'is-copied' : ''}`}
                    onClick={() => handleCopy(`all:${activePlatform}`, buildFullCaption(activeDraft))}
                  >
                    {copiedKey === `all:${activePlatform}` ? '✓ Tersalin' : 'Salin Semua'}
                  </button>
                  <button
                    type="button"
                    className="post-regenerate-btn"
                    onClick={() => generateCaptions()}
                    title="Buat ulang semua caption dengan AI"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <polyline points="21 3 21 9 15 9" />
                    </svg>
                    Regenerate AI
                  </button>
                </div>

                <div className="post-publish-row">
                  <button
                    type="button"
                    className="post-upload-cta"
                    style={pfStyle(activeMeta.color, activeMeta.color2 ?? activeMeta.color)}
                    onClick={() => handleCopyAndOpen(activePlatform)}
                  >
                    <PlatformIcon platform={activePlatform} size={15} />
                    Salin Caption &amp; Buka {activeMeta.shortLabel} ↗
                  </button>
                  <button
                    type="button"
                    className="post-upload-cta"
                    style={pfStyle(
                      activeMeta.color,
                      activeMeta.color2 ?? activeMeta.color,
                    )}
                    onClick={handleAutoPublish}
                  >
                    <PlatformIcon
                      platform={activePlatform}
                      size={15}
                    />
                    Post Video Otomatis
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

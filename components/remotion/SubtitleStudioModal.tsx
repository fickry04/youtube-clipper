'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RemotionPlayerClient } from './RemotionPlayerClient';
import type { CaptionCue, SubtitlePreset, SubtitleStyleConfig } from '@/remotion/types';

interface SubtitleStudioModalProps {
  clipId: string;
  clipTitle: string;
  clipRank: number;
  durationSeconds: number;
  onClose: () => void;
  onExportStarted?: (job: any) => void;
}

const PRESET_OPTIONS: Array<{
  id: SubtitlePreset;
  title: string;
  desc: string;
  icon: string;
  defaultColor: string;
}> = [
  {
    id: 'hormozi',
    title: 'Hormozi Pop',
    desc: 'Bouncy pop-up per kata dengan highlight neon & border tegas',
    icon: '⚡',
    defaultColor: '#FFE600',
  },
  {
    id: 'karaoke',
    title: 'Karaoke Wave',
    desc: 'Efek fluid fill menyala mengikuti alur pengucapan kata',
    icon: '🎤',
    defaultColor: '#00FFCC',
  },
  {
    id: 'minimalist',
    title: 'Minimalist Clean',
    desc: 'Tipografi modern elegan dengan container blur glassmorphism',
    icon: '✨',
    defaultColor: '#38bdf8',
  },
  {
    id: 'beast',
    title: 'Beast Impact',
    desc: 'Teks ekstra tebal, miring dinamis & kontras tinggi',
    icon: '🔥',
    defaultColor: '#FF3366',
  },
];

const COLOR_PALETTE = [
  { label: 'Neon Yellow', hex: '#FFE600' },
  { label: 'Neon Green', hex: '#00FF66' },
  { label: 'Cyan Glow', hex: '#00FFCC' },
  { label: 'Sky Blue', hex: '#38bdf8' },
  { label: 'Hot Pink', hex: '#FF3366' },
  { label: 'Flame Orange', hex: '#FF6600' },
  { label: 'Pure White', hex: '#FFFFFF' },
];

export function SubtitleStudioModal({
  clipId,
  clipTitle,
  clipRank,
  durationSeconds,
  onClose,
  onExportStarted,
}: SubtitleStudioModalProps) {
  const [mounted, setMounted] = useState(false);
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [loadingCues, setLoadingCues] = useState(true);
  const [cuesError, setCuesError] = useState<string | null>(null);

  const [wordsPerPage, setWordsPerPage] = useState<number>(3);
  const [config, setConfig] = useState<SubtitleStyleConfig>({
    preset: 'hormozi',
    fontSize: 52,
    positionY: 75,
    highlightColor: '#FFE600',
    textColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    uppercase: true,
    wordsPerPage: 3,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch word-level cues from API (runs local Whisper if not cached)
  const fetchCues = useCallback(async (wordsCount: number) => {
    setLoadingCues(true);
    setCuesError(null);
    try {
      const res = await fetch(
        `/api/clips/${clipId}/subtitle?format=cues&wordsPerPage=${wordsCount}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.cues)) {
        setCues(data.cues);
        if (data.styleConfig) {
          setConfig((prev) => ({
            ...prev,
            ...data.styleConfig,
          }));
          if (data.styleConfig.wordsPerPage) {
            setWordsPerPage(data.styleConfig.wordsPerPage);
          }
        }
      } else {
        setCuesError(data.error || 'Gagal memuat transkrip klip.');
      }
    } catch {
      setCuesError('Gagal terhubung ke server untuk memuat transkrip.');
    } finally {
      setLoadingCues(false);
    }
  }, [clipId]);

  useEffect(() => {
    fetchCues(wordsPerPage);
  }, [fetchCues, wordsPerPage]);

  const handlePresetSelect = (preset: SubtitlePreset) => {
    const found = PRESET_OPTIONS.find((p) => p.id === preset);
    setConfig((prev) => ({
      ...prev,
      preset,
      highlightColor: found ? found.defaultColor : prev.highlightColor,
      fontSize: preset === 'beast' ? 58 : preset === 'minimalist' ? 42 : 52,
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/subtitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspectRatio: '9:16',
          styleConfig: {
            ...config,
            wordsPerPage,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setExportError(data.error || 'Gagal memulai proses render.');
        return;
      }

      if (onExportStarted && data.jobId) {
        onExportStarted({
          id: data.jobId,
          type: 'GENERATE_SUBTITLE',
          status: 'QUEUED',
          progress: 5,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
      }

      onClose();
    } catch {
      setExportError('Terjadi kesalahan jaringan saat memulai render.');
    } finally {
      setIsExporting(false);
    }
  };

  const videoSrc = `/api/clips/${clipId}/vertical`;

  if (!mounted) return null;

  const modalContent = (
    <div
      className="remotion-studio-portal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="remotion-studio-dialog"
        style={{
          width: '100%',
          maxWidth: '1040px',
          height: 'min(90vh, 760px)',
          maxHeight: '92vh',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '24px',
          boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '1.05rem',
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#ffffff',
                fontWeight: 800,
              }}
            >
              #{clipRank}
            </span>
            <div>
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Remotion Subtitle Studio (9:16 Shorts)
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0 0', maxWidth: '520px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {clipTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Center Content Area */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 280px) 1fr',
            gap: '24px',
            padding: '20px 24px',
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {/* Left Column: Realtime Remotion Player */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{ width: '100%', maxWidth: '240px' }}>
              {loadingCues ? (
                <div
                  style={{
                    aspectRatio: '9/16',
                    backgroundColor: '#050714',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    textAlign: 'center',
                    gap: '12px',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <span className="auth-spinner" style={{ width: '28px', height: '28px' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>Local Whisper AI:</span>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Mengekstrak Word-Level Timestamps langsung dari audio klip…</span>
                </div>
              ) : cuesError ? (
                <div
                  style={{
                    aspectRatio: '9/16',
                    backgroundColor: '#1e1b4b',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    textAlign: 'center',
                    color: '#f87171',
                  }}
                >
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cuesError}</p>
                </div>
              ) : (
                <RemotionPlayerClient
                  videoSrc={videoSrc}
                  durationInSeconds={durationSeconds}
                  cues={cues}
                  styleConfig={{ ...config, wordsPerPage }}
                  autoPlay={false}
                  loop={true}
                />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#10b981', fontWeight: 600 }}>
              <span>✓ Local Whisper Word Timestamps ({cues.length} Cues)</span>
            </div>
          </div>

          {/* Right Column: Customization Controls with Internal Scroll */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {/* 1. Preset Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                Pilih Gaya Animasi Subtitle (Preset)
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                }}
              >
                {PRESET_OPTIONS.map((preset) => {
                  const isSelected = config.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: isSelected
                          ? '2px solid #6366f1'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: isSelected
                          ? 'rgba(99, 102, 241, 0.15)'
                          : 'rgba(30, 41, 59, 0.6)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '1.1rem' }}>{preset.icon}</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                          {preset.title}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0, lineHeight: 1.25 }}>
                        {preset.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Highlight Color Palette */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                Warna Highlight Kata Aktif
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {COLOR_PALETTE.map((c) => {
                  const isSelected = config.highlightColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, highlightColor: c.hex }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        borderRadius: '16px',
                        border: isSelected
                          ? '2px solid #ffffff'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'rgba(30, 41, 59, 0.7)',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: c.hex,
                          boxShadow: `0 0 8px ${c.hex}88`,
                        }}
                      />
                      <span style={{ fontSize: '0.74rem', color: '#e2e8f0', fontWeight: isSelected ? 700 : 500 }}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Sliders: Font Size & Position Y */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '10px 14px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#cbd5e1' }}>Ukuran Font</span>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#6366f1' }}>{config.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="32"
                  max="72"
                  step="2"
                  value={config.fontSize || 52}
                  onChange={(e) => setConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>

              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '10px 14px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#cbd5e1' }}>Posisi Vertikal (Y)</span>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#6366f1' }}>{config.positionY}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="88"
                  step="1"
                  value={config.positionY || 75}
                  onChange={(e) => setConfig((prev) => ({ ...prev, positionY: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>
            </div>

            {/* 4. Words per Screen & Casing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '10px 14px', borderRadius: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Jumlah Kata per Baris
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setWordsPerPage(count)}
                      style={{
                        flex: 1,
                        padding: '5px 0',
                        borderRadius: '6px',
                        border: wordsPerPage === count ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: wordsPerPage === count ? '#6366f1' : 'rgba(15, 23, 42, 0.6)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '10px 14px', borderRadius: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Format Huruf
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, uppercase: true }))}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: '6px',
                      border: config.uppercase ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: config.uppercase ? '#6366f1' : 'rgba(15, 23, 42, 0.6)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                    }}
                  >
                    CAPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, uppercase: false }))}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: '6px',
                      border: !config.uppercase ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: !config.uppercase ? '#6366f1' : 'rgba(15, 23, 42, 0.6)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                    }}
                  >
                    Normal
                  </button>
                </div>
              </div>
            </div>

            {exportError && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                {exportError}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions (Always Sticky & Fully Visible) */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(15, 23, 42, 0.98)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            bottom: 0,
            zIndex: 50,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Batal
          </button>

          <button
            id={`export-remotion-btn-${clipId}`}
            type="button"
            onClick={handleExport}
            disabled={isExporting || loadingCues || cues.length === 0}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '10px 24px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: (isExporting || loadingCues || cues.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (isExporting || loadingCues || cues.length === 0) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            {isExporting ? (
              <>
                <span className="auth-spinner" style={{ width: '14px', height: '14px' }} />
                <span>Memulai Render Remotion…</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export Subtitled Video 9:16 (Remotion HD)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

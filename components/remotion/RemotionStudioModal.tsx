'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { PlayerRef } from '@remotion/player';
import { RemotionPlayerClient } from './RemotionPlayerClient';
import type { CaptionCue, SubtitlePreset, SubtitleStyleConfig, WordTimestamp, TitleCardConfig, TitleCardTemplate, HookTransitionType } from '@/remotion/types';
import { groupWordsIntoCues } from '@/lib/transcript/word-timestamps';
import type { JobInfo } from '@/lib/types';

interface RemotionStudioModalProps {
  clipId: string;
  clipTitle: string;
  clipRank: number;
  durationSeconds: number;
  onClose: () => void;
  onExportStarted?: (job: JobInfo) => void;
  onAITranscriptStarted?: (job: JobInfo) => void;
}

const emptySubscribe = () => () => { };

export const HOOK_TRANSITION_OPTIONS: Array<{
  id: HookTransitionType;
  label: string;
  desc: string;
  icon: string;
}> = [
    { id: 'fade', label: 'Smooth Fade', desc: 'Fade out transparan yang halus', icon: '🌫️' },
    { id: 'slide-up', label: 'Slide Up', desc: 'Meluncur naik ke atas', icon: '⬆️' },
    { id: 'slide-down', label: 'Slide Down', desc: 'Meluncur turun ke bawah', icon: '⬇️' },
    { id: 'zoom-out', label: 'Zoom Out', desc: 'Menyusut ke tengah', icon: '🔍' },
    { id: 'wipe-left', label: 'Wipe Left', desc: 'Tersapu ke sisi kiri', icon: '⬅️' },
    { id: 'flash', label: 'Flash Glow', desc: 'Kilatan cahaya lalu menghilang', icon: '⚡' },
  ];

export const TITLE_CARD_TEMPLATES: Array<{
  id: TitleCardTemplate;
  title: string;
  desc: string;
  badge: string;
  icon: string;
  defaultAccent: string;
}> = [
    {
      id: 'bold-dark',
      title: 'Bold Impact',
      desc: 'Teks ekstra tebal, badge MUST WATCH & aksen kuning neon',
      badge: 'Popular',
      icon: '⚡',
      defaultAccent: '#FFE600',
    },
    {
      id: 'neon-glow',
      title: 'Cyber Neon',
      desc: 'Glow neon cyberpunk dengan glowing border box',
      badge: 'Viral',
      icon: '🔮',
      defaultAccent: '#00FFCC',
    },
    {
      id: 'cinema-slate',
      title: 'Cinema Slate',
      desc: 'Gaya film clapperboard 4K dengan letterbox bars',
      badge: 'Classic',
      icon: '🎬',
      defaultAccent: '#FCD34D',
    },
    {
      id: 'minimal-clean',
      title: 'Minimalist Clean',
      desc: 'Card frosted glass modern dengan tipografi elegan',
      badge: 'Modern',
      icon: '✨',
      defaultAccent: '#38bdf8',
    },
    {
      id: 'fire-impact',
      title: 'Fire Beast',
      desc: 'Slam zoom dinamis, teks miring MrBeast viral style',
      badge: 'High CTR',
      icon: '🔥',
      defaultAccent: '#FF3366',
    },
    {
      id: 'gradient-glass',
      title: 'Aurora Glass',
      desc: 'Gradient mesh aurora lembut dengan floating glass card',
      badge: 'Aesthetic',
      icon: '🌌',
      defaultAccent: '#C084FC',
    },
  ];

const PRESET_OPTIONS: Array<{
  id: SubtitlePreset;
  title: string;
  desc: string;
  icon: string;
  defaultColor: string;
}> = [
    {
      id: 'plain',
      title: 'Standard Plain',
      desc: 'Subtitle polos seragam tanpa highlight per kata, rapi & bersih',
      icon: '📄',
      defaultColor: '#FFFFFF',
    },
    {
      id: 'clean',
      title: 'Modern Clean',
      desc: 'Ukuran font tetap seragam, highlight halus tanpa efek membesar',
      icon: '💎',
      defaultColor: '#FFE600',
    },
    {
      id: 'box-highlight',
      title: 'Marker Badge',
      desc: 'Highlight kotak warna per kata ala podcast, tanpa perbesaran font',
      icon: '🏷️',
      defaultColor: '#FFE600',
    },
    {
      id: 'cinema',
      title: 'Cinema Netflix',
      desc: 'Gaya film & Netflix klasik, bayangan tajam & bersih tanpa box/zoom',
      icon: '🎬',
      defaultColor: '#FFE600',
    },
    {
      id: 'underline',
      title: 'Neon Underline',
      desc: 'Garis bawah neon menyala pada kata aktif, font ukuran konstan',
      icon: '⚡',
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
      id: 'karaoke',
      title: 'Karaoke Wave',
      desc: 'Efek fluid fill menyala mengikuti alur pengucapan kata',
      icon: '🎤',
      defaultColor: '#00FFCC',
    },
    {
      id: 'hormozi',
      title: 'Hormozi Pop',
      desc: 'Bouncy pop-up per kata dengan highlight neon & border tegas',
      icon: '💥',
      defaultColor: '#FFE600',
    },
    {
      id: 'beast',
      title: 'Beast Impact',
      desc: 'Teks ekstra tebal, miring dinamis & kontras tinggi',
      icon: '🔥',
      defaultColor: '#FF3366',
    },
  ];

const FONT_OPTIONS = [
  { id: 'Montserrat', name: 'Montserrat', desc: 'Modern Bold' },
  { id: 'Bebas Neue', name: 'Bebas Neue', desc: 'Tall Condensed' },
  { id: 'Poppins', name: 'Poppins', desc: 'Rounded Soft' },
  { id: 'Oswald', name: 'Oswald', desc: 'Impact Punchy' },
  { id: 'Inter', name: 'Inter', desc: 'Clean Tech' },
  { id: 'Roboto', name: 'Roboto', desc: 'Smooth Sans' },
];

const COLOR_PALETTE = [
  { label: 'Pure White', hex: '#FFFFFF' },
  { label: 'Neon Yellow', hex: '#FFE600' },
  { label: 'Neon Green', hex: '#00FF66' },
  { label: 'Cyan Glow', hex: '#00FFCC' },
  { label: 'Sky Blue', hex: '#38bdf8' },
  { label: 'Soft Gold', hex: '#FCD34D' },
  { label: 'Hot Pink', hex: '#FF3366' },
  { label: 'Flame Orange', hex: '#FF6600' },
  { label: 'Lilac Purple', hex: '#C084FC' },
];

const STT_ENGINE_OPTIONS: Array<{
  id: 'whisper' | 'gemini';
  title: string;
  desc: string;
  badge: string;
  icon: string;
}> = [
    {
      id: 'whisper',
      title: 'Local Whisper',
      desc: 'Whisper.cpp lokal + Gemini Refiner',
      badge: 'Offline / CPU',
      icon: '⚡',
    },
    {
      id: 'gemini',
      title: 'Gemini AI STT',
      desc: 'Google Gemini Multimodal Audio langsung',
      badge: 'Ultra Akurat & Cepat',
      icon: '🤖',
    },
  ];

export function RemotionStudioModal({
  clipId,
  clipTitle,
  clipRank,
  durationSeconds,
  onClose,
  onExportStarted,
  onAITranscriptStarted,
}: RemotionStudioModalProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [rawWords, setRawWords] = useState<WordTimestamp[]>([]);
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [loadingCues, setLoadingCues] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasExistingTranscription, setHasExistingTranscription] = useState(false);
  const [cuesError, setCuesError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'styling' | 'titleCard' | 'editor'>('styling');

  const playerRef = useRef<PlayerRef | null>(null);

  const [wordsPerPage, setWordsPerPage] = useState<number>(3);
  const [titleCardConfig, setTitleCardConfig] = useState<TitleCardConfig>({
    enabled: false,
    mode: 'card',
    title: clipTitle || '',
    subtitle: 'Tonton sampai habis 🔥',
    durationSeconds: 2.5,
    template: 'bold-dark',
    transition: 'fade',
    overlayPosition: 'top',
    textColor: '#FFFFFF',
    accentColor: '#FFE600',
  });

  const [config, setConfig] = useState<SubtitleStyleConfig>({
    preset: 'plain',
    fontFamily: 'Montserrat',
    fontSize: 48,
    positionY: 75,
    highlightColor: '#FFFFFF',
    textColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    uppercase: true,
    wordsPerPage: 3,
    timeOffset: 0,
    sttEngine: 'whisper',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleSeekToCue = (startSeconds: number) => {
    if (playerRef.current) {
      const frame = Math.max(0, Math.round(startSeconds * 30));
      playerRef.current.seekTo(frame);
      playerRef.current.play();
    }
  };

  const updateCueText = (cueIndex: number, newText: string) => {
    setCues((prev) => {
      const next = [...prev];
      const target = next[cueIndex];
      if (!target) return prev;

      const trimmed = newText.trim();
      const rawWordsList = trimmed.split(/\s+/).filter(Boolean);
      const wordCount = rawWordsList.length;
      const duration = Math.max(0.05, target.end - target.start);
      const wordDuration = wordCount > 0 ? duration / wordCount : duration;

      const updatedWords: WordTimestamp[] = rawWordsList.map((w, idx) => ({
        word: w,
        start: Number((target.start + idx * wordDuration).toFixed(3)),
        end: Number((target.start + (idx + 1) * wordDuration).toFixed(3)),
      }));

      next[cueIndex] = {
        ...target,
        text: newText,
        words: updatedWords,
      };
      return next;
    });
  };

  const updateCueTiming = (cueIndex: number, field: 'start' | 'end', newValue: number) => {
    setCues((prev) => {
      const next = [...prev];
      const target = next[cueIndex];
      if (!target) return prev;

      const clampedVal = Number(Math.max(0, Math.min(durationSeconds, newValue)).toFixed(2));
      let newStart = field === 'start' ? clampedVal : target.start;
      let newEnd = field === 'end' ? clampedVal : target.end;

      if (newEnd < newStart + 0.05) {
        if (field === 'start') newEnd = Math.min(durationSeconds, newStart + 0.05);
        else newStart = Math.max(0, newEnd - 0.05);
      }

      const duration = Math.max(0.05, newEnd - newStart);
      const wordsCount = target.words.length || 1;
      const wordDuration = duration / wordsCount;

      const updatedWords: WordTimestamp[] = target.words.map((w, idx) => ({
        ...w,
        start: Number((newStart + idx * wordDuration).toFixed(3)),
        end: Number((newStart + (idx + 1) * wordDuration).toFixed(3)),
      }));

      next[cueIndex] = {
        ...target,
        start: Number(newStart.toFixed(2)),
        end: Number(newEnd.toFixed(2)),
        words: updatedWords,
      };
      return next;
    });
  };

  const handleAddCue = (afterIndex?: number) => {
    setCues((prev) => {
      const next = [...prev];
      let newStart = 0;
      let newEnd = 2.0;

      if (typeof afterIndex === 'number' && next[afterIndex]) {
        newStart = Number((next[afterIndex].end + 0.05).toFixed(2));
        newEnd = Number(Math.min(durationSeconds, newStart + 2.0).toFixed(2));
      } else if (next.length > 0) {
        newStart = Number((next[next.length - 1].end + 0.05).toFixed(2));
        newEnd = Number(Math.min(durationSeconds, newStart + 2.0).toFixed(2));
      }

      const newCue: CaptionCue = {
        id: `manual-cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        start: newStart,
        end: newEnd,
        text: 'Teks baru...',
        words: [
          { word: 'Teks', start: newStart, end: Number((newStart + (newEnd - newStart) / 2).toFixed(3)) },
          { word: 'baru...', start: Number((newStart + (newEnd - newStart) / 2).toFixed(3)), end: newEnd },
        ],
      };

      if (typeof afterIndex === 'number') {
        next.splice(afterIndex + 1, 0, newCue);
      } else {
        next.push(newCue);
      }
      return next;
    });
  };

  const handleDeleteCue = (index: number) => {
    setCues((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRunTranscription = async () => {
    const selectedEngine = config.sttEngine || 'whisper';
    setIsTranscribing(true);
    setCuesError(null);
    try {
      const res = await fetch(
        `/api/clips/${clipId}/subtitle?format=cues&engine=${selectedEngine}&doTrancscribe=true&wordsPerPage=${wordsPerPage}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.cues) && data.cues.length > 0) {
        if (onAITranscriptStarted) {
          onAITranscriptStarted({
            id: data.job.id, // biar keren aja langsung muncul
            type: 'AI_TRANSCRIPT',
            status: 'QUEUED',
            progress: 15,
            error: null,
            createdAt: new Date(data.job.createdAt),
            completedAt: null,
          });
        }
        const extractedWords: WordTimestamp[] = data.cues.flatMap((c: CaptionCue) => c.words || []);
        setRawWords(extractedWords);
        setCues(groupWordsIntoCues(extractedWords, wordsPerPage, durationSeconds));
        setHasExistingTranscription(true);
      } else if (data.success && Array.isArray(data.cues)) {
        setRawWords([]);
        setCues([]);
        setHasExistingTranscription(false);
      } else {
        setCuesError(data.error || 'Gagal menghasilkan transkripsi dengan engine yang dipilih.');
      }
    } catch {
      setCuesError('Gagal terhubung ke server untuk memproses transkripsi audio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Fetch word-level cues from API on initial modal open
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/clips/${clipId}/subtitle?format=cues`);
        const data = await res.json();
        if (ignore) return;
        if (data.success) {
          const hasExisting = Boolean(data.hasExistingSubtitle && Array.isArray(data.cues) && data.cues.length > 0);
          setHasExistingTranscription(hasExisting);

          let initialPageSize = 3;
          if (data.styleConfig) {
            setConfig((prev) => ({
              ...prev,
              ...data.styleConfig,
            }));
            if (data.styleConfig.titleCard) {
              setTitleCardConfig(data.styleConfig.titleCard);
            }
            if (data.styleConfig.wordsPerPage) {
              initialPageSize = data.styleConfig.wordsPerPage;
              setWordsPerPage(initialPageSize);
            }
          }

          if (hasExisting && Array.isArray(data.cues)) {
            const extractedWords: WordTimestamp[] = data.cues.flatMap((c: CaptionCue) => c.words || []);
            setRawWords(extractedWords);
            if (extractedWords.length > 0) {
              setCues(groupWordsIntoCues(extractedWords, initialPageSize, durationSeconds));
            } else {
              setCues(data.cues);
            }
          } else {
            // Keep preview clean and empty when no transcription exists yet
            setRawWords([]);
            setCues([]);
          }
        } else {
          setCuesError(data.error || 'Gagal memuat informasi transkrip.');
        }
      } catch {
        if (!ignore) setCuesError('Gagal terhubung ke server untuk memuat transkrip.');
      } finally {
        if (!ignore) setLoadingCues(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [clipId, durationSeconds]);

  // Instant client-side words-per-page regrouping without network reload
  const handleWordsPerPageChange = (newCount: number) => {
    setWordsPerPage(newCount);
    setConfig((prev) => ({ ...prev, wordsPerPage: newCount }));

    if (rawWords.length > 0) {
      const newCues = groupWordsIntoCues(rawWords, newCount, durationSeconds);
      setCues(newCues);
    } else if (cues.length > 0) {
      const fallbackWords = cues.flatMap((c) => c.words || []);
      if (fallbackWords.length > 0) {
        setRawWords(fallbackWords);
        setCues(groupWordsIntoCues(fallbackWords, newCount, durationSeconds));
      }
    }
  };

  const handlePresetSelect = (preset: SubtitlePreset) => {
    const found = PRESET_OPTIONS.find((p) => p.id === preset);
    setConfig((prev) => ({
      ...prev,
      preset,
      highlightColor: found ? found.defaultColor : prev.highlightColor,
      textColor: preset === 'plain' ? (prev.textColor || '#FFFFFF') : prev.textColor,
      fontSize:
        preset === 'beast'
          ? 58
          : preset === 'minimalist' || preset === 'cinema' || preset === 'plain'
            ? 46
            : preset === 'box-highlight'
              ? 46
              : 50,
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspectRatio: '9:16',
          cues: cues.length > 0 ? cues : undefined,
          styleConfig: {
            ...config,
            wordsPerPage,
            titleCard: titleCardConfig,
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
      onClick={(e) => e.stopPropagation()}
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
                Remotion Studio (9:16 Shorts)
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
            {/* 9:16 Video Player or Loading Skeleton */}
            <div style={{ width: '100%', maxWidth: '240px', position: 'relative' }}>
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
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>Memeriksa Subtitle…</span>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Memuat status transkripsi klip video…</span>
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
                <div style={{ position: 'relative' }}>
                  <RemotionPlayerClient
                    playerRef={playerRef}
                    videoSrc={videoSrc}
                    durationInSeconds={durationSeconds}
                    cues={cues}
                    styleConfig={{ ...config, wordsPerPage, titleCard: titleCardConfig }}
                    autoPlay={false}
                    loop={true}
                  />
                  {cues.length === 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '10px',
                        right: '10px',
                        backgroundColor: 'rgba(15, 23, 42, 0.88)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '8px',
                        padding: '8px',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 600, display: 'block', lineHeight: 1.25 }}>
                        ⚠️ Belum ada transkripsi kata. Klik tombol &apos;Mulai Transkripsi Audio&apos; di samping.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customization Controls & Interactive Editor with Internal Scroll */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {/* Tab Navigation */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '4px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('styling')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'styling' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: activeTab === 'styling' ? '#ffffff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'styling' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'styling' ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🎨</span>
                <span>Gaya Subtitle</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('titleCard')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'titleCard' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: activeTab === 'titleCard' ? '#ffffff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'titleCard' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'titleCard' ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🎬</span>
                <span>Intro Hook Title</span>
                {titleCardConfig.enabled && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '1px 5px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(34, 197, 94, 0.25)',
                      border: '1px solid rgba(34, 197, 94, 0.5)',
                      color: '#4ade80',
                      fontWeight: 800,
                    }}
                  >
                    ON
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'editor' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: activeTab === 'editor' ? '#ffffff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'editor' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'editor' ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>📝</span>
                <span>Edit Transkrip</span>
                {cues.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(99, 102, 241, 0.4)',
                      color: '#e0e7ff',
                      fontWeight: 700,
                    }}
                  >
                    {cues.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'styling' && (
              <>
                {/* 0. STT Engine Selector */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                      Pilihan Engine Transkripsi (Speech-to-Text)
                    </label>
                    {hasExistingTranscription && cues.length > 0 ? (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#4ade80',
                          backgroundColor: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        ✓ Transkripsi Tersedia
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#facc15',
                          backgroundColor: 'rgba(234, 179, 8, 0.12)',
                          border: '1px solid rgba(234, 179, 8, 0.25)',
                          padding: '2px 7px',
                          borderRadius: '6px',
                        }}
                      >
                        ⚠️ Belum Ditranskripsi
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {STT_ENGINE_OPTIONS.map((eng) => {
                      const isSelected = (config.sttEngine || 'whisper') === eng.id;
                      return (
                        <button
                          key={eng.id}
                          type="button"
                          disabled={isTranscribing}
                          onClick={() => setConfig((prev) => ({ ...prev, sttEngine: eng.id }))}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: isSelected
                              ? '2px solid #8b5cf6'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            backgroundColor: isSelected
                              ? 'rgba(139, 92, 246, 0.18)'
                              : 'rgba(30, 41, 59, 0.5)',
                            textAlign: 'left',
                            cursor: isTranscribing ? 'not-allowed' : 'pointer',
                            opacity: isTranscribing && !isSelected ? 0.6 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '1rem' }}>{eng.icon}</span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                                {eng.title}
                              </span>
                            </div>
                          </div>
                          <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '0 0 4px 0', lineHeight: 1.25 }}>
                            {eng.desc}
                          </p>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                              color: isSelected ? '#c084fc' : '#94a3b8',
                              fontWeight: 600,
                              display: 'inline-block',
                            }}
                          >
                            {eng.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dedicated Transcription Preview Trigger Button */}
                  <div style={{ marginTop: '10px' }}>
                    <button
                      id="run-stt-preview-btn"
                      type="button"
                      onClick={handleRunTranscription}
                      disabled={isTranscribing || loadingCues}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: '9px',
                        border: '1px solid rgba(139, 92, 246, 0.45)',
                        backgroundColor: isTranscribing ? 'rgba(139, 92, 246, 0.35)' : 'rgba(139, 92, 246, 0.2)',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: (isTranscribing || loadingCues) ? 'not-allowed' : 'pointer',
                        opacity: (isTranscribing || loadingCues) ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        boxShadow: '0 2px 10px rgba(139, 92, 246, 0.2)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isTranscribing ? (
                        <>
                          <span className="auth-spinner" style={{ width: '14px', height: '14px' }} />
                          <span>Sedang Mentranskripsikan Audio ({config.sttEngine === 'gemini' ? 'Gemini AI STT' : 'Local Whisper'})…</span>
                        </>
                      ) : cues.length > 0 ? (
                        <>
                          <span>🔄</span>
                          <span>Transkripsikan Ulang ({config.sttEngine === 'gemini' ? 'Gemini AI STT' : 'Local Whisper'})</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>Mulai Transkripsi Audio ({config.sttEngine === 'gemini' ? 'Gemini AI STT' : 'Local Whisper'})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

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
                            <span style={{ fontSize: '1rem' }}>{preset.icon}</span>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
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

                {/* 2. Font Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                    Pilih Font Tipografi
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                    }}
                  >
                    {FONT_OPTIONS.map((font) => {
                      const isSelected = (config.fontFamily || 'Montserrat') === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, fontFamily: font.id }))}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: isSelected
                              ? '2px solid #6366f1'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            backgroundColor: isSelected
                              ? 'rgba(99, 102, 241, 0.2)'
                              : 'rgba(30, 41, 59, 0.5)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: `"${font.name}", sans-serif`,
                              fontSize: '0.86rem',
                              fontWeight: 700,
                              color: isSelected ? '#a5b4fc' : '#f8fafc',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {font.name}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '1px' }}>
                            {font.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Words per Page & Position */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Words per page */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                        Kata per Tampilan Subtitle: <span style={{ color: '#818cf8', fontWeight: 700 }}>{wordsPerPage} kata</span>
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[1, 2, 3, 4, 5].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => handleWordsPerPageChange(count)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            borderRadius: '8px',
                            border: wordsPerPage === count ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                            backgroundColor: wordsPerPage === count ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position Y Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                        Posisi Vertikal Subtitle
                      </label>
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                        {config.positionY ?? 75}% (dari atas)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={90}
                      value={config.positionY ?? 75}
                      onChange={(e) => setConfig((prev) => ({ ...prev, positionY: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* 4. Color & Stroke Customizer */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Highlight Color Palette */}
                  {config.preset !== 'plain' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                          Warna Highlight Kata Aktif
                        </label>
                        <span style={{ fontSize: '0.72rem', color: config.highlightColor || '#FFE600', fontWeight: 700 }}>
                          {config.highlightColor || '#FFE600'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.label}
                            onClick={() => setConfig((prev) => ({ ...prev, highlightColor: c.hex }))}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: c.hex,
                              border: config.highlightColor === c.hex ? '3px solid #ffffff' : '1px solid rgba(0,0,0,0.5)',
                              cursor: 'pointer',
                              transform: config.highlightColor === c.hex ? 'scale(1.15)' : 'scale(1)',
                              transition: 'transform 0.1s ease',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Standard Plain Text Color Palette */}
                  {config.preset === 'plain' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                          Warna Teks Subtitle
                        </label>
                        <span style={{ fontSize: '0.72rem', color: config.textColor || '#FFFFFF', fontWeight: 700 }}>
                          {config.textColor || '#FFFFFF'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.label}
                            onClick={() => setConfig((prev) => ({ ...prev, textColor: c.hex }))}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: c.hex,
                              border: config.textColor === c.hex ? '3px solid #6366f1' : '1px solid rgba(0,0,0,0.5)',
                              cursor: 'pointer',
                              transform: config.textColor === c.hex ? 'scale(1.15)' : 'scale(1)',
                              transition: 'transform 0.1s ease',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ukuran Font */}
                  <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '10px 14px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#cbd5e1' }}>Ukuran Font</span>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#6366f1' }}>{config.fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="32"
                      max="128"
                      step="2"
                      value={config.fontSize || 52}
                      onChange={(e) => setConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#6366f1' }}
                    />
                  </div>
                </div>

                {/* 5. Timing Calibration Offset Slider */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
                        Kalibrasi Waktu Subtitle (Offset)
                      </label>
                      <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                        Kompensasi jika suara dan teks subtitle tidak pas munculnya
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: (config.timeOffset || 0) === 0 ? '#94a3b8' : (config.timeOffset || 0) > 0 ? '#4ade80' : '#f87171',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {(config.timeOffset || 0) > 0 ? `+${(config.timeOffset || 0).toFixed(2)}s` : `${(config.timeOffset || 0).toFixed(2)}s`}
                    </span>
                  </div>

                  {/* Range Slider -30.0s to +30.0s */}
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={0.1}
                    value={config.timeOffset || 0}
                    onChange={(e) => setConfig((prev) => ({ ...prev, timeOffset: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer', marginBottom: '8px' }}
                  />

                  {/* Quick Precision Calibration Buttons */}
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      title="Majukan subtitle 5 detik"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: Math.max(-30, Number(((prev.timeOffset || 0) - 5).toFixed(1))) }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      -5s
                    </button>
                    <button
                      type="button"
                      title="Majukan subtitle 1 detik"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: Math.max(-30, Number(((prev.timeOffset || 0) - 1).toFixed(1))) }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      title="Majukan subtitle 0.2 detik"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: Math.max(-30, Number(((prev.timeOffset || 0) - 0.1).toFixed(2))) }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      -0.1s
                    </button>
                    <button
                      type="button"
                      title="Kembalikan ke timing asli 0s"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: 0 }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#c7d2fe',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Reset (0s)
                    </button>
                    <button
                      type="button"
                      title="Mundurkan subtitle 0.2 detik"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: Math.min(30, Number(((prev.timeOffset || 0) + 0.1).toFixed(2))) }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +0.1s
                    </button>
                    <button
                      type="button"
                      title="Mundurkan subtitle 1 detik"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: Math.min(30, Number(((prev.timeOffset || 0) + 1).toFixed(1))) }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +1s
                    </button>
                    <button
                      type="button"
                      title="Mundurkan subtitle 5 detik"
                      onClick={() => setConfig((prev) => ({ ...prev, timeOffset: Math.min(30, Number(((prev.timeOffset || 0) + 5).toFixed(1))) }))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +5s
                    </button>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '6px 0 0 0', textAlign: 'center', lineHeight: 1.3 }}>
                    💡 Gunakan <b>- (Maju)</b> jika teks terlambat muncul dari suara, atau <b>+ (Mundur)</b> jika teks muncul terlalu cepat. Anda juga bisa mengetikkan angka detik secara langsung.
                  </p>
                </div>
              </>
            )}

            {/* TAB 2: Intro Hook Title Card Configuration */}
            {activeTab === 'titleCard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Master Toggle Card */}
                <div
                  style={{
                    backgroundColor: titleCardConfig.enabled ? 'rgba(99, 102, 241, 0.12)' : 'rgba(15, 23, 42, 0.65)',
                    border: titleCardConfig.enabled ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: titleCardConfig.enabled ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        color: titleCardConfig.enabled ? '#a5b4fc' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                      }}
                    >
                      🎬
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                        Intro Title Card (Hook Pembuka)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.35 }}>
                        Tampilkan kartu judul beranimasi di awal video (1–5 detik) untuk menarik perhatian penonton sebelum klip diputar.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !titleCardConfig.enabled;
                      setTitleCardConfig((prev) => ({ ...prev, enabled: nextState }));
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: titleCardConfig.enabled ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: titleCardConfig.enabled ? '0 0 16px rgba(99, 102, 241, 0.5)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{titleCardConfig.enabled ? '✓ AKTIF' : 'NONAKTIF'}</span>
                  </button>
                </div>

                {/* 2. Title Card Editor Settings (Visible when enabled or for setup) */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    opacity: titleCardConfig.enabled ? 1 : 0.6,
                    pointerEvents: titleCardConfig.enabled ? 'auto' : 'auto',
                  }}
                >
                  {/* Mode Selector: Intro Card vs Video Overlay */}
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                      Tipe Tampilan Hook
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setTitleCardConfig((prev) => ({ ...prev, mode: 'card' }))}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: (titleCardConfig.mode || 'card') === 'card' ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor: (titleCardConfig.mode || 'card') === 'card' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(2, 6, 23, 0.5)',
                          color: (titleCardConfig.mode || 'card') === 'card' ? '#ffffff' : '#94a3b8',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          boxShadow: (titleCardConfig.mode || 'card') === 'card' ? '0 0 16px rgba(99, 102, 241, 0.3)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.84rem' }}>
                          <span>🎴</span>
                          <span>Kartu Pembuka (Intro Card)</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.25 }}>
                          Tampil sebelum klip mulai sebagai intro pemikat atensi
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTitleCardConfig((prev) => ({ ...prev, mode: 'overlay' }))}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: titleCardConfig.mode === 'overlay' ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor: titleCardConfig.mode === 'overlay' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 6, 23, 0.5)',
                          color: titleCardConfig.mode === 'overlay' ? '#ffffff' : '#94a3b8',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          boxShadow: titleCardConfig.mode === 'overlay' ? '0 0 16px rgba(56, 189, 248, 0.3)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.84rem' }}>
                          <span>🏷️</span>
                          <span>Judul di Atas Video (Overlay)</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.25 }}>
                          Klip langsung berjalan, judul melayang di atas video
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Overlay Position (Only when mode === 'overlay') */}
                  {titleCardConfig.mode === 'overlay' && (
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                        Posisi Judul Overlay
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { id: 'top' as const, label: 'Atas (Header)', icon: '⬆️' },
                          { id: 'center' as const, label: 'Tengah (Focus)', icon: '🎯' },
                          { id: 'bottom' as const, label: 'Bawah (Third)', icon: '⬇️' },
                        ].map((pos) => {
                          const isSelected = (titleCardConfig.overlayPosition || 'top') === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => setTitleCardConfig((prev) => ({ ...prev, overlayPosition: pos.id }))}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 6, 23, 0.5)',
                                color: isSelected ? '#38bdf8' : '#94a3b8',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>{pos.icon}</span>
                              <span>{pos.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hook Title Input */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
                        Teks Judul Utama (Hook Headline)
                      </label>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {titleCardConfig.title.length} karakter
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={titleCardConfig.title}
                      onChange={(e) => setTitleCardConfig((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Contoh: RAHASIA VIRAL YANG TIDAK PERNAH DIBOCORKAN! 🔥"
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(2, 6, 23, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        resize: 'vertical',
                        outline: 'none',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                      }}
                    />

                    {/* Quick Emojis & Hooks */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {[
                        { label: '🔥 Viral', text: '🔥 ' },
                        { label: '⚡ Rahasia', text: '⚡ RAHASIA: ' },
                        { label: '😱 Shocking', text: '😱 ' },
                        { label: '🚀 10X', text: ' 🚀' },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTitleCardConfig((prev) => ({
                              ...prev,
                              title: `${item.text}${prev.title}`,
                            }));
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#94a3b8',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          + {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subtitle Input */}
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                      Sub-judul / Tagline (Opsional)
                    </label>
                    <input
                      type="text"
                      value={titleCardConfig.subtitle || ''}
                      onChange={(e) => setTitleCardConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Contoh: Tonton sampai selesai! • Part 1"
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(2, 6, 23, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: '#e2e8f0',
                        fontSize: '0.82rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Template Style Selection Grid */}
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                      Pilih Style Template Hook
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                      }}
                    >
                      {TITLE_CARD_TEMPLATES.map((tmpl) => {
                        const isSelected = titleCardConfig.template === tmpl.id;
                        return (
                          <div
                            key={tmpl.id}
                            onClick={() => {
                              setTitleCardConfig((prev) => ({
                                ...prev,
                                template: tmpl.id,
                                accentColor: tmpl.defaultAccent,
                              }));
                            }}
                            style={{
                              padding: '12px',
                              borderRadius: '12px',
                              border: isSelected
                                ? `2px solid ${tmpl.defaultAccent}`
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: isSelected
                                ? 'rgba(99, 102, 241, 0.16)'
                                : 'rgba(2, 6, 23, 0.5)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? `0 0 16px ${tmpl.defaultAccent}30` : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{tmpl.icon}</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                                  {tmpl.title}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: isSelected ? `${tmpl.defaultAccent}25` : 'rgba(255, 255, 255, 0.08)',
                                  color: isSelected ? tmpl.defaultAccent : '#94a3b8',
                                }}
                              >
                                {tmpl.badge}
                              </span>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.25 }}>
                              {tmpl.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Transition Selection Grid */}
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                      Pilihan Efek Transisi Keluar
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {HOOK_TRANSITION_OPTIONS.map((tr) => {
                        const isSelected = (titleCardConfig.transition || 'fade') === tr.id;
                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => setTitleCardConfig((prev) => ({ ...prev, transition: tr.id }))}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(2, 6, 23, 0.5)',
                              color: isSelected ? '#e9d5ff' : '#94a3b8',
                              textAlign: 'center',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 0 12px rgba(168, 85, 247, 0.3)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '1rem' }}>{tr.icon}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                              {tr.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duration Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
                        Durasi Tampil Judul
                      </label>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8' }}>
                        {titleCardConfig.durationSeconds} detik ({Math.round(titleCardConfig.durationSeconds * 30)} frames)
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={titleCardConfig.durationSeconds}
                      onChange={(e) =>
                        setTitleCardConfig((prev) => ({
                          ...prev,
                          durationSeconds: Number(e.target.value),
                        }))
                      }
                      style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      <span>1.0s (Cepat)</span>
                      <span>2.5s (Direkomendasikan)</span>
                      <span>5.0s (Panjang)</span>
                    </div>
                  </div>

                  {/* Accent Color Palette */}
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                      Warna Aksen Hook
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {COLOR_PALETTE.map((color) => {
                        const isSelected = titleCardConfig.accentColor === color.hex;
                        return (
                          <button
                            key={color.hex}
                            type="button"
                            onClick={() => setTitleCardConfig((prev) => ({ ...prev, accentColor: color.hex }))}
                            title={color.label}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: color.hex,
                              border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)',
                              cursor: 'pointer',
                              boxShadow: isSelected ? `0 0 10px ${color.hex}` : 'none',
                              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Interactive Text & Timing Editor */}
            {activeTab === 'editor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Header & Quick Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'block' }}>
                      Editor Transkripsi Manual ({cues.length} Baris)
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Edit teks yang salah/kosong atau sesuaikan timing (Start/End) per baris
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddCue()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>+</span>
                    <span>Tambah Baris</span>
                  </button>
                </div>

                {/* List of Cues */}
                {cues.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                      borderRadius: '14px',
                      padding: '30px 16px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}
                  >
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 6px 0' }}>
                      Belum Ada Teks Subtitle
                    </p>
                    <p style={{ fontSize: '0.76rem', margin: '0 0 12px 0' }}>
                      Silakan buka tab &apos;Desain & Gaya&apos; dan jalankan transkripsi audio, atau buat baris subtitle manual.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddCue()}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#6366f1',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      + Tambah Baris Manual
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cues.map((cue, idx) => (
                      <div
                        key={cue.id || idx}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {/* Cue Header: Index, Time Range, Seek button, Delete button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                color: '#a855f7',
                                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSeekToCue(cue.start)}
                              title="Putar video pada detik ini untuk mendengar kecocokan suara"
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                color: '#c7d2fe',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>▶ Dengar</span>
                              <span>({cue.start.toFixed(2)}s - {cue.end.toFixed(2)}s)</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleAddCue(idx)}
                              title="Sisipkan baris subtitle baru setelah baris ini"
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                              }}
                            >
                              + Sisip
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCue(idx)}
                              title="Hapus baris subtitle ini"
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>

                        {/* Timing Fine Tuning Controls */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px',
                            backgroundColor: 'rgba(0, 0, 0, 0.25)',
                            padding: '8px',
                            borderRadius: '8px',
                          }}
                        >
                          {/* Start Time Controller */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <label style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Mulai (Start)</label>
                              <span style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 700 }}>{cue.start.toFixed(2)}s</span>
                            </div>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              <button
                                type="button"
                                onClick={() => updateCueTiming(idx, 'start', cue.start - 0.1)}
                                style={{ flex: 1, padding: '3px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                -0.1s
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCueTiming(idx, 'start', cue.start + 0.1)}
                                style={{ flex: 1, padding: '3px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                +0.1s
                              </button>
                            </div>
                          </div>

                          {/* End Time Controller */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <label style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Selesai (End)</label>
                              <span style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 700 }}>{cue.end.toFixed(2)}s</span>
                            </div>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              <button
                                type="button"
                                onClick={() => updateCueTiming(idx, 'end', cue.end - 0.1)}
                                style={{ flex: 1, padding: '3px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                -0.1s
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCueTiming(idx, 'end', cue.end + 0.1)}
                                style={{ flex: 1, padding: '3px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                +0.1s
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Text Input / Editable Box */}
                        <div>
                          <input
                            type="text"
                            value={cue.text}
                            onChange={(e) => updateCueText(idx, e.target.value)}
                            placeholder="Ketik teks subtitle untuk baris ini..."
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              color: '#f8fafc',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
            disabled={isExporting || loadingCues || isTranscribing || cues.length === 0}
            title={cues.length === 0 ? 'Harap lakukan transkripsi audio terlebih dahulu' : 'Ekspor video bersubtitle'}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '10px 24px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: (isExporting || loadingCues || isTranscribing || cues.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (isExporting || loadingCues || isTranscribing || cues.length === 0) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            {isExporting ? (
              <>
                <span className="auth-spinner" style={{ width: '14px', height: '14px' }} />
                <span>Mengekspor Video Bersubtitle…</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>✨ Ekspor Video ({config.sttEngine === 'gemini' ? 'Gemini AI' : 'Local Whisper'})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

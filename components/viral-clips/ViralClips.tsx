'use client';

import { useState, useCallback } from 'react';
import type {
  TranscriptSegment,
  ViralAnalysisResult,
  ViralClip,
  AnalyzeResponse,
} from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';
import styles from './ViralClips.module.css';

// ─── Props ────────────────────────────────────────────────────

interface ViralClipsProps {
  segments: TranscriptSegment[];
}

// ─── Internal state ───────────────────────────────────────────

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: ViralAnalysisResult }
  | { status: 'error'; message: string };

// ─── Helpers ──────────────────────────────────────────────────

/** Convert segments array → "[MM:SS] text\n..." string for the API */
function buildTranscriptString(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`)
    .join('\n');
}

// ─── Component ────────────────────────────────────────────────

export function ViralClips({ segments }: ViralClipsProps) {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });

  const runAnalysis = useCallback(async () => {
    setState({ status: 'loading' });

    const transcript = buildTranscriptString(segments);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      const data: AnalyzeResponse = await res.json();

      if (!data.success) {
        setState({ status: 'error', message: data.error });
        return;
      }

      setState({ status: 'ready', result: data.result });
    } catch {
      setState({
        status: 'error',
        message: 'Gagal menghubungi server. Periksa koneksi internet Anda.',
      });
    }
  }, [segments]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  // ─── Render ─────────────────────────────────────────────────

  if (state.status === 'idle') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.triggerSection}>
          <p className={styles.triggerLabel}>
            Transcript siap. Analisis untuk menemukan TOP 3 potensi viral clip.
          </p>
          <button
            id="analyze-viral-btn"
            className={styles.analyzeBtn}
            onClick={runAnalysis}
            aria-label="Analyze viral clips"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Analyze Viral Clips</span>
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loadingSection} role="status" aria-live="polite">
          <div className={styles.loadingOrb} aria-hidden="true">
            <div className={styles.loadingRing} />
            <div className={styles.loadingRing} />
            <div className={styles.loadingRingInner} />
          </div>
          <div>
            <p className={styles.loadingTitle}>Menganalisis transcript…</p>
            <p className={styles.loadingSubtitle}>
              Mencari momen paling berpotensi viral
              <span className={styles.loadingDots} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.errorSection} role="alert">
          <div className={styles.errorIconWrap} aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className={styles.errorContent}>
            <p className={styles.errorTitle}>Gagal menganalisis transcript</p>
            <p className={styles.errorMessage}>{state.message}</p>
          </div>
          <button
            id="analyze-retry-btn"
            className={styles.retryBtn}
            onClick={reset}
            aria-label="Try again"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.48" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // status === 'ready'
  const { result } = state;

  return (
    <div className={styles.wrapper}>
      <div className={styles.resultsSection}>
        {/* Header */}
        <div className={styles.resultsHeader}>
          <h2 className={styles.resultsTitle}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="url(#fire-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="fire-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className={styles.resultsTitleGradient}>Viral Clip Analysis</span>
          </h2>
          <button
            id="re-analyze-btn"
            className={styles.reAnalyzeBtn}
            onClick={runAnalysis}
            aria-label="Re-analyze"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.48" />
            </svg>
            Re-analyze
          </button>
        </div>

        {/* Overall summary */}
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Mengapa clip ini dipilih
          </p>
          <p className={styles.summaryText}>{result.overall_summary}</p>
        </div>

        {/* Clip cards */}
        <div className={styles.clipsGrid}>
          {result.clips.map((clip) => (
            <ClipCard key={clip.rank} clip={clip} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clip card sub-component ──────────────────────────────────

function ClipCard({ clip }: { clip: ViralClip }) {
  return (
    <article
      className={styles.clipCard}
      data-rank={clip.rank}
      aria-label={`Rank ${clip.rank}: ${clip.title}`}
    >
      {/* Header row */}
      <div className={styles.clipHeader}>
        <span className={styles.rankBadge} data-rank={clip.rank}>
          #{clip.rank}
        </span>

        <div className={styles.scoreWrap}>
          <div className={styles.scoreTop}>
            <span className={styles.scoreValue}>{clip.viral_score}/100</span>
            <div className={styles.scoreBar} role="progressbar" aria-valuenow={clip.viral_score} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={styles.scoreBarFill}
                style={{ width: `${clip.viral_score}%` }}
              />
            </div>
          </div>
          <span className={styles.timeRange}>
            {clip.start_time} → {clip.end_time}
          </span>
        </div>

        <span className={styles.durationPill}>{clip.duration_seconds}s</span>
      </div>

      {/* Body */}
      <div className={styles.clipBody}>
        <h3 className={styles.clipTitle}>{clip.title}</h3>

        {/* Categories */}
        <div className={styles.categoryRow} aria-label="Categories">
          {clip.category.map((cat) => (
            <span key={cat} className={styles.categoryTag}>
              {cat.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        {/* Hook / Summary / Why Viral */}
        <div className={styles.infoSection}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Hook</span>
            <p className={styles.infoValue}>{clip.hook}</p>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Summary</span>
            <p className={styles.infoValue}>{clip.summary}</p>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Why Viral</span>
            <p className={styles.infoValue}>{clip.why_viral}</p>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className={styles.listsRow}>
          <div className={`${styles.listBlock} ${styles.listBlockStrengths}`}>
            <span className={`${styles.listLabel} ${styles.listLabelStrengths}`}>
              Strengths
            </span>
            {clip.strengths.map((s, i) => (
              <div key={i} className={styles.listItem}>
                <span className={`${styles.listItemIcon} ${styles.iconStrength}`} aria-hidden="true">✓</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div className={`${styles.listBlock} ${styles.listBlockWeaknesses}`}>
            <span className={`${styles.listLabel} ${styles.listLabelWeaknesses}`}>
              Weaknesses
            </span>
            {clip.weaknesses.length > 0 ? (
              clip.weaknesses.map((w, i) => (
                <div key={i} className={styles.listItem}>
                  <span className={`${styles.listItemIcon} ${styles.iconWeakness}`} aria-hidden="true">⚠</span>
                  <span>{w}</span>
                </div>
              ))
            ) : (
              <div className={styles.listItem}>
                <span className={`${styles.listItemIcon} ${styles.iconStrength}`} aria-hidden="true">✓</span>
                <span>No significant weaknesses</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

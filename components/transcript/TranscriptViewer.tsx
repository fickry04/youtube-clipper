'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { TranscriptSegment } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

interface TranscriptViewerProps {
  videoId: string;
  segments: TranscriptSegment[];
  languageCode: string;
}

export function TranscriptViewer({ videoId, segments, languageCode }: TranscriptViewerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredSegments = searchQuery
    ? segments.filter((s) =>
      s.text.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : segments;

  // Find active segment based on current time (both in seconds)
  const activeSegmentIndex = useMemo(() => {
    if (!segments.length) return null;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].offset) {
        return i;
      }
    }
    return null;
  }, [currentTime, segments]);

  // Scroll active segment into view
  useEffect(() => {
    if (activeRowRef.current && !searchQuery) {
      activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSegmentIndex, searchQuery]);

  // Poll YouTube iframe API for current time
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      try {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const t = playerRef.current.getCurrentTime();
          if (typeof t === 'number') setCurrentTime(t);
        }
      } catch {
        // player not ready yet
      }
    }, 500);
  }, []);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      if (!iframeRef.current) return;
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            setIsPlayerReady(true);
            startPolling();
          },
        },
      }) as YTPlayer;
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [videoId, startPolling]);

  // offset is already in seconds — pass directly to seekTo
  function seekTo(offsetSeconds: number) {
    const t = Math.floor(offsetSeconds);
    try {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(t, true);
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      } else {
        throw new Error('player not ready');
      }
    } catch {
      // fallback: reload iframe with start timestamp
      if (iframeRef.current) {
        iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?start=${t}&autoplay=1&enablejsapi=1`;
      }
    }
  }

  async function copyTranscript() {
    const text = segments.map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`).join('\n');
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  function downloadTranscript() {
    const text = segments.map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${videoId}-${languageCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Total duration in seconds
  const totalDuration = segments.length > 0
    ? segments[segments.length - 1].offset + segments[segments.length - 1].duration
    : 0;

  return (
    <div className="transcript-viewer-container">
      {/* Left: Video player */}
      <div className="transcript-viewer-video-panel">
        <div className="transcript-viewer-video-wrapper">
          <iframe
            ref={iframeRef}
            id={`yt-player-${videoId}`}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="transcript-viewer-iframe"
          />
        </div>

        {/* Video stats */}
        <div className="transcript-viewer-video-meta">
          <div className="transcript-viewer-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>{segments.length} segments</span>
          </div>
          <div className="transcript-viewer-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formatTimestamp(totalDuration)}</span>
          </div>
          <div className="transcript-viewer-stat transcript-viewer-lang-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="transcript-viewer-lang-code">{languageCode.toUpperCase()}</span>
          </div>
          {!isPlayerReady && (
            <div className="transcript-viewer-stat">
              <span className="transcript-viewer-loading-indicator">Loading player...</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Transcript panel */}
      <div className="transcript-viewer-panel">
        <div className="transcript-viewer-header">
          <div className="transcript-viewer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Transcript</span>
          </div>
          <div className="transcript-viewer-actions">
            <button
              id="copy-transcript-btn"
              className="transcript-viewer-action-btn"
              onClick={copyTranscript}
              title="Copy transcript"
              aria-label={isCopied ? 'Copied!' : 'Copy transcript'}
            >
              {isCopied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              <span>{isCopied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              id="download-transcript-btn"
              className="transcript-viewer-action-btn"
              onClick={downloadTranscript}
              title="Download as .txt"
              aria-label="Download transcript"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="transcript-viewer-search-wrapper">
          <svg className="transcript-viewer-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="transcript-search-input"
            className="transcript-viewer-search-input"
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search transcript"
          />
          {searchQuery && (
            <span className="transcript-viewer-search-count">
              {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Segments list */}
        <div className="transcript-viewer-segments-list" ref={transcriptRef} role="list" aria-label="Transcript segments">
          {filteredSegments.length === 0 ? (
            <div className="transcript-viewer-empty-search">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>No results for &ldquo;{searchQuery}&rdquo;</span>
            </div>
          ) : (
            filteredSegments.map((segment, i) => {
              const originalIndex = searchQuery
                ? segments.findIndex((s) => s === segment)
                : i;
              const isActive = !searchQuery && activeSegmentIndex === originalIndex;

              return (
                <button
                  key={`${segment.offset}-${i}`}
                  ref={isActive ? activeRowRef : undefined}
                  role="listitem"
                  className={`transcript-viewer-segment ${isActive ? 'transcript-viewer-segment-active' : ''}`}
                  onClick={() => seekTo(segment.offset)}
                  aria-label={`Jump to ${formatTimestamp(segment.offset)}: ${segment.text}`}
                  id={`segment-${originalIndex}`}
                >
                  <span className="transcript-viewer-timestamp">{formatTimestamp(segment.offset)}</span>
                  <span className="transcript-viewer-segment-text">
                    {searchQuery ? highlightText(segment.text, searchQuery) : segment.text}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: 'rgba(139, 92, 246, 0.35)', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}
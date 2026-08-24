import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

/**
 * CinemaStyle: Classic Netflix / Cinematic subtitle with heavy shadow and no container box.
 * Uniform fixed font size, clean and completely non-distracting (NO word scaling).
 */
export const CinemaStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#FFE600';
  const fontSize = config.fontSize || 44;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px 12px',
        maxWidth: '92%',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;
        const isPastWord = currentTimeSec > w.end;

        const color = config.disableHighlight
          ? '#FFFFFF'
          : isCurrentWord
            ? highlightColor
            : isPastWord
              ? '#FFFFFF'
              : 'rgba(255, 255, 255, 0.75)';

        const textShadow = !config.disableHighlight && isCurrentWord
          ? `0 3px 12px rgba(0,0,0,0.95), 0 0 16px ${highlightColor}99`
          : '0 3px 12px rgba(0,0,0,0.95), 0 0 4px #000000';

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              fontFamily: '"Helvetica Neue", "Arial", sans-serif',
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              lineHeight: 1.25,
              color,
              textTransform: config.uppercase ? 'uppercase' : 'none',
              letterSpacing: '0.5px',
              textShadow,
              transition: 'color 0.08s ease-out',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

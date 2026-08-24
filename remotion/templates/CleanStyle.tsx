import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

/**
 * CleanStyle: Modern clean box with fixed font size (NO word resizing/scaling).
 * Active word highlights with color and subtle glow while maintaining uniform typography.
 */
export const CleanStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#FFE600';
  const textColor = config.textColor || '#FFFFFF';
  const fontSize = config.fontSize || 48;
  const strokeWidth = config.strokeWidth ?? 3;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px 14px',
        maxWidth: '88%',
        margin: '0 auto',
        padding: '12px 24px',
        borderRadius: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;
        const isPastWord = currentTimeSec > w.end;

        const color = config.disableHighlight
          ? textColor
          : isCurrentWord
            ? highlightColor
            : isPastWord
              ? textColor
              : 'rgba(255, 255, 255, 0.65)';

        const textShadow = !config.disableHighlight && isCurrentWord
          ? `0 0 16px ${highlightColor}88, 0 4px 12px rgba(0,0,0,0.9)`
          : '0 2px 8px rgba(0,0,0,0.8)';

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              fontFamily: '"Montserrat", "Inter", -apple-system, sans-serif',
              fontWeight: 800,
              fontSize: `${fontSize}px`,
              lineHeight: 1.2,
              color,
              textTransform: config.uppercase !== false ? 'uppercase' : 'none',
              letterSpacing: '0.5px',
              WebkitTextStroke: `${strokeWidth}px rgba(0, 0, 0, 0.85)`,
              paintOrder: 'stroke fill',
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

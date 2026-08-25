import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

/**
 * UnderlineStyle: Sleek glowing underline / bottom border under the active word.
 * Fixed uniform typography with neon accent underline (NO font scaling).
 */
export const UnderlineStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#00FFCC';
  const fontSize = config.fontSize || 48;
  const strokeWidth = config.strokeWidth ?? 3;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px 16px',
        maxWidth: '88%',
        margin: '0 auto',
        padding: '12px 22px',
        borderRadius: '18px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;
        const isPastWord = currentTimeSec > w.end;

        const color = isCurrentWord
          ? highlightColor
          : isPastWord
            ? '#FFFFFF'
            : 'rgba(255, 255, 255, 0.6)';

        const borderBottom = isCurrentWord
          ? `4px solid ${highlightColor}`
          : '4px solid transparent';

        const textShadow = isCurrentWord
          ? `0 0 16px ${highlightColor}99, 0 4px 12px rgba(0,0,0,0.9)`
          : '0 2px 8px rgba(0,0,0,0.8)';

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              fontFamily: `"${config.fontFamily || 'Montserrat'}", "Inter", -apple-system, sans-serif`,
              fontWeight: 800,
              fontSize: `${fontSize}px`,
              lineHeight: 1.2,
              color,
              textTransform: config.uppercase !== false ? 'uppercase' : 'none',
              letterSpacing: '0.5px',
              borderBottom,
              paddingBottom: '2px',
              WebkitTextStroke: `${strokeWidth}px rgba(0, 0, 0, 0.8)`,
              paintOrder: 'stroke fill',
              textShadow,
              transition: 'all 0.08s ease-out',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

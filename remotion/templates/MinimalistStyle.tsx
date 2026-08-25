import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

export const MinimalistStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#38bdf8'; // Sky Blue
  const fontSize = config.fontSize || 42;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px 12px',
        maxWidth: '85%',
        margin: '0 auto',
        padding: '12px 22px',
        borderRadius: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;

        const color = isCurrentWord
          ? highlightColor
          : '#F8FAFC';

        const textShadow = isCurrentWord
          ? `0 0 12px ${highlightColor}99`
          : 'none';

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              fontFamily: `"${config.fontFamily || 'Inter'}", -apple-system, sans-serif`,
              fontWeight: isCurrentWord ? 800 : 600,
              fontSize: `${fontSize}px`,
              lineHeight: 1.25,
              color,
              textShadow,
              transition: 'color 0.1s ease',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

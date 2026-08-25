import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

export const KaraokeStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {

  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#00FFCC'; // Cyan/Green Neon
  const fontSize = config.fontSize || 48;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px 16px',
        maxWidth: '85%',
        margin: '0 auto',
        padding: '16px 24px',
        borderRadius: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;
        const isPastWord = currentTimeSec > w.end;

        let fillPercentage = 0;
        if (isPastWord) {
          fillPercentage = 100;
        } else if (isCurrentWord) {
          const duration = Math.max(0.01, w.end - w.start);
          const progress = Math.min(1, Math.max(0, (currentTimeSec - w.start) / duration));
          fillPercentage = Math.round(progress * 100);
        }

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              position: 'relative',
              display: 'inline-block',
              fontFamily: `"${config.fontFamily || 'Poppins'}", "Inter", -apple-system, sans-serif`,
              fontWeight: 800,
              fontSize: `${fontSize}px`,
              lineHeight: 1.2,
              letterSpacing: '0.5px',
              textTransform: config.uppercase !== false ? 'uppercase' : 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              WebkitTextStroke: '2px rgba(0, 0, 0, 0.8)',
            }}
          >
            {/* Background base text */}
            {w.word}

            {/* Filled overlay highlight text */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${fillPercentage}%`,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                color: isCurrentWord ? highlightColor : '#FFFFFF',
                textShadow: isCurrentWord
                  ? `0 0 16px ${highlightColor}, 0 2px 8px rgba(0,0,0,0.8)`
                  : '0 2px 8px rgba(0,0,0,0.8)',
                WebkitTextStroke: '2px #000000',
                transition: 'width 0.05s linear',
              }}
            >
              {w.word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

/**
 * BoxHighlightStyle: Badge / Highlighter marker style per word (ala Ali Abdaal / podcast).
 * Fixed uniform font size with a solid colored background badge for the active word (NO font scaling).
 */
export const BoxHighlightStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#FFE600';
  const fontSize = config.fontSize || 46;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px 12px',
        maxWidth: '90%',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;

        const isHighlighted = !config.disableHighlight && isCurrentWord;

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              fontFamily: '"Poppins", "Inter", -apple-system, sans-serif',
              fontWeight: 800,
              fontSize: `${fontSize}px`,
              lineHeight: 1.2,
              letterSpacing: '0.5px',
              textTransform: config.uppercase !== false ? 'uppercase' : 'none',
              padding: '4px 12px',
              borderRadius: '10px',
              backgroundColor: isHighlighted ? highlightColor : 'rgba(0, 0, 0, 0.6)',
              color: isHighlighted ? '#000000' : '#FFFFFF',
              boxShadow: isHighlighted
                ? `0 4px 20px ${highlightColor}99, 0 2px 8px rgba(0,0,0,0.8)`
                : '0 2px 8px rgba(0,0,0,0.6)',
              border: isHighlighted
                ? `1px solid ${highlightColor}`
                : '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'background-color 0.08s ease-out, color 0.08s ease-out',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

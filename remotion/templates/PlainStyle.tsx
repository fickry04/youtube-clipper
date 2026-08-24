import React from 'react';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

/**
 * PlainStyle: Clean standard subtitle WITHOUT any per-word highlight.
 * Displays words in uniform solid color, fixed font size, and crisp outline.
 */
export const PlainStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  config,
}) => {
  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

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
        gap: '6px 12px',
        maxWidth: '88%',
        margin: '0 auto',
        padding: '12px 22px',
        borderRadius: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: '"Montserrat", "Inter", -apple-system, sans-serif',
          fontWeight: 800,
          fontSize: `${fontSize}px`,
          lineHeight: 1.25,
          color: textColor,
          textTransform: config.uppercase !== false ? 'uppercase' : 'none',
          letterSpacing: '0.5px',
          WebkitTextStroke: `${strokeWidth}px rgba(0, 0, 0, 0.9)`,
          paintOrder: 'stroke fill',
          textShadow: '0 3px 12px rgba(0,0,0,0.9), 0 0 4px #000000',
        }}
      >
        {currentCue.text || currentCue.words.map((w) => w.word).join(' ')}
      </span>
    </div>
  );
};

import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

export const BeastStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#FF3366'; // Hot Pink / Red
  const fontSize = config.fontSize || 58;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '14px 20px',
        maxWidth: '92%',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;

        const wordStartFrame = Math.round(w.start * fps);
        const relativeFrame = Math.max(0, frame - wordStartFrame);

        const bounce = isCurrentWord
          ? spring({
              frame: relativeFrame,
              fps,
              config: { damping: 10, mass: 0.4, stiffness: 260 },
            })
          : 0;

        // Subtle slight tilt rotation for Beast style punch
        const rotationDeg = isCurrentWord ? (idx % 2 === 0 ? -3 : 3) : 0;
        const scale = isCurrentWord ? 1.0 + bounce * 0.2 : 1.0;

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              transform: `scale(${scale}) rotate(${rotationDeg}deg)`,
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontWeight: 900,
              fontSize: `${fontSize}px`,
              lineHeight: 1.1,
              textTransform: 'uppercase',
              color: isCurrentWord ? highlightColor : '#FFFFFF',
              WebkitTextStroke: '5px #000000',
              paintOrder: 'stroke fill',
              textShadow: '0 8px 0 #000000, 0 12px 24px rgba(0,0,0,0.85)',
              transition: 'transform 0.08s ease-out',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

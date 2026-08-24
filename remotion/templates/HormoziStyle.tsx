import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionCue, SubtitleStyleConfig } from '../types';

interface CaptionTemplateProps {
  currentCue: CaptionCue | null;
  currentTimeSec: number;
  config: SubtitleStyleConfig;
}

export const HormoziStyle: React.FC<CaptionTemplateProps> = ({
  currentCue,
  currentTimeSec,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!currentCue || !currentCue.words || currentCue.words.length === 0) {
    return null;
  }

  const highlightColor = config.highlightColor || '#FFE600'; // Neon Yellow
  const textColor = config.textColor || '#FFFFFF';
  const fontSize = config.fontSize || 54;
  const strokeWidth = config.strokeWidth ?? 4;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px 18px',
        maxWidth: '90%',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {currentCue.words.map((w, idx) => {
        const isCurrentWord =
          currentTimeSec >= w.start && currentTimeSec <= w.end;
        const isPastWord = currentTimeSec > w.end;

        // Active word bounce/pop spring animation
        const wordStartFrame = Math.round(w.start * fps);
        const currentFrameCalc = Math.round(currentTimeSec * fps);
        const relativeFrame = Math.max(0, currentFrameCalc - wordStartFrame);

        const scale = isCurrentWord
          ? spring({
            frame: relativeFrame,
            fps,
            config: {
              damping: 12,
              mass: 0.5,
              stiffness: 220,
            },
          }) * 0.15 + 1.05
          : 1.0;

        const color = isCurrentWord
          ? highlightColor
          : isPastWord
            ? textColor
            : 'rgba(255, 255, 255, 0.7)';

        const textTransform = config.uppercase !== false ? 'uppercase' : 'none';

        return (
          <span
            key={`${idx}-${w.word}`}
            style={{
              display: 'inline-block',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              fontFamily:
                '"Montserrat", "Arial Black", -apple-system, sans-serif',
              fontWeight: 900,
              fontSize: `${fontSize}px`,
              lineHeight: 1.15,
              color,
              textTransform,
              letterSpacing: '1px',
              WebkitTextStroke: `${strokeWidth}px #000000`,
              paintOrder: 'stroke fill',
              textShadow: isCurrentWord
                ? `0px 4px 16px rgba(0,0,0,0.9), 0 0 20px ${highlightColor}66`
                : '0px 4px 12px rgba(0,0,0,0.85)',
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

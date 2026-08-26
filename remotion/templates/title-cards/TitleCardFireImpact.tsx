import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';

interface TitleCardProps {
  config: TitleCardConfig;
}

export const TitleCardFireImpact: React.FC<TitleCardProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'VIRAL MOMENT';
  const subtitle = config.subtitle;
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#FF3366';

  // Slam entrance spring with slight rotation
  const scale = spring({
    frame,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 180 },
    from: 1.4,
    to: 1,
  });

  const rotation = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.7, stiffness: 120 },
    from: -6,
    to: -2,
  });

  const opacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 6, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#0a0304',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 40px',
        overflow: 'hidden',
        opacity: opacity * exitOpacity,
        fontFamily: "'Bebas Neue', sans-serif",
      }}
    >
      {/* Fiery Explosive Background Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, #e11d4840 0%, #ff572225 40%, #0a0304 80%)',
          zIndex: 1,
        }}
      />

      {/* Main Impact Box */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          maxWidth: '960px',
        }}
      >
        {/* Fire Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 28px',
            backgroundColor: accentColor,
            color: '#FFFFFF',
            fontSize: '36px',
            fontWeight: 900,
            letterSpacing: '0.15em',
            borderRadius: '12px',
            marginBottom: '28px',
            boxShadow: `0 8px 30px ${accentColor}80`,
            transform: 'rotate(2deg)',
          }}
        >
          <span>🔥</span>
          <span>HOT CLIP</span>
        </div>

        {/* Slam Title */}
        <h1
          style={{
            margin: 0,
            color: textColor,
            fontSize: '110px',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textShadow: `-4px 4px 0px #000, 4px 4px 0px #000, 4px -4px 0px #000, -4px -4px 0px #000, 0 12px 35px ${accentColor}90`,
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              marginTop: '32px',
              backgroundColor: '#FFE600',
              color: '#000000',
              fontSize: '40px',
              fontWeight: 900,
              padding: '10px 32px',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              transform: 'rotate(-1deg)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

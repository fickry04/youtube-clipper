import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';

interface TitleCardProps {
  config: TitleCardConfig;
}

export const TitleCardMinimalClean: React.FC<TitleCardProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'MINIMAL TITLE';
  const subtitle = config.subtitle;
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#38bdf8';

  const scale = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.9, stiffness: 90 },
    from: 0.92,
    to: 1,
  });

  const opacity = interpolate(frame, [0, 8], [0, 1], {
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
        backgroundColor: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 48px',
        overflow: 'hidden',
        opacity: opacity * exitOpacity,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background Soft Ambient Light */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}25 0%, transparent 70%)`,
          filter: 'blur(70px)',
          zIndex: 1,
        }}
      />

      {/* Frosted Glass Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: `scale(${scale})`,
          maxWidth: '920px',
          padding: '64px 52px',
          borderRadius: '36px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '4px',
            backgroundColor: accentColor,
            borderRadius: '9999px',
            marginBottom: '32px',
          }}
        />

        <h1
          style={{
            margin: 0,
            color: textColor,
            fontSize: '76px',
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <div
            style={{
              marginTop: '28px',
              color: '#94a3b8',
              fontSize: '32px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

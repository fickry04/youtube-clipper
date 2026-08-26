import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';

interface TitleCardProps {
  config: TitleCardConfig;
}

export const TitleCardGradientGlass: React.FC<TitleCardProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'EXCLUSIVE INSIGHT';
  const subtitle = config.subtitle;
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#C084FC';

  const scale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 110 },
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
        backgroundColor: '#070514',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 48px',
        overflow: 'hidden',
        opacity: opacity * exitOpacity,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* Aurora Mesh Gradient */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '120%',
          height: '120%',
          background: `radial-gradient(circle at 30% 30%, #7c3aed45 0%, transparent 50%), radial-gradient(circle at 70% 70%, #ec489935 0%, transparent 50%), radial-gradient(circle at 50% 50%, #38bdf825 0%, transparent 60%)`,
          filter: 'blur(50px)',
          zIndex: 1,
        }}
      />

      {/* Floating Glass Container */}
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
          padding: '60px 48px',
          borderRadius: '32px',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(192, 132, 252, 0.3)',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(124, 58, 237, 0.25)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 22px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(192, 132, 252, 0.15)',
            border: '1px solid rgba(192, 132, 252, 0.4)',
            color: accentColor,
            fontSize: '26px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '32px',
          }}
        >
          <span>✨</span>
          <span>KEY HIGHLIGHT</span>
        </div>

        <h1
          style={{
            margin: 0,
            color: textColor,
            fontSize: '80px',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            textShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <div
            style={{
              marginTop: '32px',
              color: '#e2e8f0',
              fontSize: '34px',
              fontWeight: 500,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

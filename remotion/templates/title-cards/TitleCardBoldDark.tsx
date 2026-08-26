import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';

interface TitleCardProps {
  config: TitleCardConfig;
}

export const TitleCardBoldDark: React.FC<TitleCardProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'HOOK TITLE';
  const subtitle = config.subtitle;
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#FFE600';

  // Entrance spring animation
  const scale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 120 },
  });

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Exit transition fade out during the last 6 frames
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 6, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Background subtle zoom
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.08]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#05070e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 48px',
        overflow: 'hidden',
        opacity: opacity * exitOpacity,
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      {/* Background Graphic Grid / Glow */}
      <div
        style={{
          position: 'absolute',
          inset: '-20px',
          background: `radial-gradient(circle at 50% 45%, ${accentColor}25 0%, transparent 65%), radial-gradient(circle at 50% 100%, #1e1b4b 0%, #05070e 100%)`,
          transform: `scale(${bgScale})`,
          zIndex: 1,
        }}
      />

      {/* Subtle grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          zIndex: 2,
          opacity: 0.6,
        }}
      />

      {/* Content Container */}
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
        }}
      >
        {/* Top Tag / Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            borderRadius: '9999px',
            backgroundColor: `${accentColor}20`,
            border: `2px solid ${accentColor}`,
            color: accentColor,
            fontSize: '28px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '36px',
            boxShadow: `0 0 24px ${accentColor}40`,
          }}
        >
          <span style={{ fontSize: '26px' }}>⚡</span>
          <span>MUST WATCH</span>
        </div>

        {/* Main Title */}
        <h1
          style={{
            margin: 0,
            color: textColor,
            fontSize: '84px',
            fontWeight: 900,
            lineHeight: 1.12,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            textShadow: '0 8px 30px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0,0,0,0.8)',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              marginTop: '36px',
              padding: '12px 32px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '16px',
              color: '#e2e8f0',
              fontSize: '36px',
              fontWeight: 600,
              maxWidth: '820px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Bottom Accent Bar */}
        <div
          style={{
            marginTop: '44px',
            width: '120px',
            height: '8px',
            backgroundColor: accentColor,
            borderRadius: '9999px',
            boxShadow: `0 0 20px ${accentColor}`,
          }}
        />
      </div>
    </div>
  );
};

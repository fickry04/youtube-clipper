import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';

interface TitleCardProps {
  config: TitleCardConfig;
}

export const TitleCardNeonGlow: React.FC<TitleCardProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'VIRAL HOOK';
  const subtitle = config.subtitle;
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#00FFCC';

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.7, stiffness: 140 },
  });

  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 6, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Neon pulse
  const pulse = Math.sin(frame / 3) * 0.15 + 0.85;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#02040a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 48px',
        overflow: 'hidden',
        opacity: opacity * exitOpacity,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background Cyan/Pink Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}35 0%, #ff007f20 45%, transparent 70%)`,
          filter: 'blur(60px)',
          zIndex: 1,
        }}
      />

      {/* Cyber Neon Box */}
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
          padding: '56px 44px',
          borderRadius: '28px',
          backgroundColor: 'rgba(8, 12, 28, 0.82)',
          border: `3px solid ${accentColor}`,
          boxShadow: `0 0 40px ${accentColor}${Math.round(pulse * 70).toString(16)}, inset 0 0 30px ${accentColor}25`,
        }}
      >
        {/* Neon Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            borderRadius: '8px',
            backgroundColor: `${accentColor}25`,
            color: accentColor,
            fontSize: '26px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: '32px',
            border: `1px solid ${accentColor}`,
            textShadow: `0 0 12px ${accentColor}`,
          }}
        >
          <span>🔥</span>
          <span>DON&apos;T MISS THIS</span>
        </div>

        {/* Title */}
        <h1
          style={{
            margin: 0,
            color: textColor,
            fontSize: '80px',
            fontWeight: 900,
            lineHeight: 1.15,
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            textShadow: `0 0 25px ${accentColor}80, 0 4px 10px rgba(0,0,0,0.9)`,
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
              color: '#38bdf8',
              fontSize: '34px',
              fontWeight: 700,
              textShadow: '0 0 14px rgba(56, 189, 248, 0.6)',
              letterSpacing: '0.02em',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

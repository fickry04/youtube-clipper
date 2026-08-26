import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';

interface TitleCardProps {
  config: TitleCardConfig;
}

export const TitleCardCinemaSlate: React.FC<TitleCardProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'CINEMATIC MOMENT';
  const subtitle = config.subtitle;
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#FCD34D';

  const translateY = spring({
    frame,
    fps,
    config: { damping: 16, mass: 0.9, stiffness: 100 },
    from: 60,
    to: 0,
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], {
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
        backgroundColor: '#0a0a0d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 56px',
        overflow: 'hidden',
        opacity: opacity * exitOpacity,
        fontFamily: "'Oswald', sans-serif",
      }}
    >
      {/* Top & Bottom Cinematic Letterbox Borders */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '140px',
          backgroundColor: '#000000',
          borderBottom: '2px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          color: '#64748b',
          fontSize: '22px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          zIndex: 5,
        }}
      >
        <span>SCENE 01</span>
        <span>4K UHD • 60 FPS</span>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '140px',
          backgroundColor: '#000000',
          borderTop: '2px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: '22px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          zIndex: 5,
        }}
      >
        <span>EXCLUSIVE CLIP</span>
      </div>

      {/* Main Center Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: `translateY(${translateY}px)`,
          maxWidth: '940px',
        }}
      >
        <div
          style={{
            fontSize: '32px',
            color: accentColor,
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          ◆ FEATURED STORY ◆
        </div>

        <h1
          style={{
            margin: 0,
            color: textColor,
            fontSize: '92px',
            fontWeight: 700,
            lineHeight: 1.1,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            textShadow: '0 10px 40px rgba(0,0,0,0.95)',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              margin: '32px 0 0 0',
              color: '#cbd5e1',
              fontSize: '36px',
              fontWeight: 500,
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

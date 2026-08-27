import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';
import { getExitTransitionStyle } from './transitions';

interface TitleOverlayProps {
  config: TitleCardConfig;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const title = config.title || 'HOOK TITLE';
  const subtitle = config.subtitle;
  const template = config.template || 'bold-dark';
  const textColor = config.textColor || '#FFFFFF';
  const accentColor = config.accentColor || '#FFE600';
  const position = config.overlayPosition || 'top';
  const transition = config.transition || 'fade';

  // Entrance spring
  const enterScale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 140 },
    from: 0.8,
    to: 1,
  });

  const enterOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Exit transition
  const exitStyle = getExitTransitionStyle(frame, durationInFrames, transition, 8);

  // Vertical position styles
  let verticalStyle: React.CSSProperties = { top: '160px' };
  if (position === 'center') {
    verticalStyle = { top: '50%' };
  } else if (position === 'bottom') {
    verticalStyle = { bottom: '340px' };
  }

  // Template container styles
  let containerStyle: React.CSSProperties = {};
  let badgeText = '⚡ MUST WATCH';
  let badgeBg = `${accentColor}25`;
  let badgeColor = accentColor;

  switch (template) {
    case 'neon-glow':
      containerStyle = {
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        border: `2px solid ${accentColor}`,
        boxShadow: `0 0 35px ${accentColor}60, inset 0 0 20px ${accentColor}20`,
        borderRadius: '24px',
      };
      badgeText = '🔥 DON\'T MISS THIS';
      break;
    case 'cinema-slate':
      containerStyle = {
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        borderTop: `3px solid ${accentColor}`,
        borderBottom: `3px solid ${accentColor}`,
        boxShadow: '0 15px 40px rgba(0,0,0,0.85)',
        borderRadius: '16px',
      };
      badgeText = '◆ FEATURED STORY ◆';
      break;
    case 'minimal-clean':
      containerStyle = {
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        borderRadius: '28px',
      };
      badgeText = '✨ KEY POINT';
      break;
    case 'fire-impact':
      containerStyle = {
        backgroundColor: 'rgba(15, 2, 4, 0.9)',
        border: '2px solid #FF0055',
        boxShadow: '0 0 35px rgba(255, 0, 85, 0.55)',
        borderRadius: '20px',
        transform: 'rotate(-1deg)',
      };
      badgeText = '🔥 HOT MOMENT';
      badgeBg = '#FF0055';
      badgeColor = '#FFFFFF';
      break;
    case 'gradient-glass':
      containerStyle = {
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.85) 0%, rgba(15, 23, 42, 0.9) 100%)',
        backdropFilter: 'blur(24px)',
        border: `1px solid ${accentColor}40`,
        boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 25px ${accentColor}25`,
        borderRadius: '28px',
      };
      badgeText = '✨ HIGHLIGHT';
      break;
    case 'bold-dark':
    default:
      containerStyle = {
        backgroundColor: 'rgba(5, 7, 14, 0.9)',
        border: `2px solid ${accentColor}`,
        boxShadow: `0 16px 45px rgba(0,0,0,0.9), 0 0 30px ${accentColor}35`,
        borderRadius: '24px',
      };
      badgeText = '⚡ MUST WATCH';
      break;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        maxWidth: '980px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 40,
        pointerEvents: 'none',
        ...verticalStyle,
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '32px 36px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: enterOpacity * exitStyle.opacity,
          transform: `scale(${enterScale}) ${exitStyle.transform}`,
          filter: exitStyle.filter,
          transition: 'all 0.05s ease-out',
          ...containerStyle,
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 18px',
            borderRadius: '9999px',
            backgroundColor: badgeBg,
            color: badgeColor,
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          {badgeText}
        </div>

        {/* Title */}
        <h2
          style={{
            margin: 0,
            color: textColor,
            fontSize: '56px',
            fontWeight: 900,
            lineHeight: 1.15,
            fontFamily: `"Montserrat", sans-serif`,
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.95)',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h2>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              marginTop: '14px',
              color: '#cbd5e1',
              fontSize: '26px',
              fontFamily: `"Montserrat", sans-serif`,
              fontWeight: 600,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

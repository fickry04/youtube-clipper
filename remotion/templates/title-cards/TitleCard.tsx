import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TitleCardConfig } from '../../types';
import { getExitTransitionStyle } from './transitions';
import { TitleCardBoldDark } from './TitleCardBoldDark';
import { TitleCardNeonGlow } from './TitleCardNeonGlow';
import { TitleCardCinemaSlate } from './TitleCardCinemaSlate';
import { TitleCardMinimalClean } from './TitleCardMinimalClean';
import { TitleCardFireImpact } from './TitleCardFireImpact';
import { TitleCardGradientGlass } from './TitleCardGradientGlass';

export interface TitleCardComponentProps {
  config: TitleCardConfig;
}

export const TitleCard: React.FC<TitleCardComponentProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const transition = config.transition || 'fade';
  const exitStyle = getExitTransitionStyle(frame, durationInFrames, transition, 8);

  const template = config.template || 'bold-dark';

  let content: React.ReactNode;
  switch (template) {
    case 'bold-dark':
      content = <TitleCardBoldDark config={config} />;
      break;
    case 'neon-glow':
      content = <TitleCardNeonGlow config={config} />;
      break;
    case 'cinema-slate':
      content = <TitleCardCinemaSlate config={config} />;
      break;
    case 'minimal-clean':
      content = <TitleCardMinimalClean config={config} />;
      break;
    case 'fire-impact':
      content = <TitleCardFireImpact config={config} />;
      break;
    case 'gradient-glass':
      content = <TitleCardGradientGlass config={config} />;
      break;
    default:
      content = <TitleCardBoldDark config={config} />;
      break;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: exitStyle.opacity,
        transform: exitStyle.transform,
        filter: exitStyle.filter,
      }}
    >
      {content}
    </div>
  );
};

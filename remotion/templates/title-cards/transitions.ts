import { interpolate } from 'remotion';
import type { HookTransitionType } from '../../types';

export interface TransitionStyles {
  opacity: number;
  transform: string;
  filter?: string;
  clipPath?: string;
}

/**
 * Compute exit animation styling based on chosen transition type during the last frames of duration.
 */
export function getExitTransitionStyle(
  frame: number,
  durationInFrames: number,
  transition: HookTransitionType = 'fade',
  exitFrames = 8
): TransitionStyles {
  const startExit = Math.max(0, durationInFrames - exitFrames);

  if (frame < startExit) {
    return {
      opacity: 1,
      transform: 'translate3d(0, 0, 0) scale(1)',
    };
  }

  const progress = interpolate(frame, [startExit, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  switch (transition) {
    case 'slide-up': {
      const translateY = interpolate(progress, [0, 1], [0, -220]);
      const opacity = interpolate(progress, [0, 0.8, 1], [1, 0.4, 0]);
      return {
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
      };
    }
    case 'slide-down': {
      const translateY = interpolate(progress, [0, 1], [0, 220]);
      const opacity = interpolate(progress, [0, 0.8, 1], [1, 0.4, 0]);
      return {
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
      };
    }
    case 'zoom-out': {
      const scale = interpolate(progress, [0, 1], [1, 0.35]);
      const opacity = interpolate(progress, [0, 1], [1, 0]);
      return {
        opacity,
        transform: `scale(${scale})`,
      };
    }
    case 'wipe-left': {
      const translateX = interpolate(progress, [0, 1], [0, -1100]);
      const opacity = interpolate(progress, [0, 0.9, 1], [1, 0.8, 0]);
      return {
        opacity,
        transform: `translate3d(${translateX}px, 0, 0)`,
      };
    }
    case 'flash': {
      const brightness = interpolate(progress, [0, 0.4, 1], [1, 3.5, 0]);
      const opacity = interpolate(progress, [0, 0.6, 1], [1, 0.8, 0]);
      const scale = interpolate(progress, [0, 0.4, 1], [1, 1.08, 0.9]);
      return {
        opacity,
        transform: `scale(${scale})`,
        filter: `brightness(${brightness})`,
      };
    }
    case 'fade':
    default: {
      const opacity = interpolate(progress, [0, 1], [1, 0]);
      return {
        opacity,
        transform: 'translate3d(0, 0, 0) scale(1)',
      };
    }
  }
}

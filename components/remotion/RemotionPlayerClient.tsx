'use client';

import React from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { TikTokCaptions } from '@/remotion/compositions/TikTokCaptions';
import type { CaptionCue, SubtitleStyleConfig } from '@/remotion/types';

interface RemotionPlayerClientProps {
  videoSrc: string;
  durationInSeconds: number;
  cues: CaptionCue[];
  styleConfig: SubtitleStyleConfig;
  autoPlay?: boolean;
  loop?: boolean;
  playerRef?: React.RefObject<PlayerRef | null>;
}

export const RemotionPlayerClient: React.FC<RemotionPlayerClientProps> = ({
  videoSrc,
  durationInSeconds,
  cues,
  styleConfig,
  autoPlay = false,
  loop = true,
  playerRef,
}) => {
  const fps = 30;
  const durationInFrames = Math.max(1, Math.round(durationInSeconds * fps));

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '240px',
        maxHeight: 'min(44vh, 420px)',
        aspectRatio: '9 / 16',
        margin: '0 auto',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
        backgroundColor: '#000000',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Player
        ref={playerRef}
        component={TikTokCaptions}
        inputProps={{
          videoSrc,
          durationInSeconds,
          fps,
          cues,
          styleConfig,
        }}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={1080}
        compositionHeight={1920}
        style={{
          width: '100%',
          height: '100%',
        }}
        controls
        autoPlay={autoPlay}
        loop={loop}
        acknowledgeRemotionLicense
      />
    </div>
  );
};

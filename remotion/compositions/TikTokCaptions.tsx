import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { TikTokCaptionsProps, SubtitleStyleConfig } from '../types';
import { HormoziStyle } from '../templates/HormoziStyle';
import { KaraokeStyle } from '../templates/KaraokeStyle';
import { MinimalistStyle } from '../templates/MinimalistStyle';
import { BeastStyle } from '../templates/BeastStyle';

const DEFAULT_CONFIG: SubtitleStyleConfig = {
  preset: 'hormozi',
  fontSize: 52,
  positionY: 75,
  highlightColor: '#FFE600',
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 4,
  uppercase: true,
  wordsPerPage: 3,
};

export const TikTokCaptions: React.FC<TikTokCaptionsProps> = ({
  videoSrc,
  cues = [],
  styleConfig = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeSec = frame / fps;

  const config: SubtitleStyleConfig = {
    ...DEFAULT_CONFIG,
    ...styleConfig,
  };

  // Find active cue matching the current second
  const activeCue =
    cues.find(
      (cue) => currentTimeSec >= cue.start && currentTimeSec <= cue.end
    ) || null;

  const positionY = config.positionY ?? 75;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Background 9:16 Vertical Video */}
      {videoSrc && (
        <AbsoluteFill>
          <OffthreadVideo
            src={videoSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Subtitles Overlay Container */}
      <div
        style={{
          position: 'absolute',
          top: `${positionY}%`,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {config.preset === 'karaoke' && (
          <KaraokeStyle
            currentCue={activeCue}
            currentTimeSec={currentTimeSec}
            config={config}
          />
        )}
        {config.preset === 'minimalist' && (
          <MinimalistStyle
            currentCue={activeCue}
            currentTimeSec={currentTimeSec}
            config={config}
          />
        )}
        {config.preset === 'beast' && (
          <BeastStyle
            currentCue={activeCue}
            currentTimeSec={currentTimeSec}
            config={config}
          />
        )}
        {(config.preset === 'hormozi' || !config.preset) && (
          <HormoziStyle
            currentCue={activeCue}
            currentTimeSec={currentTimeSec}
            config={config}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

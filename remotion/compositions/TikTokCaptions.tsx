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
import { CleanStyle } from '../templates/CleanStyle';
import { PlainStyle } from '../templates/PlainStyle';
import { BoxHighlightStyle } from '../templates/BoxHighlightStyle';
import { CinemaStyle } from '../templates/CinemaStyle';
import { UnderlineStyle } from '../templates/UnderlineStyle';
import { ensureFontLoaded } from '../fonts';

const DEFAULT_CONFIG: SubtitleStyleConfig = {
  preset: 'clean',
  fontSize: 48,
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

  ensureFontLoaded(config.fontFamily);

  const timeOffset = config.timeOffset ?? 0;
  // Adjusted time for manual calibration (positive = delay/later, negative = advance/earlier)
  const adjustedTimeSec = currentTimeSec - timeOffset;

  // Find active cue matching the calibrated second
  const activeCue =
    cues.find(
      (cue) => adjustedTimeSec >= cue.start && adjustedTimeSec <= cue.end
    ) || null;

  const positionY = config.positionY ?? 75;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Load Google Fonts for Remotion Player & Export Renderer */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800;900&family=Montserrat:wght@400;600;700;800;900&family=Oswald:wght@500;600;700&family=Poppins:wght@400;600;700;800;900&family=Roboto:wght@400;500;700;900&display=swap');
      `}</style>

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
        {config.preset === 'plain' && (
          <PlainStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'clean' && (
          <CleanStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'box-highlight' && (
          <BoxHighlightStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'cinema' && (
          <CinemaStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'underline' && (
          <UnderlineStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'karaoke' && (
          <KaraokeStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'minimalist' && (
          <MinimalistStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'beast' && (
          <BeastStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {config.preset === 'hormozi' && (
          <HormoziStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
        {!config.preset && (
          <CleanStyle
            currentCue={activeCue}
            currentTimeSec={adjustedTimeSec}
            config={config}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

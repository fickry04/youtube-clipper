import React from 'react';
import { Composition } from 'remotion';
import { TikTokCaptions } from './compositions/TikTokCaptions';

export const RemotionRoot: React.FC = () => {
  const defaultDuration = 30;
  const defaultFps = 30;

  return (
    <>
      <Composition
        id="TikTokCaptions"
        component={TikTokCaptions}
        durationInFrames={defaultDuration * defaultFps}
        fps={defaultFps}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: '',
          durationInSeconds: defaultDuration,
          fps: defaultFps,
          cues: [],
          styleConfig: {
            preset: 'hormozi',
            fontSize: 52,
            positionY: 75,
            highlightColor: '#FFE600',
            textColor: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 4,
            uppercase: true,
            wordsPerPage: 3,
          },
        }}
        calculateMetadata={({ props }) => {
          const duration = typeof props?.durationInSeconds === 'number' ? props.durationInSeconds : 30;
          const fps = typeof props?.fps === 'number' ? props.fps : 30;
          return {
            durationInFrames: Math.max(1, Math.round(duration * fps)),
            fps,
            width: 1080,
            height: 1920,
          };
        }}
      />
    </>
  );
};

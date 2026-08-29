// YouTube IFrame API type declarations
declare global {
  interface YTPlayer {
    getCurrentTime(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    destroy(): void;
  }

  interface YTPlayerOptions {
    videoId?: string;
    events?: {
      onReady?: (event: { target: YTPlayer }) => void;
      onStateChange?: (event: { data: number }) => void;
    };
  }

  interface YTAPI {
    Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
  }

  interface Window {
    YT: YTAPI;
    onYouTubeIframeAPIReady: () => void;
  }
}

export { };
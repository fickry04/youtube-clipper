export interface WordTimestamp {
  word: string;
  start: number; // in seconds relative to the clip start
  end: number;   // in seconds relative to the clip start
  confidence?: number;
}

export interface CaptionCue {
  id: string | number;
  start: number; // in seconds relative to clip start
  end: number;   // in seconds relative to clip start
  text: string;
  words: WordTimestamp[];
}

export type SubtitlePreset =
  | 'plain'
  | 'clean'
  | 'box-highlight'
  | 'cinema'
  | 'underline'
  | 'hormozi'
  | 'beast'
  | 'karaoke'
  | 'minimalist';

export interface SubtitleStyleConfig {
  preset: SubtitlePreset;
  fontFamily?: string; // e.g. 'Montserrat', 'Inter', 'Poppins', 'Impact', 'Roboto', 'Arial'
  fontSize?: number; // e.g. 48 for 1080x1920 or scaled
  positionY?: number; // percentage from top (default 75%)
  highlightColor?: string; // default '#FFE600'
  textColor?: string; // default '#FFFFFF'
  strokeColor?: string; // default '#000000'
  strokeWidth?: number; // default 4
  uppercase?: boolean; // default true
  wordsPerPage?: number; // default 3
  showEmoji?: boolean; // default true
  timeOffset?: number; // Timing calibration offset in seconds (e.g. -30.0 to +30.0, default 0)
}

export interface TikTokCaptionsProps {
  [key: string]: unknown;
  videoSrc: string;
  durationInSeconds: number;
  fps?: number;
  cues: CaptionCue[];
  styleConfig?: Partial<SubtitleStyleConfig>;
}

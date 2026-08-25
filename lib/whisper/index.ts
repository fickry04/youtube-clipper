import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { nodewhisper } from 'nodejs-whisper';
import type { CaptionCue, WordTimestamp } from '../../remotion/types';
import { generateWordLevelCues, groupWordsIntoCues } from '../transcript/word-timestamps';
import { refineTranscriptWithGemini } from '../transcript/gemini-refiner';
import { transcribeWithGeminiAudio } from '../gemini/speech-to-text';

export interface TranscribeClipOptions {
  mediaPath: string; // Absolute path to clip mp4 or wav
  clipDurationSeconds?: number;
  wordsPerPage?: number;
  language?: string;
  contextHint?: string;
  fallbackSegments?: Array<{ offset: number; duration: number; text: string }>;
  clipStartSeconds?: number;
  engine?: 'whisper' | 'gemini';
}

/**
 * Unified clip transcription router supporting both Local Whisper and Gemini AI Multimodal Audio.
 */
export async function transcribeClip(
  opts: TranscribeClipOptions
): Promise<CaptionCue[]> {
  const engine = opts.engine || 'whisper';
  if (engine === 'gemini') {
    return transcribeWithGeminiAudio(opts);
  }
  return transcribeClipLocally(opts);
}

/**
 * Transcribe a video clip locally using nodejs-whisper (whisper.cpp)
 * to get exact millisecond-level word timestamps, then refine with Gemini AI.
 */
export async function transcribeClipLocally(
  opts: TranscribeClipOptions
): Promise<CaptionCue[]> {
  const wordsPerPage = opts.wordsPerPage || 3;
  const clipDuration = opts.clipDurationSeconds || 60;

  try {
    console.log(`[Local Whisper] Starting transcription for: ${opts.mediaPath}`);

    const modelRootPath = path.resolve(
      process.cwd(),
      'node_modules/nodejs-whisper/cpp/whisper.cpp/models'
    );

    // Call nodejs-whisper with explicit modelRootPath
    await nodewhisper(opts.mediaPath, {
      modelName: 'base',
      modelRootPath,
      removeWavFileAfterTranscription: true,
      withCuda: false,
      whisperOptions: {
        outputInJsonFull: true,
        outputInJson: true,
        outputInSrt: false,
        outputInText: false,
        wordTimestamps: true,
        splitOnWord: true,
      },
    });

    // Possible JSON output file locations produced by whisper.cpp
    const candidates = [
      `${opts.mediaPath}.wav.json`,
      `${opts.mediaPath}.json`,
      path.join(
        path.dirname(opts.mediaPath),
        `${path.basename(opts.mediaPath, path.extname(opts.mediaPath))}.wav.json`
      ),
      path.join(
        path.dirname(opts.mediaPath),
        `${path.basename(opts.mediaPath, path.extname(opts.mediaPath))}.json`
      ),
    ];

    let jsonPath: string | null = null;
    for (const cand of candidates) {
      if (existsSync(cand)) {
        jsonPath = cand;
        break;
      }
    }

    if (jsonPath) {
      const rawJsonStr = await fs.readFile(jsonPath, 'utf-8');
      const rawData = JSON.parse(rawJsonStr);

      // Clean up temporary json file
      await fs.unlink(jsonPath).catch(() => {});

      const rawWords: WordTimestamp[] = [];
      const transcription = rawData.transcription || rawData.result || [];

      for (const item of transcription) {
        const wordText = (item.text || '').trim();
        // Ignore empty, dashes or raw whisper markers
        if (!wordText || wordText === '-' || wordText.startsWith('[_')) {
          continue;
        }

        // Get exact timestamps in seconds
        let startSec: number;
        let endSec: number;

        if (item.offsets && typeof item.offsets.from === 'number' && typeof item.offsets.to === 'number') {
          startSec = item.offsets.from / 1000;
          endSec = item.offsets.to / 1000;
        } else {
          startSec = parseWhisperTimestamp(item.timestamps?.from);
          endSec = parseWhisperTimestamp(item.timestamps?.to);
        }

        rawWords.push({
          word: wordText,
          start: Number(Math.max(0, Math.min(clipDuration, startSec)).toFixed(3)),
          end: Number(Math.max(startSec + 0.05, Math.min(clipDuration, endSec)).toFixed(3)),
          confidence: item.tokens?.[0]?.p ?? 0.95,
        });
      }

      if (rawWords.length > 0) {
        console.log(`[Local Whisper] Raw extracted: ${rawWords.length} words. Running Gemini cleaner & refiner...`);
        const refinedWords = await refineTranscriptWithGemini(rawWords, opts.contextHint);
        console.log(`[Local Whisper] Refined to ${refinedWords.length} cleaned words.`);
        return groupWordsIntoCues(refinedWords, wordsPerPage, clipDuration);
      }
    }
  } catch (err) {
    console.warn('[Local Whisper] Local whisper execution warning:', err);
  }

  // Graceful fallback to phonetic transcript aligner
  console.log('[Local Whisper] Using phonetic transcript fallback for cues.');
  if (opts.fallbackSegments && typeof opts.clipStartSeconds === 'number') {
    const fallbackCues = generateWordLevelCues(
      opts.fallbackSegments,
      opts.clipStartSeconds,
      clipDuration,
      wordsPerPage
    );
    return fallbackCues;
  }

  return [];
}

/**
 * Parse whisper timestamp string (e.g. "00:00:01,234" or "00:00:01.234" or number) to seconds
 */
function parseWhisperTimestamp(ts: string | number | undefined): number {
  if (typeof ts === 'number') return ts;
  if (!ts || typeof ts !== 'string') return 0;

  const parts = ts.replace(',', '.').split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(ts) || 0;
}


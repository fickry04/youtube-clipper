import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import type { CaptionCue, WordTimestamp } from '../../remotion/types';
import { generateWordLevelCues, groupWordsIntoCues } from '../transcript/word-timestamps';
import { cleanNoiseTokens } from '../transcript/gemini-refiner';

export interface GeminiTranscribeOptions {
  mediaPath: string; // Absolute path to clip mp4 or wav/mp3
  clipDurationSeconds?: number;
  wordsPerPage?: number;
  contextHint?: string;
  fallbackSegments?: Array<{ offset: number; duration: number; text: string }>;
  clipStartSeconds?: number;
}

interface RawGeminiWord {
  w?: string;
  word?: string;
  s?: number;
  start?: number;
  e?: number;
  end?: number;
}

/**
 * Extract lightweight 16kHz mono audio from video file using FFmpeg
 */
async function extractAudioForGemini(videoPath: string): Promise<string> {
  const ext = path.extname(videoPath).toLowerCase();
  if (ext === '.mp3' || ext === '.wav' || ext === '.m4a' || ext === '.aac') {
    return videoPath;
  }

  const tmpAudioPath = path.join(
    os.tmpdir(),
    `gemini_stt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`
  );

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-y',
        '-i', videoPath,
        '-vn',
        '-ar', '16000',
        '-ac', '1',
        '-b:a', '64k',
        tmpAudioPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    let stderr = '';
    ffmpeg.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0 && existsSync(tmpAudioPath)) {
        resolve();
      } else {
        reject(new Error(`FFmpeg audio extraction failed (code ${code}): ${stderr}`));
      }
    });

    ffmpeg.on('error', reject);
  });

  return tmpAudioPath;
}

/**
 * Transcribe a video or audio clip using Google Gemini Multimodal Audio model
 * to obtain accurate word-level timestamps for Remotion captions.
 */
export async function transcribeWithGeminiAudio(
  opts: GeminiTranscribeOptions
): Promise<CaptionCue[]> {
  const wordsPerPage = opts.wordsPerPage || 3;
  const clipDuration = opts.clipDurationSeconds || 60;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini STT] GEMINI_API_KEY not found in environment.');
    return fallbackToTranscript(opts);
  }

  let extractedAudioPath: string | null = null;
  let isTempAudio = false;

  try {
    console.log(`[Gemini STT] Preparing audio for clip: ${opts.mediaPath}`);
    extractedAudioPath = await extractAudioForGemini(opts.mediaPath);
    isTempAudio = extractedAudioPath !== opts.mediaPath;

    const audioBuffer = await fs.readFile(extractedAudioPath);
    const base64Audio = audioBuffer.toString('base64');

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Anda adalah sistem Speech-to-Text (STT) kecerdasan buatan kelas dunia untuk transkripsi video pendek (Shorts/TikTok/Reels).

Tugas Anda:
1. Dengarkan audio klip berikut secara sangat teliti.
2. Transkripsikan setiap kata yang diucapkan secara akurat dalam Bahasa Indonesia (atau bahasa yang diucapkan di audio).
3. Berikan timestamp awal ('s') dan akhir ('e') dalam DETIK (angka desimal dengan presisi tinggi, contoh: 0.18, 0.45) relatif terhadap awal audio klip (0.0s).
4. Timestamp harus SANGAT AKURAT mengikuti waktu pengucapan kata pada audio aslinya.
5. Hapus ekspresi non-kata seperti [LAUGHS], [MUSIC], tawa, hembusan napas, atau tanda baca aneh.
6. Pastikan urutan timestamp berurutan maju secara kronologis (s < e) dan tidak melebihi durasi klip (${clipDuration.toFixed(2)} detik).

Konteks Klip: ${opts.contextHint || 'Percakapan video YouTube'}
Durasi Klip: ${clipDuration.toFixed(2)} detik

KEMBALIKAN HANYA JSON ARRAY:
[
  { "w": "kata1", "s": 0.12, "e": 0.45 },
  { "w": "kata2", "s": 0.48, "e": 0.82 }
]`;

    console.log('[Gemini STT] Sending audio stream to Gemini Flash model...');
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'audio/mp3',
            data: base64Audio,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      throw new Error('Gemini STT returned empty response.');
    }

    const parsed: RawGeminiWord[] = JSON.parse(responseText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Gemini STT returned non-array or empty results.');
    }

    // Process and validate word timestamps
    const rawWords: WordTimestamp[] = [];
    let lastEnd = 0;

    for (const item of parsed) {
      const text = String(item.w || item.word || '').trim();
      if (!text || text === '-' || text === '--') continue;

      let start = typeof item.s === 'number' ? item.s : typeof item.start === 'number' ? item.start : lastEnd;
      let end = typeof item.e === 'number' ? item.e : typeof item.end === 'number' ? item.end : start + 0.3;

      // Safety sanitization
      start = Math.max(0, Math.min(clipDuration, start));
      end = Math.max(start + 0.05, Math.min(clipDuration, end));

      // Prevent regression in timestamp order
      if (start < lastEnd && lastEnd - start < 0.3) {
        start = lastEnd;
        end = Math.max(start + 0.05, end);
      }

      lastEnd = end;

      rawWords.push({
        word: text,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        confidence: 0.99,
      });
    }

    const cleanedWords = cleanNoiseTokens(rawWords);
    if (cleanedWords.length > 0) {
      console.log(`[Gemini STT] Successfully transcribed ${cleanedWords.length} words with Gemini Multimodal Audio.`);
      return groupWordsIntoCues(cleanedWords, wordsPerPage, clipDuration);
    }
  } catch (err) {
    console.warn('[Gemini STT] Gemini audio transcription error, falling back:', err);
  } finally {
    if (isTempAudio && extractedAudioPath && existsSync(extractedAudioPath)) {
      await fs.unlink(extractedAudioPath).catch(() => { });
    }
  }

  return fallbackToTranscript(opts);
}

function fallbackToTranscript(opts: GeminiTranscribeOptions): CaptionCue[] {
  const wordsPerPage = opts.wordsPerPage || 3;
  const clipDuration = opts.clipDurationSeconds || 60;

  if (opts.fallbackSegments && typeof opts.clipStartSeconds === 'number') {
    return generateWordLevelCues(
      opts.fallbackSegments,
      opts.clipStartSeconds,
      clipDuration,
      wordsPerPage
    );
  }
  return [];
}

import { GoogleGenAI } from '@google/genai';
import type { WordTimestamp } from '../../remotion/types';

/**
 * Filter out non-speech noise tags (e.g. [LAUGHS], [MUSIC], [APPLAUSE], (laughs), etc.)
 */
export function cleanNoiseTokens(words: WordTimestamp[]): WordTimestamp[] {
  return words.filter((w) => {
    const text = (w.word || '').trim();
    if (!text) return false;
    if (text === '-' || text === '--') return false;

    // Filter bracketed noise expressions e.g. [LAUGHS], [Randov laughs], (laughs), [MUSIC]
    if (/^\[.*?\]$/.test(text) || /^\(.*?\)$/.test(text)) return false;
    if (/laughs|music|applause|laughter|chuckle|giggle|noise/i.test(text) && /[\[\]()]/.test(text)) {
      return false;
    }

    return true;
  });
}

/**
 * Use Gemini AI to clean expressions, fix speech-to-text typos/misheard words,
 * and ensure the subtitle sentences make logical sense in context while preserving timing.
 */
export async function refineTranscriptWithGemini(
  rawWords: WordTimestamp[],
  contextHint?: string
): Promise<WordTimestamp[]> {
  // 1. Initial regex cleanup of brackets & noise
  const filteredWords = cleanNoiseTokens(rawWords);
  if (filteredWords.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Gemini Refiner] GEMINI_API_KEY not found, using filtered Whisper words.');
    return filteredWords;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const fullSentence = filteredWords.map((w) => w.word).join(' ');

    const prompt = `Anda adalah editor subtitle profesional.
Tugas Anda:
1. Perbaiki transkrip hasil Speech-to-Text (Whisper) berikut ini agar masuk akal, alami, dan bebas dari salah dengar/typo tanpa mengubah makna aslinya.
2. Hapus suara non-vokal/noise seperti [LAUGHS], [MUSIC], [APPLAUSE], [Randov laughs], tanda strip '-', tawa, atau teks dalam kurung jika masih tersisa.
3. Pertahankan urutan dan jumlah segmen waktu kata sebisa mungkin, sesuaikan teks kata dengan kata hasil perbaikan yang paling pas. Pastikan waktu start dan end kata tetap dipertahankan sesuai data aslinya.
4. Jika terdapat kata-kata yang membingungkan konteks kalimat secara utuh, hapus saja kata tersebut dan kosongkan transkrip di waktu tersebut.

Konteks Klip: ${contextHint || 'Percakapan video YouTube short-form'}
Teks Asli: "${fullSentence}"

Daftar kata dengan timestamp:
${JSON.stringify(
      filteredWords.map((w) => ({
        w: w.word,
        s: w.start,
        e: w.end,
      }))
    )}

Kembalikan respon HANYA berupa JSON Array tanpa markdown code blocks:
[
  { "word": "KataPerbaikan", "start": 0.08, "end": 0.64 }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text?.trim();
    if (responseText) {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const refined: WordTimestamp[] = parsed.map((item: any, idx: number) => ({
          word: String(item.word || item.w || filteredWords[idx]?.word || '').trim(),
          start: typeof item.start === 'number' ? item.start : (filteredWords[idx]?.start ?? 0),
          end: typeof item.end === 'number' ? item.end : (filteredWords[idx]?.end ?? 0),
          confidence: 0.98,
        })).filter((w) => Boolean(w.word) && !/^\[.*?\]$/.test(w.word));

        if (refined.length > 0) {
          console.log(`[Gemini Refiner] Successfully refined ${refined.length} words.`);
          return refined;
        }
      }
    }
  } catch (err) {
    console.warn('[Gemini Refiner] Gemini refinement warning, fallback to filtered words:', err);
  }

  return filteredWords;
}

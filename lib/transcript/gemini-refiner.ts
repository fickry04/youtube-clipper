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
 * and ensure subtitle text is grammatically natural while STRICTLY preserving
 * the ground-truth acoustic timestamps (start/end) from Whisper.
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

    const prompt = `Anda adalah editor subtitle profesional untuk video pendek (Shorts/TikTok/Reels).
Tugas Anda:
1. Perbaiki kesalahan ejaan (typo) atau salah dengar kata dari hasil Speech-to-Text (Whisper) agar alami, tepat konteks, dan enak dibaca.
2. Hapus noise atau tag suara seperti [LAUGHS], [MUSIC], [APPLAUSE], tanda strip '-', atau tawa.
3. ATURAN SANGAT PENTING: Pertahankan pemetaan indeks "i" untuk setiap kata agar timing kemunculan subtitle 100% presisi dengan audio video aslinya.
4. Jika ada kata yang tidak perlu / noise murni, isi "w": "" (string kosong).

Konteks Klip: ${contextHint || 'Percakapan video YouTube short-form'}
Teks Asli Kalimat: "${fullSentence}"

Daftar kata terindeks:
${JSON.stringify(
      filteredWords.map((w, idx) => ({
        i: idx,
        w: w.word,
      }))
    )}

Kembalikan respon HANYA berupa JSON Array tanpa markdown code blocks:
[
  { "i": 0, "w": "KataPerbaikan" }
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
        const refined: WordTimestamp[] = [];

        for (const item of parsed) {
          const idx = typeof item.i === 'number' ? item.i : -1;
          const orig = idx >= 0 && idx < filteredWords.length ? filteredWords[idx] : null;

          if (!orig) continue;

          const fixedText = String(item.w || item.word || '').trim();
          if (!fixedText || /^\[.*?\]$/.test(fixedText)) continue;

          // If Gemini split into multiple words, distribute original timestamp span proportionally
          const subWords = fixedText.split(/\s+/).filter(Boolean);
          if (subWords.length === 1) {
            refined.push({
              word: subWords[0],
              start: orig.start,
              end: orig.end,
              confidence: 0.98,
            });
          } else if (subWords.length > 1) {
            const span = Math.max(0.1, orig.end - orig.start);
            const partDuration = span / subWords.length;
            subWords.forEach((sw, sIdx) => {
              refined.push({
                word: sw,
                start: Number((orig.start + sIdx * partDuration).toFixed(3)),
                end: Number((orig.start + (sIdx + 1) * partDuration).toFixed(3)),
                confidence: 0.98,
              });
            });
          }
        }

        if (refined.length > 0) {
          console.log(`[Gemini Refiner] Successfully refined ${refined.length} words with locked Whisper timestamps.`);
          return refined;
        }
      }
    }
  } catch (err) {
    console.warn('[Gemini Refiner] Gemini refinement warning, fallback to filtered words:', err);
  }

  return filteredWords;
}

import type { CaptionCue, WordTimestamp } from '../../remotion/types';

interface RawSegment {
  offset: number;
  duration: number;
  text: string;
  lang?: string | null;
}

/**
 * Heuristic phonetic weight for natural word duration estimation.
 * Takes syllable/vowel count, consonant length, and punctuation pause into account.
 */
function calculateWordPhoneticWeight(word: string): { weight: number; pauseAfter: number } {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  const vowels = (clean.match(/[aeiouy]/g) || []).length;
  const consonants = clean.length - vowels;

  // Base duration weight: vowels take longer to vocalize than consonants
  let weight = vowels * 1.5 + consonants * 1.0 + 1.0;

  // Detect punctuation pauses
  let pauseAfter = 0;
  if (/[.!?]$/.test(word)) {
    pauseAfter = 0.22; // Sentence ending pause
  } else if (/[,;:\-—]$/.test(word)) {
    pauseAfter = 0.12; // Comma / clause pause
  }

  return { weight: Math.max(1, weight), pauseAfter };
}

/**
 * Group sequential words into punchy pages (e.g. 2-3 words per cue)
 */
export function groupWordsIntoCues(
  words: WordTimestamp[],
  wordsPerPage: number = 3,
  clipDuration: number = 60
): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let cueId = 1;
  const pageSize = Math.max(1, Math.min(6, wordsPerPage));

  for (let i = 0; i < words.length; i += pageSize) {
    const pageWords = words.slice(i, i + pageSize);
    if (pageWords.length === 0) continue;

    const cueStart = pageWords[0].start;
    const cueEnd = pageWords[pageWords.length - 1].end;
    const text = pageWords.map((w) => w.word).join(' ');

    cues.push({
      id: cueId++,
      start: cueStart,
      end: Math.min(clipDuration, Math.max(cueStart + 0.2, cueEnd)),
      text,
      words: pageWords,
    });
  }

  return cues;
}

/**
 * Generate accurate word-level cues and grouped caption pages for short-form video.
 */
export function generateWordLevelCues(
  segments: RawSegment[],
  clipStart: number,
  clipDuration: number,
  wordsPerPage: number = 3
): CaptionCue[] {
  // 1. Filter overlapping transcript segments for this clip
  const overlapping = segments.filter((s) => {
    const sEnd = s.offset + s.duration;
    return sEnd > clipStart && s.offset < clipStart + clipDuration;
  });

  if (overlapping.length === 0) return [];

  // 2. Process each segment into word-level timestamps
  const allClipWords: WordTimestamp[] = [];

  for (const seg of overlapping) {
    const text = seg.text.replace(/\n+/g, ' ').trim();
    if (!text) continue;

    const rawWords = text.split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) continue;

    // Relative segment boundaries within the clip
    const segStartRel = Math.max(0, seg.offset - clipStart);
    const segEndRel = Math.min(clipDuration, seg.offset + seg.duration - clipStart);
    const segTotalDuration = Math.max(0.1, segEndRel - segStartRel);

    const phoneticInfo = rawWords.map(calculateWordPhoneticWeight);
    const totalPauses = phoneticInfo.reduce((acc, p) => acc + p.pauseAfter, 0);
    const effectiveSpeechDuration = Math.max(0.1, segTotalDuration - totalPauses);
    const totalWeight = phoneticInfo.reduce((acc, p) => acc + p.weight, 0) || 1;

    let currentWordStart = segStartRel;

    for (let i = 0; i < rawWords.length; i++) {
      const word = rawWords[i];
      const { weight, pauseAfter } = phoneticInfo[i];

      const durationFraction = weight / totalWeight;
      const wordSpokenDuration = effectiveSpeechDuration * durationFraction;
      const wordEnd = Math.min(
        segEndRel,
        currentWordStart + Math.max(0.12, wordSpokenDuration)
      );

      allClipWords.push({
        word,
        start: Number(currentWordStart.toFixed(3)),
        end: Number(wordEnd.toFixed(3)),
        confidence: 0.95,
      });

      currentWordStart = Math.min(segEndRel, wordEnd + pauseAfter);
    }
  }

  // 3. Group words into punchy pages
  return groupWordsIntoCues(allClipWords, wordsPerPage, clipDuration);
}

/**
 * Format timestamp to standard SRT string (HH:MM:SS,mmm)
 */
function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return (
    `${String(h).padStart(2, '0')}:` +
    `${String(m).padStart(2, '0')}:` +
    `${String(s).padStart(2, '0')},` +
    `${String(ms).padStart(3, '0')}`
  );
}

/**
 * Convert CaptionCue list to clean SRT string
 */
export function cuesToSrt(cues: CaptionCue[]): string {
  return cues
    .map(
      (c, idx) =>
        `${idx + 1}\n${formatSrtTimestamp(c.start)} --> ${formatSrtTimestamp(
          c.end
        )}\n${c.text}`
    )
    .join('\n\n');
}

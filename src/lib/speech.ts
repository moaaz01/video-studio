/**
 * Speech helpers shared by every scene that speaks: the character's mouth, the
 * footage captions, the tutorial narrator. Word timings are seconds from the beat
 * start, compiled by `make_timeline.py` (measured when the VO has timestamps,
 * estimated from the measured duration otherwise).
 */

export type WordTiming = {w: string; start: number; end: number};

const TASHKEEL = /[ؗ-ًؚ-ٰٟۖ-ۭ]/g;

/** Display copy never carries tashkeel; the VO script does. */
export const stripTashkeel = (s: string): string => s.replace(TASHKEEL, '');

export type Viseme = 'rest' | 'open' | 'wide' | 'round';

/** The vowel a letter implies, Arabic first. Anything else keeps the current shape. */
const shapeOf = (ch: string): Viseme | null => {
  if ('اآأإىaáَ'.includes(ch)) return 'open';
  if ('يeiíéِ'.includes(ch)) return 'wide';
  if ('وؤouóúُ'.includes(ch)) return 'round';
  return null;
};

/**
 * Mouth state at time `t`: how open (0–1) and which shape. Inside a word the jaw
 * flaps once per ~2 letters (a syllable proxy), so a long word does not read as one
 * held vowel; between words the mouth rests.
 */
export const mouthAt = (words: WordTiming[], t: number): {open: number; viseme: Viseme} => {
  const word = words.find((w) => t >= w.start && t < w.end);
  if (!word) return {open: 0, viseme: 'rest'};
  const letters = Array.from(word.w.toLowerCase());
  const span = Math.max(0.05, word.end - word.start);
  const p = (t - word.start) / span;
  const syllables = Math.max(1, Math.round(letters.length / 2));
  const flap = Math.abs(Math.sin(p * Math.PI * syllables));
  const idx = Math.min(letters.length - 1, Math.floor(p * letters.length));
  let viseme: Viseme = 'open';
  for (let i = idx; i >= 0; i--) {
    const s = shapeOf(letters[i]);
    if (s) {
      viseme = s;
      break;
    }
  }
  return {open: 0.25 + 0.75 * flap, viseme};
};

/** Is anyone talking at `t`? Used for head bob and gesture energy. */
export const talkingAt = (words: WordTiming[], t: number): boolean =>
  words.some((w) => t >= w.start - 0.05 && t < w.end + 0.1);

/**
 * Caption pages: up to `max` words per page, a new page on a long pause or on
 * sentence punctuation. A page is on screen from its first word to its last.
 */
export const captionPages = (words: WordTiming[], max = 4, gap = 0.45): WordTiming[][] => {
  const pages: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const breakHere = cur.length >= max || (prev && w.start - prev.end > gap) || (prev && /[.!?؟،,]$/.test(prev.w));
    if (breakHere && cur.length) {
      pages.push(cur);
      cur = [];
    }
    cur.push(w);
  });
  if (cur.length) pages.push(cur);
  return pages;
};

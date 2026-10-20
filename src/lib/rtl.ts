/** Arabic text utilities: numerals, direction detection, safe word splitting. */

export const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Western → Arabic-Indic digits. The app renders numbers through the `ar` locale,
 * so on-screen numbers must be Arabic-Indic to match the product exactly.
 */
export const toAr = (v: string | number): string =>
  String(v).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);

/** Arabic-Indic → Western (for logic, never for display). */
export const toWestern = (v: string): string =>
  v.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

const RTL_RANGE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** Count Arabic words, not the first letter — captions often start with "StudyAI". */
export const isRtl = (text: string): boolean => {
  const ws = text.split(/\s+/).filter(Boolean);
  const hits = ws.filter((w) => RTL_RANGE.test(w)).length;
  return hits > ws.length / 2;
};

/**
 * Split for animation. NEVER split Arabic into letters: each letter would be
 * shaped in isolation and the word would disintegrate into disconnected forms.
 * Words (split on whitespace) stay fully shaped.
 */
export const arWords = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** Basic Arabic pluralisation-free helpers for the copy we ship. */
export const pct = (n: number): string => `${toAr(n)}٪`;

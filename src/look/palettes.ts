/**
 * Palettes for motion graphics: one named set of five roles per film or beat.
 *
 * Each palette is a direction, not a brand: bg/bg2 build the depth of the ground,
 * ink is every word, accent is the one thing the eye must land on, accent2 is its
 * rare counterpoint (never more than one element per frame). Contrast of ink on bg
 * is ≥ 7:1 on every palette; accent on bg ≥ 4.5:1 for large type.
 */
export type Palette = {
  bg: string;
  bg2: string;
  ink: string;
  accent: string;
  accent2: string;
  dark: boolean;
};

export const PALETTES = {
  /** night-blue ground, warm signal: the data-story default */
  'midnight-amber': {bg: '#0B0F1A', bg2: '#16203A', ink: '#F5F3EE', accent: '#F2C14E', accent2: '#3DD6C4', dark: true},
  /** synth night: violet depth with a hot counterpoint, for tech and AI */
  'electric-indigo': {bg: '#0A0820', bg2: '#22185A', ink: '#F4F1FF', accent: '#9B8CFF', accent2: '#FF5CA8', dark: true},
  /** deep green and gold: money, heritage, trust */
  'emerald-gold': {bg: '#05231C', bg2: '#0D4636', ink: '#F3F7F2', accent: '#E8C46A', accent2: '#3CCB8F', dark: true},
  /** cold ocean with a sun accent: space, earth, science */
  'ocean-cyan': {bg: '#04131F', bg2: '#0B3350', ink: '#EAF6FF', accent: '#33D1FF', accent2: '#FFB547', dark: true},
  /** plum dusk with coral: body, mind, people */
  'sunset-plum': {bg: '#1A0B1E', bg2: '#3A1544', ink: '#FFF1EA', accent: '#FF8A3D', accent2: '#FF4F8B', dark: true},
  /** black, white and one red: editorial urgency */
  'mono-red': {bg: '#0D0D0D', bg2: '#202020', ink: '#F2F2F2', accent: '#FF3B30', accent2: '#FFFFFF', dark: true},
  /** warm paper, ink and terracotta: calm explainers in daylight */
  'sand-ink': {bg: '#F4EDE1', bg2: '#E6D7BF', ink: '#1C1A17', accent: '#C9482A', accent2: '#1F6F78', dark: false},
  /** off-white with cobalt and orange: clean product and finance */
  'paper-cobalt': {bg: '#F7F6F2', bg2: '#E4E2DA', ink: '#10162F', accent: '#2747F5', accent2: '#FF7A1A', dark: false},
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export const resolvePalette = (name?: string): Palette | null =>
  name && name in PALETTES ? PALETTES[name as PaletteName] : null;

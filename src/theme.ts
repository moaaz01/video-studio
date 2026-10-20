/**
 * StudyAI design tokens — transcribed from the Android app's Compose theme so the
 * video and the product are literally the same design system.
 *
 *   ui/theme/Color.kt · Spacing.kt · Shape.kt · Type.kt · Motion.kt · Theme.kt
 *
 * Rules that must never be broken:
 *   - Arabic always `letterSpacing: 0`, never `text-transform`.
 *   - Only these colors. `DreamIris` is reserved for the agent avatar, never décor.
 *   - Radii, spacing and type sizes are in dp/sp; multiply by the phone's px-per-dp.
 */

export const C = {
  // ── light surfaces (Color.kt) ──────────────────────────────────────────────
  paper: '#FBF7F0',
  paperRaised: '#FFFFFF',
  paperSunken: '#F1E9DB',
  ink: '#1A2A36',
  inkSoft: '#566472',
  inkFaint: '#8C97A1',
  hairline: '#EADFCD',

  // ── accents ───────────────────────────────────────────────────────────────
  emerald: '#0E8A6E',
  emeraldDeep: '#0A6B56',
  emeraldSoft: '#D6EFE6',
  amber: '#D9982F',
  amberSoft: '#FAE9CC',
  plum: '#6A57A6',
  plumSoft: '#E7E1F6',
  coral: '#DB6048',
  coralSoft: '#FADDD4',
  sky: '#2B86A8',
  skySoft: '#D7E9F1',
  dreamIris: '#6B5CE7',

  // ── dark surfaces ─────────────────────────────────────────────────────────
  inkBg: '#13110D',
  inkSurface: '#1D1A14',
  inkSurfaceHi: '#29251D',
  parchment: '#F1E9DC',
  parchmentSoft: '#B4AB99',
  hairlineDark: '#332E25',
  emeraldLit: '#36C4A0',
} as const;

/** Theme.kt `heroGradient` — light and dark variants. */
export const HERO_LIGHT = ['#0E8A6E', '#0A6B56', '#114E47'] as const;
export const HERO_DARK = ['#115E4C', '#0C463A', '#0A2E29'] as const;

export const heroLight = (deg = 135) =>
  `linear-gradient(${deg}deg, ${HERO_LIGHT[0]} 0%, ${HERO_LIGHT[1]} 52%, ${HERO_LIGHT[2]} 100%)`;
export const heroDark = (deg = 135) =>
  `linear-gradient(${deg}deg, ${HERO_DARK[0]} 0%, ${HERO_DARK[1]} 52%, ${HERO_DARK[2]} 100%)`;

/** Spacing.kt — dp */
export const SP = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 40,
  screen: 20, section: 30, bottomBar: 108,
} as const;

/** Shape.kt — dp */
export const R = {
  xs: 10, sm: 14, md: 20, lg: 28, xl: 36, bar: 30, pill: 999,
} as const;

/**
 * Type.kt — the Compose `Typography`, in sp with the app's line-heights.
 * Tajawal only: 400 / 500 / 700 / 800.
 */
export const T = {
  displayLarge:   {size: 34, lh: 42, w: 800},
  displayMedium:  {size: 30, lh: 38, w: 800},
  displaySmall:   {size: 28, lh: 36, w: 700},
  headlineLarge:  {size: 26, lh: 34, w: 700},
  headlineMedium: {size: 22, lh: 30, w: 700},
  headlineSmall:  {size: 19, lh: 27, w: 700},
  titleLarge:     {size: 18, lh: 26, w: 700},
  titleMedium:    {size: 16, lh: 24, w: 500},
  titleSmall:     {size: 14, lh: 20, w: 500},
  bodyLarge:      {size: 16, lh: 26, w: 400},
  bodyMedium:     {size: 14, lh: 23, w: 400},
  bodySmall:      {size: 12, lh: 18, w: 400},
  labelLarge:     {size: 14, lh: 18, w: 700},
  labelMedium:    {size: 12, lh: 16, w: 500},
  labelSmall:     {size: 11, lh: 15, w: 500},
} as const;

export type TypeKey = keyof typeof T;

/** Motion.kt */
export const MOTION = {
  fast: 180,
  normal: 340,
  slow: 620,
  breath: 700,
  stagger: 24,        // per-item entrance step (ms) — capped at 5 items
  holdMs: 8000,
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  settleSpring: {damping: 29.2, stiffness: 380, mass: 1},
} as const;

/** Elevation: warm ink-tinted shadows, never pure black. */
export const shadow = {
  card: '0 6px 18px -6px rgba(26,42,54,0.16), 0 2px 4px rgba(26,42,54,0.06)',
  bar: '0 -10px 30px -12px rgba(26,42,54,0.22), 0 8px 24px -10px rgba(26,42,54,0.18)',
  float: '0 24px 60px -20px rgba(26,42,54,0.30)',
  hero: '0 18px 40px -14px rgba(10,107,86,0.45)',
} as const;

// ── video canvas ─────────────────────────────────────────────────────────────
export const VIDEO = {width: 1920, height: 1080, fps: 30} as const;

/** The app's logical canvas: 412 x 915 dp. */
export const APP_W_DP = 412;
export const APP_H_DP = 915;

/** Frame geometry in the 1920x1080 design space. */
export const PHONE = {
  /** default on-screen width in px; scenes may override */
  width: 434,
  bezel: 9,
  screenRadius: 44,
  frameRadius: 54,
} as const;

/** Layout columns for the two-column "type + phone" scenes. */
export const LAYOUT = {
  /** phone box */
  phoneLeft: 470,
  /** Arabic type column (right-aligned, RTL) */
  textRight: 1836,
  textMax: 700,
  marginX: 84,
} as const;

export const FONT = {
  tajawal: 'Tajawal',
  amiri: 'Amiri',
  naskh: 'NotoNaskhArabic',
} as const;

/**
 * The store app's design tokens — transcribed from the real Mini App.
 *
 * Source of truth (read-only): `bot-store-saas/webapp/src/styles/tokens.css`
 * (values also tabulated in `docs/apps/tg-store-brief.md` §2.3–§2.5).
 * The film may only use these colours, fonts and radii; the stage palette below
 * is the film's own lighting, derived from the same two brand hues.
 */

export const S = {
  // ── light surfaces (the product world) ────────────────────────────────────
  bg: '#EEF1F6',
  bgWash: 'rgba(15,124,128,0.10)',
  glass1: 'rgba(255,255,255,0.72)',
  glass2: 'rgba(255,255,255,0.86)',
  glass3: 'rgba(255,255,255,0.95)',
  solid1: '#FFFFFF',
  solid2: '#F6F8FB',
  sunken: 'rgba(20,26,38,0.05)',

  // ── dark theme (owner panel night screenshot, unused by day screens) ──────
  stage: '#0E131B',
  stageRaised: '#1B2432',
  inkOnDark: '#E8ECF3',

  // ── ink ──────────────────────────────────────────────────────────────────
  ink: '#141A26',
  muted: '#5B6577',
  faint: '#5D687B',

  // ── brand ────────────────────────────────────────────────────────────────
  brand: '#0F7C80',
  brandDark: '#2AA5A9',
  brandText: '#0B6A6E',
  brandSoft: '#D6EFEF',
  brandDarkSoft: '#0F3A3C',
  onBrand: '#FFFFFF',

  // ── money: saffron only ──────────────────────────────────────────────────
  saffron: '#F2A93B',
  saffronInk: '#2B1B00',
  saffronSoft: 'rgba(242,169,59,0.18)',
  saffronText: '#8A5A00',

  // ── semantics ────────────────────────────────────────────────────────────
  success: '#1E9E6A',
  danger: '#D9483B',
  warning: '#9A8400',
  border: 'rgba(20,26,38,0.08)',
  borderStrong: 'rgba(20,26,38,0.16)',

  // ── film stage (lighting only, never UI) ─────────────────────────────────
  night: '#06171F',
  nightRaised: '#0A1A21',
  // golden-souk stage lighting (the warm delivery stage)
  golden: '#241307',
  goldenMid: '#3A1F0E',
  goldenDeep: '#122528',
  nightDeep: '#030A0F',
  cobalt: '#0B1730',
  cobaltDeep: '#040814',
  ice: '#9CC8FF',
  ivory: '#F3F7FF',
  gold: '#F2A93B',
  tealLight: '#2AA5A9',
} as const;

/** Shape.kt / tokens.css radii — 8 / 14 / 20 / 28 / 999 dp. */
export const R = {xs: 8, sm: 14, md: 20, lg: 28, pill: 999} as const;

/** fonts.css: display = Reem Kufi, text = IBM Plex Sans Arabic. */
export const F = {display: 'Reem Kufi', headline: 'Tajawal', text: 'IBM Plex Sans Arabic'} as const;

/** tokens.css elevation e1/e2/e3 — warm ink-tinted, never pure black. */
export const SH = {
  e1: '0 1px 2px rgba(20,26,38,0.06), 0 6px 16px -8px rgba(20,26,38,0.18)',
  e2: '0 2px 6px rgba(20,26,38,0.07), 0 14px 30px -14px rgba(20,26,38,0.26)',
  e3: '0 8px 22px rgba(20,26,38,0.10), 0 32px 64px -18px rgba(20,26,38,0.34)',
} as const;

/** The glass recipe used by every floating surface. */
export const GLASS = 'blur(18px) saturate(1.5)';

/** The app's logical canvas (webapp viewport in the design kit). */
export const APP = {w: 412, h: 915} as const;

/** tokens.css motion — 160 / 220 / 260 ms. */
export const MOTION = {fast: 160, base: 220, slow: 260, ease: 'cubic-bezier(0.2,0.8,0.2,1)'} as const;

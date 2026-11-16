/**
 * Brand tokens → CSS custom properties.
 *
 * Astryx owns the component contract; this file owns the client's identity. A
 * brand is one entry in `brands.json` with a light and a dark token set. Every
 * screen reads the same names, so adding a client never touches a component.
 *
 * The token names map onto Astryx's semantic roles (`--color-accent`,
 * `--color-background-card`, …) plus a few brand-only names for decoration.
 */
import type {CSSProperties} from 'react';
import rawBrands from '../brands.json';

export type BrandMode = 'light' | 'dark';

export type BrandTokens = {
  accent: string;
  accentDeep: string;
  accentSoft: string;
  accentInk: string;
  paper: string;
  surface: string;
  sunken: string;
  ink: string;
  muted: string;
  border: string;
  borderStrong: string;
  gold: string;
  goldSoft: string;
  rose: string;
  /** RGB triplet, used to build tinted shadows that belong to the palette. */
  shadow: string;
};

export type Brand = {
  slug: string;
  name: string;
  tagline: string;
  monogram: string;
  currency: string;
  light: BrandTokens;
  dark: BrandTokens;
};

export const BRANDS = rawBrands as unknown as Record<string, Brand>;

export function getBrand(key: string): Brand {
  const brand = BRANDS[key];
  if (!brand) {
    throw new Error(`Unknown brand "${key}". Add it to tools/mockups/brands.json.`);
  }
  return brand;
}

const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';

/**
 * The wrapper's inline custom properties. They sit below `html`, so they win
 * over the theme's tokens without editing Astryx's generated CSS.
 */
export function brandVars(brand: Brand, mode: BrandMode): CSSProperties {
  const t = brand[mode];
  const radius = mode === 'light' ? 20 : 20;
  const vars: Record<string, string> = {
    '--brand-accent': t.accent,
    '--brand-accent-deep': t.accentDeep,
    '--brand-accent-soft': t.accentSoft,
    '--brand-accent-ink': t.accentInk,
    '--brand-paper': t.paper,
    '--brand-surface': t.surface,
    '--brand-sunken': t.sunken,
    '--brand-ink': t.ink,
    '--brand-muted': t.muted,
    '--brand-border': t.border,
    '--brand-border-strong': t.borderStrong,
    '--brand-gold': t.gold,
    '--brand-gold-soft': t.goldSoft,
    '--brand-rose': t.rose,
    '--brand-shadow': t.shadow,

    // Astryx semantic roles
    '--color-accent': t.accent,
    '--color-accent-muted': t.accentSoft,
    '--color-on-accent': t.accentInk,
    '--color-text-accent': t.accent,
    '--color-icon-accent': t.accent,
    '--color-background-body': t.paper,
    '--color-background-card': t.surface,
    '--color-background-surface': t.surface,
    '--color-background-muted': t.sunken,
    '--color-text-primary': t.ink,
    '--color-text-secondary': t.muted,
    '--color-border': t.border,
    '--color-border-emphasized': t.borderStrong,
    '--color-shadow': `rgba(${t.shadow}, 0.18)`,

    // Shape + type
    '--radius-page': `${radius + 6}px`,
    '--radius-container': `${radius}px`,
    '--radius-element': `${Math.round(radius * 0.6)}px`,
    '--radius-inner': `${Math.round(radius * 0.4)}px`,
    '--font-family-body': FONT,
    '--font-family-heading': FONT,
  };
  return vars as CSSProperties;
}

/** Western digits with a thousands separator, per the studio's copy rules. */
export function money(value: number, brand: Brand): string {
  // LRI/PDI isolate the price as one LTR run. Without it, a trailing currency
  // symbol is reordered by the RTL paragraph and reads as "$ 1,200" instead of
  // "1,200 $".
  return `\u2066${new Intl.NumberFormat('en-US').format(value)} ${brand.currency}\u2069`;
}

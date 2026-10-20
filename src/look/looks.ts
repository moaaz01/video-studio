/**
 * The look system: a named grade applied to the whole film at compose time.
 *
 * Grade is CSS-filter based on purpose: it survives any renderer, costs nothing,
 * and is deterministic — the same frame always draws the same pixels. Grain is a
 * rasterised SVG turbulence tile that only shifts its offset per frame, so it is
 * animated but never random.
 *
 * Looks are a budget, not a palette: pick one per film, never mix.
 */

export type LookName = "cinema-warm" | "paper-clean" | "ink-noir" | "vivid-launch";

export type Look = {
  name: LookName;
  /**
   * The grading curves live in `src/generated/grade.json`, derived from the app's
   * own palette by `scripts/lut.py`. One definition, so the SVG filter and the
   * 3D LUT can never disagree.
   */
  /** 0..1 edge darkening */
  vignette: number;
  /** 0..0.12 grain opacity */
  grain: number;
  /** 0..1 warm top bloom (halation proxy) */
  bloom: number;
  /** 0..0.12 letterbox per bar */
  letterbox: number;
  /** how much camera drift the scenes get */
  camera: number;
  /** 180-degree shutter samples; 0 = no motion blur (cheap), 3 = film cadence */
  motionBlur: number;
};

export const LOOKS: Record<LookName, Look> = {
  "cinema-warm": {
    name: "cinema-warm",
    vignette: 0.32,
    grain: 0.055,
    bloom: 0.55,
    letterbox: 0,
    camera: 1,
    motionBlur: 3,
  },
  "paper-clean": {
    name: "paper-clean",
    vignette: 0.12,
    grain: 0.03,
    bloom: 0.18,
    letterbox: 0,
    camera: 0.55,
    motionBlur: 0,
  },
  "ink-noir": {
    name: "ink-noir",
    vignette: 0.42,
    grain: 0.07,
    bloom: 0.3,
    letterbox: 0.055,
    camera: 0.8,
    motionBlur: 2,
  },
  "vivid-launch": {
    name: "vivid-launch",
    vignette: 0.24,
    grain: 0.04,
    bloom: 0.7,
    letterbox: 0,
    camera: 1.25,
    motionBlur: 3,
  },
};

export const DEFAULT_LOOK: LookName = "cinema-warm";

export const resolveLook = (name?: string): Look =>
  LOOKS[(name as LookName) ?? DEFAULT_LOOK] ?? LOOKS[DEFAULT_LOOK];

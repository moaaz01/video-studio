/** Motion primitives shared by every scene. Tokens mirror `ui/theme/Motion.kt`. */
import {Easing, interpolate, spring} from 'remotion';

export const E = {
  /** Motion.kt `EaseOutExpo` */
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  /** Motion.kt `EaseInOut` */
  inOut: Easing.bezier(0.4, 0, 0.2, 1),
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
  inExpo: Easing.bezier(0.7, 0, 0.84, 0),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const SPRING = {
  /** Motion.kt `SettleSpring` — the app's own settle feel */
  settle: {damping: 29.2, stiffness: 380, mass: 1},
  /** Apple-style: high damping, zero overshoot */
  soft: {damping: 200, stiffness: 120, mass: 0.8},
  /** a little life on taps and pops */
  pop: {damping: 16, stiffness: 320, mass: 0.7},
  /** heavy, slow, cinematic */
  slow: {damping: 200, stiffness: 55, mass: 1.2},
  /** snappy UI element entry */
  ui: {damping: 26, stiffness: 460, mass: 0.8},
} as const;

/** Remotion interpolation options: never overshoot a 0→1 tween. */
export const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Unit clamp with optional bounds. */
export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));

/** Eased 0→1 over `durFrames`, starting at `start` (frames). */
export const tween = (
  frame: number,
  start: number,
  durFrames: number,
  ease: (v: number) => number = E.outExpo,
): number =>
  interpolate(frame, [start, start + Math.max(1, durFrames)], [0, 1], {
    ...CLAMP,
    easing: ease,
  });

/** Spring 0→1 with `delay` frames. Accepts a preset or a custom config. */
export const sp = (
  frame: number,
  fps: number,
  delay = 0,
  config: {damping?: number; stiffness?: number; mass?: number} = SPRING.settle,
): number => spring({frame: frame - delay, fps, config: {...SPRING.settle, ...config}});

export type Entrance = {o: number; y: number; s: number; b: number; r: number};

/**
 * The universal element entrance: opacity + lift + scale + blur, one easing family.
 * `blur` is in px; 0 at rest. Keep `dist` small (8–24px) — big moves read as cheap.
 */
export const entrance = (
  frame: number,
  delay: number,
  opts: {dist?: number; dur?: number; from?: number; blur?: number; rotate?: number} = {},
): Entrance => {
  const {dist = 18, dur = 26, from = 0.96, blur = 10, rotate = 0} = opts;
  const t = tween(frame, delay, dur);
  return {
    o: t,
    y: (1 - t) * dist,
    s: from + (1 - from) * t,
    b: (1 - t) * blur,
    r: (1 - t) * rotate,
  };
};

/** Apply an Entrance to a style object. */
export const entStyle = (
  e: Entrance,
  extra: React.CSSProperties = {},
): React.CSSProperties => ({
  opacity: e.o,
  transform: `translate3d(0,${e.y}px,0) scale(${e.s}) rotate(${e.r}deg)`,
  filter: e.b > 0.25 ? `blur(${e.b.toFixed(2)}px)` : undefined,
  ...extra,
});

/** Count-up that respects the frame clock (integers). */
export const countUp = (
  frame: number,
  start: number,
  durFrames: number,
  to: number,
  from = 0,
): number =>
  Math.round(
    interpolate(frame, [start, start + Math.max(1, durFrames)], [from, to], {
      ...CLAMP,
      easing: E.outExpo,
    }),
  );

/** 0→1→0 pulse, useful for glows and attention ticks. */
export const pulse = (frame: number, period: number, phase = 0): number =>
  (1 - Math.cos(((frame / period + phase) * Math.PI * 2) % (Math.PI * 2))) / 2;

/** Deterministic pseudo-random in [0,1) — never `Math.random()` in a render. */
export const rnd = (i: number, salt = 1): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

/** Smooth in-out over a window, 0 outside. */
export const window01 = (frame: number, a: number, b: number, easeIn = 8, easeOut = 8): number => {
  const up = tween(frame, a, easeIn);
  const down = 1 - tween(frame, b - easeOut, easeOut);
  return Math.min(up, down);
};

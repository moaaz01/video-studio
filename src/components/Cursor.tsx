import React from 'react';
import {Easing, Img, interpolate, staticFile} from 'remotion';
import {E} from '../lib/anim';
import {FONT} from '../theme';

/**
 * The studio cursor and its click, shared by every scene that shows a pointer.
 *
 * Sized for video, not for a desktop: an actual-size arrow disappears at 1080p, so
 * the pointer is ~4.5% of the long side. A click is a press (scale 0.84 over 0.1 s,
 * pivot at the arrow tip) and a release twice as long (0.22 s), the 1:2 ratio that
 * reads as a real tap. The ripple and the target's own press start on the same
 * frame as the cursor's press; the foley for it is compiled from the same step time
 * (scripts/foley.py), so picture and sound share one clock.
 */

export const PRESS_S = 0.1;
export const RELEASE_S = 0.22;

/** Scale of the pointer at `since` seconds after a click (1 when idle). */
export const pressScale = (since: number): number => {
  if (since < 0 || since > PRESS_S + RELEASE_S) return 1;
  if (since <= PRESS_S) return interpolate(since, [0, PRESS_S], [1, 0.84], {easing: Easing.in(Easing.quad)});
  return interpolate(since, [PRESS_S, PRESS_S + RELEASE_S], [0.84, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
};

export const Pointer: React.FC<{size: number; scale?: number}> = ({size, scale = 1}) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    style={{transform: `scale(${scale})`, transformOrigin: '17% 8%', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))', overflow: 'visible'}}>
    <path d="M4 2 L4 19 L8.5 14.8 L11.4 21.4 L14.3 20.1 L11.5 13.6 L17.6 13.6 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/** A ring that leaves the click point; `kind: 'none'` draws nothing. */
export const Ripple: React.FC<{since: number; size: number; color: string; kind?: 'ring' | 'none'}> = ({since, size, color, kind = 'ring'}) => {
  if (kind === 'none' || since < 0 || since > 0.5) return null;
  const k = interpolate(since, [0, 0.5], [0, 1], {easing: E.outQuart});
  return (
    <>
      {[0, 0.12].map((d) => {
        const kk = Math.max(0, Math.min(1, (k - d) / (1 - d)));
        return (
          <div key={d} style={{position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: 999,
            border: `${Math.max(2, size * 0.045 * (1 - kk))}px solid ${color}`,
            transform: `translate(-50%,-50%) scale(${0.25 + kk})`, opacity: (1 - kk) * (d ? 0.6 : 1)}} />
        );
      })}
    </>
  );
};

/**
 * The real button presses: the capture's own pixels inside `box` are lifted onto a
 * layer that dips to 0.94 and darkens with the cursor, then springs back. Nothing is
 * redrawn, so the press can only show what the app really looks like.
 */
export const PressTarget: React.FC<{
  src: string; since: number; box: [number, number, number, number];
  sw: number; sh: number; zoom: number; ox: number; oy: number; radius: number;
}> = ({src, since, box, sw, sh, zoom, ox, oy, radius}) => {
  if (since < 0 || since > PRESS_S + RELEASE_S) return null;
  const s = pressScale(since);
  const k = 1 - (s - 0.84) / 0.16; // 0 idle -> 1 fully pressed
  const [bx, by, bw, bh] = box;
  const W = sw * zoom;
  const H = sh * zoom;
  return (
    <div style={{position: 'absolute', left: ox + bx * W, top: oy + by * H, width: bw * W, height: bh * H, overflow: 'hidden',
      borderRadius: radius, transform: `scale(${1 - 0.06 * k})`, filter: `brightness(${1 - 0.1 * k})`,
      boxShadow: `0 ${6 * (1 - k)}px ${18 * (1 - k)}px rgba(0,0,0,${0.25 * (1 - k)})`}}>
      <Img src={staticFile(src)} style={{position: 'absolute', left: -bx * W, top: -by * H, width: W, height: H, maxWidth: 'none'}} />
    </div>
  );
};

/** Keyboard shortcut badges (Ctrl, C…) under the screen, for the step that types them. */
export const KeyCaps: React.FC<{keys: string[]; since: number; unit: number; dark: boolean}> = ({keys, since, unit, dark}) => {
  if (!keys.length || since < -0.05 || since > 1.6) return null;
  const inK = interpolate(since, [-0.05, 0.12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.outExpo});
  const outK = interpolate(since, [1.35, 1.6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inExpo});
  return (
    <div dir="ltr" style={{display: 'flex', gap: 12 * unit, opacity: Math.min(inK, outK), transform: `translateY(${(1 - inK) * 14 * unit}px)`}}>
      {keys.map((key, i) => {
        const down = since >= i * 0.1 && since < i * 0.1 + 0.18;
        return (
          <div key={`${key}-${i}`} style={{minWidth: 64 * unit, padding: `${10 * unit}px ${18 * unit}px`, borderRadius: 14 * unit,
            fontFamily: FONT.tajawal, fontWeight: 800, fontSize: 34 * unit, textAlign: 'center',
            color: dark ? '#fff' : '#111', background: dark ? 'rgba(255,255,255,0.12)' : '#fff',
            border: `${2 * unit}px solid ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)'}`,
            boxShadow: down ? `0 ${1 * unit}px 0 rgba(0,0,0,0.3)` : `0 ${5 * unit}px 0 rgba(0,0,0,0.3)`,
            transform: `translateY(${down ? 4 * unit : 0}px)`}}>
            {key}
          </div>
        );
      })}
    </div>
  );
};

/** Default camera zoom per action, after Screenize-style activity zoom: read closer, scroll wider. */
export const ACTION_ZOOM: Record<string, number> = {click: 1.8, type: 2.4, scroll: 1.25, drag: 1.5, hover: 1.6};

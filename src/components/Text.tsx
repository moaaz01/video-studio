import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, tween} from '../lib/anim';
import {arWords} from '../lib/rtl';
import {FONT} from '../theme';

/** Latin runs (numbers, "PDF") must be bidi-isolated or they jump position in RTL. */
export const LD: React.FC<{s: string | number; style?: React.CSSProperties}> = ({s, style}) => (
  <span dir="ltr" style={{unicodeBidi: 'isolate', ...style}}>
    {s}
  </span>
);

type Mode = 'block' | 'words' | 'mask';

export type ArProps = {
  text: string;
  size: number;
  weight?: number;
  color?: string;
  /** line-height multiplier; Arabic body needs 1.7–1.85, headings 1.28–1.40 */
  lh?: number;
  align?: 'right' | 'center' | 'left';
  delay?: number;
  /** frames between words (words mode) */
  step?: number;
  dur?: number;
  mode?: Mode;
  family?: string;
  style?: React.CSSProperties;
  /** words to paint in `emphasisColor` */
  emphasis?: string[];
  emphasisColor?: string;
  nowrap?: boolean;
};

/**
 * Arabic display text.
 *
 * The whole container carries `dir="rtl"` + `lang="ar"`; that is not cosmetic —
 * an `inline-block` word is bidi-neutral, so without an explicit base direction
 * the line lays out LTR and reads backwards while every word still looks right.
 *
 * Words are split on whitespace only. Arabic is never split into letters: each
 * letter would be shaped in isolation and the word would fall apart.
 */
export const Ar: React.FC<ArProps> = ({
  text,
  size,
  weight = 400,
  color = 'currentColor',
  lh = 1.35,
  align = 'right',
  delay = 0,
  step = 3,
  dur = 26,
  mode = 'block',
  family = FONT.tajawal,
  style,
  emphasis,
  emphasisColor,
  nowrap,
}) => {
  const frame = useCurrentFrame();

  const base: React.CSSProperties = {
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
    lineHeight: lh,
    color,
    letterSpacing: 0, // never on Arabic — breaks cursive joining
    textAlign: align,
    whiteSpace: nowrap ? 'nowrap' : 'pre-wrap',
    ...style,
  };

  if (mode === 'block') {
    const t = tween(frame, delay, dur);
    return (
      <div
        dir="rtl"
        lang="ar"
        style={{
          ...base,
          opacity: t,
          transform: `translate3d(0,${((1 - t) * size * 0.22).toFixed(1)}px,0)`,
        }}
      >
        {text}
      </div>
    );
  }

  if (mode === 'mask') {
    const t = tween(frame, delay, Math.max(dur, 30));
    return (
      <div
        dir="rtl"
        lang="ar"
        style={{
          ...base,
          display: 'block',
          overflow: 'hidden',
          // generous vertical padding so descenders + diacritics are never clipped
          paddingTop: size * 0.24,
          paddingBottom: size * 0.3,
          marginTop: -size * 0.24,
          marginBottom: -size * 0.3,
        }}
      >
        <div
          style={{
            transform: `translate3d(0,${(1 - t) * 108}%,0)`,
            opacity: 0.15 + 0.85 * t,
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  // ── words ────────────────────────────────────────────────────────────────
  const ws = arWords(text);
  const justify = align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end';
  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        ...base,
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: size * 0.26,
        rowGap: 0,
        justifyContent: justify,
        whiteSpace: 'normal',
      }}
    >
      {ws.map((w, i) => {
        const t = tween(frame, delay + i * step, dur);
        const isEm = emphasis?.includes(w);
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: 'inline-block',
              opacity: t,
              transform: `translate3d(0,${((1 - t) * size * 0.34).toFixed(1)}px,0)`,
              filter: t < 0.99 ? `blur(${((1 - t) * 7).toFixed(2)}px)` : undefined,
              color: isEm && emphasisColor ? emphasisColor : undefined,
              fontWeight: isEm ? Math.min(900, weight) : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Small emerald kicker above a headline, with a hand-drawn-looking rule. */
export const Kicker: React.FC<{
  text: string;
  delay?: number;
  color?: string;
  size?: number;
  side?: 'right' | 'left';
  align?: 'right' | 'center';
}> = ({text, delay = 0, color = '#0A6B56', size = 22, side = 'right', align = 'right'}) => {
  const frame = useCurrentFrame();
  const t = tween(frame, delay, 24);
  const r = tween(frame, delay + 6, 26, E.outQuart);
  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexDirection: side === 'right' ? 'row' : 'row-reverse',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        opacity: t,
        transform: `translate3d(${(1 - t) * 16}px,0,0)`,
      }}
    >
      <span
        style={{
          display: 'block',
          height: 2,
          width: 46 * r,
          borderRadius: 2,
          background: color,
          opacity: 0.75,
        }}
      />
      <span
        style={{
          fontFamily: FONT.tajawal,
          fontSize: size,
          fontWeight: 700,
          color,
          letterSpacing: 0,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
};

/**
 * The store film's scenes — one continuous move through a midnight souk where the
 * only lit object is the shop itself.
 *
 * Grammar (see `projects/tg-store-launch/brief.md`):
 *   open     — a chat bubble becomes the shop                      (0.0–6.0 s)
 *   store    — the buyer's path, one pass, no cuts inside the UI    (6.0–16.0 s)
 *   admin    — the owner's phone + the feature strip                (16.0–26.0 s)
 *   security — the vault: PIN, four guards, the audit tail          (26.0–34.0 s)
 *   close    — the drop: end ticket + the only two contacts         (34.0–40.0 s)
 *
 * Every scene is a pure function of its local frame. The Scene wrapper in
 * `Film.tsx` gives each beat an 8-frame pre-roll, so `PREROLL` is subtracted
 * before any timeline math. Portrait is composed first: the phone sits low, the
 * statement sits in the platform-safe band, and the feature strip rides just
 * above the device; wide re-composes the same elements left/right.
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {E, clamp, tween} from '../lib/anim';
import {S, F, R, GLASS} from './tokens';
import {STORE, SECURITY, CTA, ADMIN} from './demo';
import {PhonePro, SCREEN_SHARE} from './PhonePro';
import {Bokeh, Ground} from '../components/Surfaces';
import {AtelierFX} from './atelier';
import {Ar, Kicker} from '../components/Text';
import {Icon, Price, Ticket} from './ui';
import {StoreHome, ProductScreen, CheckoutSheet, OrderSuccess} from './screens/buyer';
import {AdminHome, AdminOrders, BroadcastSheet, StatsScreen, SecurityScreen} from './screens/owner';
import {DesignScene} from './design';
import {FinaleScene} from './finale';
import {SetupScene} from './setup';
import {SourcesScene} from './sources';
import type {Beat} from '../film/types';

const PREROLL = 8;
const FPS = 30;
/** frames from the bar line */
const since = (f: number) => f - PREROLL;
const at = (sec: number) => PREROLL + Math.round(sec * FPS);

type Kf = Array<[number, number]>;
/** piecewise track with one easing family, evaluated at seconds */
const track = (sec: number, pts: Kf, ease: (v: number) => number = E.inOut): number => {
  if (sec <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (sec <= t1) {
      const p = (sec - t0) / Math.max(0.0001, t1 - t0);
      return v0 + (v1 - v0) * ease(clamp(p));
    }
  }
  return pts[pts.length - 1][1];
};

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Local frame for a child, so screens animate from their own shot start. */
const Local: React.FC<{children: (t: number) => React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  return <>{children(f)}</>;
};

type Lay = {
  portrait: boolean;
  square: boolean;
  W: number;
  H: number;
  phoneW: number;
  phoneX: number;
  phoneY: number;
  headX: number;
  headTop: number;
  headW: number;
  h1: number;
  h2: number;
  kicker: number;
  align: 'right' | 'center' | 'left';
  /** y of the compact strip between statement and device */
  stripY: number;
};

const layout = (W: number, H: number): Lay => {
  const portrait = H > W * 1.2;
  const square = !portrait && Math.abs(H - W) < 120;
  if (portrait) {
    return {
      portrait, square, W, H,
      phoneW: W * 0.55,
      phoneX: W * 0.5,
      phoneY: H * 0.65,
      headX: W * 0.06,
      headTop: H * 0.095,
      headW: W * 0.88,
      h1: W * 0.075,
      h2: W * 0.034,
      kicker: W * 0.028,
      align: 'center',
      stripY: H * 0.28,
    };
  }
  if (square) {
    return {
      portrait, square, W, H,
      phoneW: (H * 0.68) / 2.21,
      phoneX: W * 0.73,
      phoneY: H * 0.55,
      headX: W * 0.06,
      headTop: H * 0.12,
      headW: W * 0.46,
      h1: W * 0.040,
      h2: W * 0.021,
      kicker: W * 0.016,
      align: 'right',
      stripY: H * 0.86,
    };
  }
  return {
    portrait, square, W, H,
    phoneW: (H * 0.94) / 2.21,
    phoneX: W * 0.775,
    phoneY: H * 0.5,
    headX: W * 0.055,
    headTop: H * 0.095,
    headW: W * 0.44,
    h1: W * 0.060,
    h2: W * 0.030,
    kicker: W * 0.0175,
    align: 'right',
    stripY: H * 0.855,
  };
};

/* ── stage dressing ─────────────────────────────────────────────────────────── */

/** Dust motes: deterministic, slow, lit air. */
const Motes: React.FC<{count?: number; opacity?: number}> = ({count = 26, opacity = 0.5}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {Array.from({length: count}).map((_, i) => {
        const seed = (i * 9301 + 49297) % 233280;
        const r = (n: number) => ((Math.sin(seed * (n + 1.7)) * 10000) % 1 + 1) % 1;
        const x = r(1) * width;
        const baseY = r(2) * height;
        const drift = Math.sin((f * 0.006 + i) * 1.7) * 26;
        const y = (baseY + f * (0.14 + r(3) * 0.22)) % height;
        const size = 1.4 + r(4) * 2.6;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + drift,
              top: y,
              width: size,
              height: size,
              borderRadius: size,
              background: i % 4 === 0 ? 'rgba(242,169,59,0.85)' : 'rgba(210,246,244,0.75)',
              boxShadow: i % 4 === 0 ? '0 0 8px rgba(242,169,59,0.8)' : '0 0 7px rgba(180,240,238,0.7)',
              opacity: 0.25 + r(5) * 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** The floor of light under the phone: an elliptical pool, not a gradient wash. */
const FloorGlow: React.FC<{x: number; y: number; w: number; color?: string; opacity?: number}> = ({
  x, y, w, color = 'rgba(42,165,169,0.35)', opacity = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - w / 2,
      top: y - w * 0.09,
      width: w,
      height: w * 0.18,
      borderRadius: '50%',
      background: `radial-gradient(closest-side, ${color}, transparent 78%)`,
      filter: 'blur(26px)',
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** A small product ticket floating on the stage, for depth beside the phone. */
const FloatTicket: React.FC<{
  x: number;
  y: number;
  w: number;
  rot: number;
  title: string;
  sub: string;
  price: string;
  icon: string;
  delay: number;
  gold?: boolean;
}> = ({x, y, w, rot, title, sub, price, icon, delay, gold}) => {
  const f = useCurrentFrame();
  const p = tween(f, at(delay), 28, E.outBack);
  const drift = Math.sin(f * 0.012 + delay) * 7;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + drift,
        width: w,
        transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${0.9 + p * 0.1})`,
        opacity: p,
        pointerEvents: 'none',
      }}
    >
      <div
        dir="rtl"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: w * 0.035,
          padding: `${w * 0.045}px ${w * 0.055}px`,
          borderRadius: R.sm,
          background: 'linear-gradient(150deg, rgba(17,40,38,0.88), rgba(6,18,22,0.82))',
          border: `1px solid ${gold ? 'rgba(242,169,59,0.24)' : 'rgba(160,240,225,0.14)'}`,
          boxShadow: '0 22px 50px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: GLASS,
          WebkitBackdropFilter: GLASS,
        }}
      >
        <div
          style={{
            width: w * 0.16,
            height: w * 0.16,
            borderRadius: w * 0.045,
            background: gold ? 'rgba(242,169,59,0.14)' : 'rgba(42,165,169,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <Icon name={icon as never} size={w * 0.075} color={gold ? S.saffron : '#8FE3E0'} />
        </div>
        <div style={{minWidth: 0, flex: 1}}>
          <div style={{fontFamily: F.headline, fontSize: w * 0.062, fontWeight: 700, color: 'rgba(240,250,248,0.94)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            {title}
          </div>
          <div style={{fontFamily: F.text, fontSize: w * 0.043, color: 'rgba(178,206,204,0.58)', lineHeight: 1.4, marginTop: 2}}>{sub}</div>
        </div>
        <span dir="ltr" style={{fontFamily: F.display, fontSize: w * 0.07, fontWeight: 600, color: gold ? S.saffron : 'rgba(200,240,234,0.7)', whiteSpace: 'nowrap'}}>{price}</span>
      </div>
    </div>
  );
};

/** A floating KPI tile: the owner's numbers, off the glass and into the room. */
const FloatKpi: React.FC<{
  x: number; y: number; w: number; rot: number; label: string; value: string; hint: string; icon: string; delay: number;
}> = ({x, y, w, rot, label, value, hint, icon, delay}) => {
  const f = useCurrentFrame();
  const p = tween(f, at(delay), 26, E.outBack);
  const drift = Math.sin(f * 0.011 + delay) * 6;
  return (
    <div style={{position: 'absolute', left: x, top: y + drift, width: w, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${0.92 + p * 0.08})`, opacity: p, pointerEvents: 'none'}}>
      <div dir="rtl" style={{padding: `${w * 0.055}px ${w * 0.06}px`, borderRadius: R.sm, background: 'linear-gradient(150deg, rgba(16,38,36,0.96), rgba(6,17,21,0.92))', border: '1px solid rgba(160,240,225,0.2)', boxShadow: '0 24px 52px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: GLASS, WebkitBackdropFilter: GLASS}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 7}}>
          <Icon name={icon as never} size={w * 0.055} color="#8FE3E0" />
          <span style={{fontFamily: F.text, fontSize: w * 0.044, color: 'rgba(186,214,210,0.62)', lineHeight: 1.4}}>{label}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 4}}>
          <span dir="ltr" style={{fontFamily: F.display, fontSize: w * 0.105, fontWeight: 600, color: 'rgba(245,255,252,0.96)', lineHeight: 1.2}}>{value}</span>
          <span style={{fontFamily: F.text, fontSize: w * 0.038, color: 'rgba(178,206,204,0.5)', lineHeight: 1.3, textAlign: 'left'}}>{hint}</span>
        </div>
      </div>
    </div>
  );
};

/** Big display headline in the film's display face, whole words only. */
const Display: React.FC<{
  text: string;
  size: number;
  align: Lay['align'];
  color?: string;
  emphasis?: string[];
  emphasisColor?: string;
  delay?: number;
  step?: number;
  family?: string;
  lh?: number;
  nowrap?: boolean;
  weight?: number;
}> = ({text, size, align, color = 'rgba(240,247,246,0.97)', emphasis, emphasisColor = S.saffron, delay = 0, step = 4, family = F.headline, lh = 1.28, nowrap = false, weight = 700}) => (
  <Ar
    text={text}
    size={size}
    weight={weight}
    mode="words"
    align={align}
    color={color}
    emphasis={emphasis}
    emphasisColor={emphasisColor}
    step={step}
    dur={26}
    lh={lh}
    family={family}
    nowrap={nowrap}
    delay={delay}
  />
);

const Sub: React.FC<{text: string; size: number; align: Lay['align']; delay: number; color?: string; width?: number}> = ({
  text, size, align, delay, color = 'rgba(226,240,240,0.78)', width,
}) => (
  <div style={{maxWidth: width, width: '100%'}}>
    <Ar text={text} size={size} weight={500} mode="block" align={align} color={color} lh={1.6} family={F.text} delay={delay} />
  </div>
);

/** One headline printed as N deliberate display lines (never letter-by-letter). */
const Headline: React.FC<{
  lines: Array<{text: string; color?: string; scale?: number; delay: number; emphasis?: string[]}>;
  size: number;
  align: Lay['align'];
  marginTop?: number;
}> = ({lines, size, align, marginTop = 0}) => (
  <div style={{marginTop}}>
    {lines.map((l, i) => (
      <div key={`${l.text}-${i}`} style={{marginTop: i === 0 ? 0 : -size * 0.02}}>
        <Display
          text={l.text}
          size={size * (l.scale ?? 1)}
          align={align}
          color={l.color ?? 'rgba(240,247,246,0.97)'}
          emphasis={l.emphasis}
          emphasisColor={l.color ?? S.saffron}
          delay={l.delay}
          step={i === 0 ? 4 : 2}
          weight={i === 0 ? 700 : 800}
        />
      </div>
    ))}
  </div>
);

/* ── strips: products + capabilities ───────────────────────────────────────── */

type StripItem = {label: string; sub?: string; icon: string; gold?: boolean};

/** A slow horizontal band of the shop's stock — the "everything is here" cue. */
const Ticker: React.FC<{items: StripItem[]; y: number; W: number; scale?: number; delay?: number; opacity?: number}> = ({
  items, y, W, scale = 1, delay = 0, opacity = 0.92,
}) => {
  const f = useCurrentFrame();
  const p = tween(f, delay, 26);
  const band = [...items, ...items];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: y,
        width: W,
        height: 56 * scale,
        overflow: 'hidden',
        opacity: p * opacity,
        maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <div dir="rtl" style={{display: 'flex', gap: 12 * scale, transform: `translateX(${-(f % 900) * 0.55 * scale}px)`, willChange: 'transform'}}>
        {band.map((it, i) => (
          <div
            key={`${it.label}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8 * scale,
              padding: `${7 * scale}px ${14 * scale}px`,
              borderRadius: R.pill,
              background: 'rgba(11,26,32,0.62)',
              border: `1px solid ${it.gold ? 'rgba(242,169,59,0.28)' : 'rgba(120,220,215,0.16)'}`,
              backdropFilter: GLASS,
              WebkitBackdropFilter: GLASS,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            <Icon name={it.icon as never} size={15 * scale} color={it.gold ? S.saffron : '#8FE3E0'} />
            <span style={{fontFamily: F.text, fontSize: 14 * scale, fontWeight: 600, color: 'rgba(232,246,245,0.9)'}}>{it.label}</span>
            {it.sub && <span style={{fontFamily: F.text, fontSize: 12.5 * scale, color: it.gold ? 'rgba(242,169,59,0.85)' : 'rgba(190,215,216,0.55)'}}>{it.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

/** A compact row of capability chips for portrait, where the phone owns the frame. */
const CapStrip: React.FC<{items: Array<{label: string; icon: string}>; y: number; W: number; delay?: number; scale?: number}> = ({
  items, y, W, delay = 0, scale = 1,
}) => {
  const f = useCurrentFrame();
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: y,
        left: '-6%',
        width: '112%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8 * scale,
        paddingInline: W * 0.02,
      }}
    >
      {items.map((it, i) => {
        const p = tween(f, delay + i * 5, 22, E.outExpo);
        return (
          <div
            key={it.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7 * scale,
              padding: `${6 * scale}px ${13 * scale}px`,
              borderRadius: R.pill,
              background: 'rgba(11,26,32,0.66)',
              border: '1px solid rgba(120,220,215,0.18)',
              backdropFilter: GLASS,
              WebkitBackdropFilter: GLASS,
              opacity: p,
              transform: `translateY(${(1 - p) * 14}px) scale(${0.94 + p * 0.06})`,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={it.icon as never} size={14 * scale} color="#8FE3E0" />
            <span style={{fontFamily: F.text, fontSize: 13 * scale, fontWeight: 600, color: 'rgba(232,246,245,0.88)'}}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ── scene: open ────────────────────────────────────────────────────────────── */

export const OpenScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = since(f) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const head = (d.head as string[]) ?? ['متجرك', 'جوّا', 'تلجرام'];
  const headLines = (d.headLines as string[]) ?? [`${head[0]} ${head[1] ?? ''}`.trim(), head[2] ?? ''];
  const sub = (d.sub as string) ?? beat.line2 ?? '';
  const chat = (d.chat as Record<string, string>) ?? {};
  const bubble = chat.bubble ?? 'كل شي جاهز من أول رسالة.';
  const stage = d.stage === 'atelier' ? 'atelier' : d.stage === 'cobalt' ? 'cobalt' : 'golden-souk';
  const cool = stage !== 'golden-souk';
  const accent = stage === 'cobalt' ? '#2F6BFF' : S.tealLight;

  const phoneIn = tween(f, at(2.15), 42);
  const flood = tween(f, at(5.15), 26, E.inExpo);
  const burst = tween(f, at(5.25), 22);

  const phoneW = L.phoneW * (1 + flood * 0.3);
  const phoneY = lerp(H * 1.16, L.phoneY, phoneIn);
  const phoneX = L.portrait ? W * 0.5 : lerp(W * 1.12, L.phoneX, phoneIn);

  const bubbleIn = tween(f, at(0.35), 30);
  const bubbleOut = tween(f, at(2.05), 26);
  const bubbleW = L.portrait ? W * 0.8 : W * 0.245;
  const dp = (phoneW * SCREEN_SHARE) / 412;

  return (
    <AbsoluteFill style={{background: S.nightDeep}}>
      <Ground tone="ink" variant={stage} grain={0.075} vignette={0.5} />
      <Bokeh count={cool ? 9 : 12} opacity={cool ? 0.32 : 0.55} />
      <Motes count={30} opacity={0.55} />
      {cool && <AtelierFX accent={accent} intensity={0.9} />}
      <FloorGlow
        x={phoneX}
        y={phoneY + phoneW * 1.1}
        w={phoneW * 2.6}
        color={cool ? (stage === 'cobalt' ? 'rgba(47,107,255,0.3)' : 'rgba(42,165,169,0.32)') : undefined}
        opacity={phoneIn}
      />

      <div
        style={{
          position: 'absolute',
          left: L.headX,
          top: L.headTop,
          width: L.headW,
          textAlign: L.align,
          pointerEvents: 'none',
        }}
      >
        <Kicker
          text="منتجات رقمية · داخل تلجرام"
          color={S.saffron}
          size={L.kicker}
          align={L.align === 'right' ? 'right' : 'center'}
          side={L.align === 'right' ? 'right' : 'left'}
          delay={at(0.15)}
        />
        <Headline
          size={L.h1}
          align={L.align}
          marginTop={L.portrait ? H * 0.014 : H * 0.02}
          lines={headLines
            .filter((line) => line.trim().length > 0)
            .map((text, i) => ({
              text,
              color: i === 0 ? 'rgba(240,247,246,0.97)' : S.saffron,
              delay: at(i === 0 ? 0.3 : 0.55),
              emphasis: i === 0 ? [] : [text],
            }))}
        />
        <div style={{marginTop: L.portrait ? H * 0.012 : H * 0.018}}>
          <Sub text={sub} size={L.h2} align={L.align} delay={at(0.95)} />
        </div>
      </div>

      {/* the bubble that carries the shop, before the phone arrives */}
      <div
        style={{
          position: 'absolute',
          left: L.portrait ? W * 0.5 : W * 0.75,
          top: L.portrait ? H * 0.43 : H * 0.44,
          transform: `translate(-50%,-50%) scale(${lerp(0.86, 1, bubbleIn) * (1 - phoneIn * 0.18)})`,
          opacity: bubbleIn * (1 - bubbleOut),
          width: bubbleW,
        }}
      >
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(160deg, rgba(21,42,48,0.96), rgba(8,20,26,0.94))',
            borderRadius: 24,
            border: '1px solid rgba(120,220,215,0.22)',
            boxShadow: '0 50px 100px -50px rgba(0,0,0,0.95), 0 0 70px rgba(42,165,169,0.18)',
            padding: bubbleW * 0.055,
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 11, marginBottom: bubbleW * 0.04}}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                background: `linear-gradient(150deg, ${S.brandDark}, ${S.brand})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 18px -8px rgba(42,165,169,0.85)',
                flex: 'none',
              }}
            >
              <Icon name="telegram" size={21} color="#EAFBFA" />
            </div>
            <div style={{minWidth: 0, flex: 1}}>
              <div style={{fontFamily: F.display, fontSize: 18, fontWeight: 600, color: 'rgba(240,249,248,0.96)', lineHeight: 1.4}}>{STORE.name}</div>
              <div style={{fontFamily: F.text, fontSize: 12, color: 'rgba(180,208,210,0.58)', lineHeight: 1.4}}>{STORE.handle}</div>
            </div>
            <span style={{fontFamily: F.text, fontSize: 11, fontWeight: 600, color: S.saffron, background: 'rgba(242,169,59,0.14)', border: '1px solid rgba(242,169,59,0.3)', borderRadius: 999, padding: '3px 9px'}}>Mini App</span>
          </div>
          <div style={{fontFamily: F.text, fontSize: 16, color: 'rgba(228,244,243,0.86)', lineHeight: 1.75, marginBottom: bubbleW * 0.045}}>
            {bubble}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              height: Math.max(48, bubbleW * 0.135),
              borderRadius: 15,
              background: `linear-gradient(180deg, ${S.brandDark}, ${S.brand})`,
              boxShadow: '0 14px 26px -12px rgba(15,124,128,0.9), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <Icon name="bag" size={19} color="#EAFBFA" />
            <span style={{fontFamily: F.text, fontSize: 16.5, fontWeight: 600, color: '#EAFBFA'}}>افتح المتجر</span>
          </div>
        </div>
      </div>

      {/* the chat that opens the shop */}
      <div style={{opacity: phoneIn > 0.01 ? 1 : 0}}>
        <PhonePro
          width={phoneW}
          pose={{x: phoneX, y: phoneY, rot: lerp(-5, -1.6, phoneIn) + flood * 2, ry: lerp(-10, -6, phoneIn), rx: 2}}
          glow={0.8 + burst * 0.2}
          gold={0.4 + burst * 0.4}
          reflection={0.4}
        >
          <Sequence from={at(2.2)} durationInFrames={190} layout="none">
            <AbsoluteFill><Local>{(t) => <ProductScreen dp={dp} t={t + 16} />}</Local></AbsoluteFill>
          </Sequence>
        </PhonePro>
      </div>

      {/* the tap that opens the Mini App: a ripple from the button */}
      {sec > 4.0 && (
        <div
          style={{
            position: 'absolute',
            left: phoneX,
            top: phoneY + phoneW * 0.2,
            width: phoneW * 1.7,
            height: phoneW * 1.7,
            marginLeft: -phoneW * 0.85,
            marginTop: -phoneW * 0.85,
            borderRadius: '50%',
            border: `2px solid rgba(242,169,59,${0.55 * (1 - burst)})`,
            transform: `scale(${0.2 + burst * 1.2})`,
            opacity: 1 - burst,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/* ── scene: store (the buyer's one pass) ────────────────────────────────────── */

const PAY_STRIP: StripItem[] = [
  {label: 'محفظة المتجر', icon: 'wallet', gold: true},
  {label: 'شام كاش', icon: 'wallet'},
  {label: 'سيريتل كاش', icon: 'phone'},
  {label: 'MTN كاش', icon: 'send'},
  {label: 'USDT', icon: 'coin'},
  {label: 'Binance Pay', icon: 'bolt'},
  {label: 'تحويل بنكي', icon: 'grid'},
  {label: 'وسيلة مخصصة', icon: 'plus'},
];

const PAY_METHODS = PAY_STRIP.map((p) => ({label: p.label, icon: p.icon}));


export const StoreScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = since(f) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const payments = (d.payments as string[]) ? (d.payments as string[]).map((label, i) => ({label, icon: PAY_METHODS[i % PAY_METHODS.length].icon})) : PAY_METHODS;
  const stage = d.stage === 'atelier' ? 'atelier' : d.stage === 'cobalt' ? 'cobalt' : 'golden-souk';
  const cool = stage !== 'golden-souk';
  const accent = stage === 'cobalt' ? '#2F6BFF' : S.tealLight;

  const x = track(sec, L.portrait
    ? [[0, W * 0.5], [9.2, W * 0.5]]
    : [[0, W * 0.775], [2.4, W * 0.78], [4.2, W * 0.76], [6.2, W * 0.76], [7.4, W * 0.77], [9.2, W * 0.775]]);
  const y = track(sec, L.portrait
    ? [[0, L.phoneY], [4.2, L.phoneY - 12], [7.4, L.phoneY], [9.2, L.phoneY]]
    : [[0, L.phoneY], [4.2, L.phoneY + 15], [7.4, L.phoneY - 8], [9.2, L.phoneY]]);
  const w = track(sec, L.portrait
    ? [[0, L.phoneW], [2.2, L.phoneW * 1.02], [4.0, L.phoneW * 1.045], [6.0, L.phoneW * 1.02], [7.4, L.phoneW], [9.2, L.phoneW]]
    : [[0, L.phoneW], [2.2, L.phoneW * 1.03], [4.0, L.phoneW * 1.07], [6.0, L.phoneW * 1.03], [7.4, L.phoneW * 0.99], [9.2, L.phoneW]]);
  const rot = track(sec, [[0, -2.4], [2.2, -1.2], [4.0, -0.4], [6.0, 0.5], [7.4, -1], [9.2, -2]]);
  const ry = track(sec, [[0, -8], [2.2, -5], [4.0, -2.5], [6.0, 1.5], [7.4, -5], [9.2, -8]]);
  const dp = (w * SCREEN_SHARE) / 412;
  const phoneH = w * 2.21;

  return (
    <AbsoluteFill style={{background: S.nightDeep}}>
      <Ground tone="ink" variant={stage} grain={0.07} vignette={0.46} />
      <Bokeh count={cool ? 9 : 12} opacity={cool ? 0.32 : 0.55} />
      <Motes count={22} opacity={0.4} />
      {cool && <AtelierFX accent={accent} intensity={0.72} ribbon={false} sphere={false} />}
      <FloorGlow x={x} y={y + phoneH * 0.5} w={w * 2.4} color={cool ? (stage === 'cobalt' ? 'rgba(47,107,255,0.3)' : 'rgba(42,165,169,0.3)') : undefined} opacity={0.9} />

      <div
        style={{
          position: 'absolute',
          left: L.headX,
          top: L.portrait ? H * 0.095 : H * 0.21,
          width: L.headW,
          textAlign: L.align,
          pointerEvents: 'none',
        }}
      >
        {(() => {
          const [a, b] = (beat.line1 ?? '').split('—').map((s) => s.trim());
          return (
            <Headline
              size={L.h1 * (L.portrait ? 0.8 : 0.63)}
              align={L.align}
              lines={[
                {text: a, delay: at(0.2)},
                {text: b ?? '', color: S.saffron, scale: L.portrait ? 1.1 : 1.14, delay: at(0.42), emphasis: ['بثواني']},
              ]}
            />
          );
        })()}
        <div style={{marginTop: L.portrait ? H * 0.008 : H * 0.014}}>
          <Sub text={beat.line2 ?? ''} size={L.h2 * 0.92} align={L.align} delay={at(0.6)} />
        </div>
      </div>

      {/* the tag strip only exists where the phone leaves room for it */}
      {L.portrait && (
        <CapStrip
          items={payments.slice(0, 6)}
          y={L.stripY}
          W={W}
          delay={at(0.55)}
          scale={1.02}
        />
      )}

      {L.square && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            left: W * 0.04,
            top: H * 0.7,
            width: W * 0.42,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 7,
            alignContent: 'flex-start',
          }}
        >
          {payments.slice(0, 6).map((p, i) => {
            const t = tween(f, at(0.5 + i * 0.08), 22, E.outExpo);
            return (
              <div
                key={p.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(10,20,38,0.78)',
                  border: '1px solid rgba(150,190,255,0.18)',
                  opacity: t,
                  transform: `translateY(${(1 - t) * 10}px)`,
                }}
              >
                <Icon name={p.icon as never} size={12} color="#9CC8FF" />
                <span style={{fontFamily: F.text, fontSize: 11.5, fontWeight: 600, color: 'rgba(232,242,255,0.86)', whiteSpace: 'nowrap'}}>{p.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* the shelf rolling behind the device: breadth in one glance */}
      {!L.portrait && !L.square && <Ticker items={PAY_STRIP} y={H * 0.925} W={W} delay={at(1.0)} scale={1} opacity={0.9} />}

      {/* three real products, floating at different depths on the empty side */}
      {!L.portrait && !L.square && (
        <>
          <FloatTicket x={W * 0.12} y={H * 0.64} w={W * 0.155} rot={-6} title="بطاقة آيتونز 10$" sub="تسليم فوري" price="$10.60" icon="coupon" delay={1.4} />
          <FloatTicket x={W * 0.28} y={H * 0.76} w={W * 0.16} rot={3.5} title="فري فاير · 520 جوهرة" sub="شحن مباشر" price="$4.80" icon="star" delay={2.6} gold />
          <FloatTicket x={W * 0.13} y={H * 0.84} w={W * 0.15} rot={-3} title="رقم تلغرام مؤقت" sub="جاهز الآن" price="$0.60" icon="phone" delay={3.8} />
        </>
      )}

      {/* Screens are pre-rolled UNDER the one on top, so a page is already settled
          when the page above it leaves: no white flash in the middle of the pass.
          Painting order (bottom to top): last screen, success, product, checkout, home. */}
      <PhonePro width={w} pose={{x, y, rot, ry, rx: 2}} glow={1} gold={0.5} reflection={0.34} shadow>
        <Sequence from={at(0)} durationInFrames={at(10.5) - at(0)} layout="none">
          <AbsoluteFill><Local>{(t) => <StoreHome dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(4.9)} durationInFrames={at(7.5) - at(4.9)} layout="none">
          <AbsoluteFill><Local>{(t) => <OrderSuccess dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(1.2)} durationInFrames={at(4.55) - at(1.2)} layout="none">
          <AbsoluteFill><Local>{(t) => <ProductScreen dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(3.8)} durationInFrames={at(6.05) - at(3.8)} layout="none">
          <AbsoluteFill><Local>{(t) => <CheckoutSheet dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(0)} durationInFrames={at(2.35) - at(0)} layout="none">
          <AbsoluteFill><Local>{(t) => <StoreHome dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
      </PhonePro>

    </AbsoluteFill>
  );
};

/* ── scene: admin (the owner's phone + what the shop gives him) ────────────── */

const FEATURES: Array<{label: string; icon: string}> = [
  {label: 'إحصائيات', icon: 'chart'},
  {label: 'بث للعملاء', icon: 'send'},
  {label: 'مستويات VIP', icon: 'star'},
  {label: 'القنوات الإجبارية', icon: 'shield'},
  {label: 'طلبات الشحن', icon: 'wallet'},
  {label: 'تعدد العملات', icon: 'coin'},
  {label: 'أكواد فورية', icon: 'coupon'},
  {label: 'صلاحيات فريق', icon: 'users'},
];

export const AdminScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = since(f) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const stage = d.stage === 'atelier' ? 'atelier' : d.stage === 'cobalt' ? 'cobalt' : 'golden-souk';
  const cool = stage !== 'golden-souk';
  const accent = stage === 'cobalt' ? '#2F6BFF' : S.tealLight;
  const head = (d.head as string[]) ?? ['لوحة متجرك…', 'بجيبك.'];

  const x = L.portrait ? W * 0.5 : W * 0.775;
  const y = L.portrait ? L.phoneY : L.phoneY + 6;
  const w = L.portrait ? L.phoneW : L.phoneW * 1.01;
  const rot = track(sec, [[0, 2.2], [2.0, 1.2], [5.6, -1.2], [8.6, 1.6]]);
  const ry = track(sec, [[0, 7], [2.0, 4.5], [5.6, -3], [8.6, 6]]);
  const dp = (w * SCREEN_SHARE) / 412;

  return (
    <AbsoluteFill style={{background: S.nightDeep}}>
      <Ground tone="ink" variant={stage} grain={0.07} vignette={0.48} />
      <Bokeh count={cool ? 9 : 12} opacity={cool ? 0.3 : 0.55} />
      <Motes count={24} opacity={0.42} />
      {cool && <AtelierFX accent={accent} intensity={0.66} sphere={false} />}
      <FloorGlow x={x} y={y + w * 1.02} w={w * 2.4} opacity={0.85} color={cool ? (stage === 'cobalt' ? 'rgba(47,107,255,0.32)' : 'rgba(42,165,169,0.34)') : 'rgba(15,124,128,0.4)'} />

      <div
        style={{
          position: 'absolute',
          left: L.headX,
          top: L.portrait ? H * 0.095 : H * 0.14,
          width: L.headW,
          textAlign: L.align,
          pointerEvents: 'none',
        }}
      >
        <Headline
          size={L.h1 * 0.84}
          align={L.align}
          lines={[
            {text: head[0] ?? 'لوحة متجرك…', delay: at(0.25)},
            {text: head[1] ?? 'بجيبك.', color: S.saffron, delay: at(0.5), emphasis: [head[1] ?? 'بجيبك.']},
          ]}
        />
        <div style={{marginTop: L.portrait ? H * 0.008 : H * 0.014}}>
          <Sub text={beat.line2 ?? ''} size={L.h2 * 0.9} align={L.align} delay={at(0.65)} />
        </div>
      </div>

      {!L.portrait && !L.square && (
        <Ticker items={FEATURES.map((feat) => ({label: feat.label, icon: feat.icon}))} y={H * 0.9} W={W} delay={at(1.0)} scale={1} opacity={0.92} />
      )}
      {L.portrait && <CapStrip items={FEATURES.slice(0, 6)} y={L.stripY} W={W} delay={at(1.0)} scale={1.04} />}

      {!L.portrait && !L.square && (
        <>
          <FloatKpi x={W * 0.13} y={H * 0.64} w={W * 0.165} rot={-5} label={ADMIN.kpis[0].label} value={ADMIN.kpis[0].value} hint={ADMIN.kpis[0].hint} icon="orders" delay={1.2} />
          <FloatKpi x={W * 0.3} y={H * 0.76} w={W * 0.17} rot={3.5} label={ADMIN.kpis[1].label} value={ADMIN.kpis[1].value} hint={ADMIN.kpis[1].hint} icon="coin" delay={2.1} />
        </>
      )}

      <PhonePro width={w} pose={{x, y, rot, ry, rx: 2}} glow={0.95} gold={0.42} reflection={0.3}>
        <Sequence from={at(0)} durationInFrames={at(2.1) - at(0)} layout="none">
          <AbsoluteFill><Local>{(t) => <AdminHome dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(2.1)} durationInFrames={at(4.4) - at(2.1)} layout="none">
          <AbsoluteFill><Local>{(t) => <AdminOrders dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(4.4)} durationInFrames={at(6.5) - at(4.4)} layout="none">
          <AbsoluteFill><Local>{(t) => <BroadcastSheet dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
        <Sequence from={at(6.5)} durationInFrames={at(10.4) - at(6.5)} layout="none">
          <AbsoluteFill><Local>{(t) => <StatsScreen dp={dp} t={t + 16} />}</Local></AbsoluteFill>
        </Sequence>
      </PhonePro>

    </AbsoluteFill>
  );
};

/* ── scene: security (the vault) ───────────────────────────────────────────── */

export const SecurityScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = since(f) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const guards = (d.guards as Array<{glyph: string; label: string; note: string}>) ?? SECURITY.guards;

  const x = L.portrait ? W * 0.5 : W * 0.79;
  const y = L.portrait ? L.phoneY : L.phoneY + 4;
  const w = L.portrait ? L.phoneW : L.phoneW * 0.98;
  const dp = (w * SCREEN_SHARE) / 412;
  const riser = clamp((sec - 4.6) / 2.2);

  return (
    <AbsoluteFill style={{background: '#02050A'}}>
      <Ground tone="ink" variant="vault-warm" grain={0.085} vignette={0.62} />
      <Bokeh count={12} opacity={0.55} />
      <Motes count={16} opacity={0.3} />
      <FloorGlow x={x} y={y + w * 1.02} w={w * 2.2} color="rgba(242,169,59,0.22)" opacity={0.8} />

      {/* the rising line: the riser made visible */}
      <div
        style={{
          position: 'absolute',
          left: L.portrait ? W * 0.08 : W * 0.115,
          bottom: 0,
          width: 2,
          height: H * 0.5 * riser,
          background: 'linear-gradient(to top, rgba(242,169,59,0), rgba(242,169,59,0.85))',
          boxShadow: '0 0 22px rgba(242,169,59,0.6)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: L.headX,
          top: L.portrait ? H * 0.095 : H * 0.13,
          width: L.headW,
          textAlign: L.align,
          pointerEvents: 'none',
        }}
      >
        <Headline
          size={L.h1 * 0.84}
          align={L.align}
          lines={[
            {text: 'أمان…', color: S.saffron, delay: at(0.3), emphasis: ['أمان…'], scale: 0.94},
            {text: 'من أول ثانية.', delay: at(0.5), scale: 0.9},
          ]}
        />
        <div style={{marginTop: L.portrait ? H * 0.008 : H * 0.012}}>
          <Sub text={beat.line2 ?? ''} size={L.h2 * 0.8} align={L.align} delay={at(0.8)} />
        </div>
      </div>

      <PhonePro width={w} pose={{x, y, rot: -1.2, ry: -4, rx: 2}} glow={0.7} gold={0.5} reflection={0.46}>
        <Sequence from={at(0)} durationInFrames={at(8.7) - at(0)} layout="none">
          <AbsoluteFill><Local>{(t) => <SecurityScreen dp={dp} t={t} />}</Local></AbsoluteFill>
        </Sequence>
      </PhonePro>

      {/* the guards: a left column in wide, one compact row in portrait */}
      {L.portrait ? (
        <CapStrip items={guards.slice(0, 4).map((g) => ({label: g.label, icon: 'shield'}))} y={L.stripY} W={W} delay={at(0.5)} scale={0.88} />
      ) : (
        guards.map((g, i) => {
          const p = tween(f, at(0.55 + i * 0.42), 22, E.outBack);
          return (
            <div
              key={g.label}
              style={{
                position: 'absolute',
                left: W * 0.045,
                top: H * 0.58 + i * H * 0.1,
                width: W * 0.2,
                opacity: p,
                transform: `translateX(${(1 - p) * -30}px) scale(${0.94 + p * 0.06})`,
                filter: p < 0.95 ? `blur(${(1 - p) * 6}px)` : undefined,
              }}
            >
              <div
                dir="rtl"
                style={{
                  borderRadius: R.sm,
                  padding: 13,
                  background: 'linear-gradient(150deg, rgba(20,40,46,0.8), rgba(8,18,24,0.7))',
                  border: '1px solid rgba(242,169,59,0.18)',
                  backdropFilter: GLASS,
                  WebkitBackdropFilter: GLASS,
                  boxShadow: '0 18px 40px -22px rgba(0,0,0,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'rgba(242,169,59,0.13)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: S.saffron,
                    fontFamily: F.display,
                    fontSize: 18,
                    fontWeight: 600,
                    flex: 'none',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{minWidth: 0}}>
                  <div style={{fontFamily: F.text, fontSize: 14.5, fontWeight: 600, color: 'rgba(240,247,246,0.95)', lineHeight: 1.45}}>{g.label}</div>
                  <div style={{fontFamily: F.text, fontSize: 11.5, color: 'rgba(196,216,218,0.6)', lineHeight: 1.45, marginTop: 2}}>{g.note}</div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </AbsoluteFill>
  );
};

/* ── scene: close (the drop) ───────────────────────────────────────────────── */

export const CloseScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = since(f) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const head = (d.head as string[]) ?? ['جاهز تفتح', 'متجرك؟'];
  const sub = (d.sub as string) ?? CTA.sub;
  const stage = d.stage === 'atelier' ? 'atelier' : d.stage === 'cobalt' ? 'cobalt' : 'golden-souk';
  const cool = stage !== 'golden-souk';
  const accent = stage === 'cobalt' ? '#2F6BFF' : S.tealLight;

  const drop = tween(f, at(0), 22, E.outExpo);
  const cardIn = tween(f, at(0.35), 40);
  const contacts = tween(f, at(1.1), 26);
  const breathe = 1 + Math.sin((sec - 4) * 1.4) * 0.006 * clamp((sec - 4) / 1.2);

  const chips: Array<{label: string; icon: string}> = [
    {label: 'تسليم فوري', icon: 'send'},
    {label: 'دفع من الرصيد', icon: 'wallet'},
    {label: 'أكواد جاهزة', icon: 'coupon'},
    {label: 'بث للعملاء', icon: 'users'},
    {label: 'مستويات VIP', icon: 'star'},
    {label: 'إحصائيات', icon: 'chart'},
    {label: 'قنوات إجبارية', icon: 'shield'},
    {label: 'تعدد العملات', icon: 'coin'},
  ];

  const cardW = L.portrait ? W * 0.92 : W * 0.6;
  const cardX = W * 0.5;
  const cardY = L.portrait ? H * 0.5 : H * 0.52;
  const titleSize = cardW * (L.portrait ? 0.145 : 0.105);

  return (
    <AbsoluteFill style={{background: '#02070B'}}>
      <Ground tone="ink" variant={stage} grain={0.08} vignette={0.55} />
      <Bokeh count={cool ? 9 : 12} opacity={cool ? 0.32 : 0.55} />
      <Motes count={20} opacity={0.42} />

      {/* the drop: one ring, one bloom — then the ticket */}
      {sec < 1.6 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: W * 0.5,
              top: H * 0.5,
              width: W * 1.1,
              height: W * 1.1,
              marginLeft: -W * 0.55,
              marginTop: -W * 0.55,
              borderRadius: '50%',
              border: `2px solid rgba(242,169,59,${0.5 * (1 - drop)})`,
              transform: `scale(${0.1 + drop * 1.1})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(60% 50% at 50% 52%, rgba(242,169,59,${0.24 * (1 - drop)}), transparent 70%)`,
            }}
          />
        </>
      )}

      {/* confetti of coupons and ticks */}
      {Array.from({length: 34}).map((_, i) => {
        const seed = (i * 7919 + 104729) % 233280;
        const r = (n: number) => ((Math.sin(seed * (n + 2.3)) * 10000) % 1 + 1) % 1;
        const start = at(0.15 + r(1) * 0.8);
        const p = tween(f, start, 70);
        const x = r(2) * W;
        const y = lerp(-H * 0.1, H * 1.05, p);
        const rot = r(3) * 360;
        const size = 10 + r(4) * 16;
        const gold = i % 3 === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.sin(p * 6 + i) * 30,
              top: y,
              width: size,
              height: size,
              opacity: 0.75 * (1 - clamp((p - 0.7) / 0.3)),
              transform: `rotate(${rot + p * 220}deg)`,
              color: gold ? 'rgba(242,169,59,0.9)' : 'rgba(143,227,224,0.85)',
            }}
          >
            <Icon name={gold ? 'coupon' : 'check'} size={size} color="currentColor" />
          </div>
        );
      })}

      {/* what you get: two tidy rows under the ticket (above it in portrait) */}
      {chips.map((c, i) => {
        const row = i < 4 ? 0 : 1;
        const col = i % 4;
        const p = tween(f, at(1.45 + i * 0.09), 22, E.outExpo);
        const rowW = W * 0.78;
        const fx = W * 0.5 - rowW / 2 + (col + 0.5) * (rowW / 4);
        const baseY = L.portrait ? H * 0.5 - cardW * 0.42 - 96 : H * 0.52 + cardW * 0.34;
        const fy = baseY + row * 44;
        return (
          <div
            key={c.label}
            style={{
              position: 'absolute',
              left: fx,
              top: fy,
              transform: `translate(-50%,-50%) scale(${0.92 + p * 0.08})`,
              opacity: p,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              borderRadius: R.pill,
              background: 'rgba(10,24,30,0.72)',
              border: '1px solid rgba(120,220,215,0.16)',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={c.icon as never} size={14} color="#8FE3E0" />
            <span style={{fontFamily: F.text, fontSize: 13.5, fontWeight: 600, color: 'rgba(230,244,243,0.85)'}}>{c.label}</span>
          </div>
        );
      })}

      {/* the end ticket */}
      <div
        style={{
          position: 'absolute',
          left: cardX - cardW / 2,
          top: cardY - cardW * 0.36,
          width: cardW,
          transform: `scale(${cardIn * breathe}) translateY(${(1 - cardIn) * 60}px)`,
          opacity: clamp(cardIn * 1.4),
        }}
      >
        <Ticket notch="transparent" body="#0A1A21" radius={R.lg}>
          <div dir="rtl" style={{padding: cardW * 0.07, textAlign: 'center'}}>
            <div style={{display: 'flex', justifyContent: 'center', marginBottom: cardW * 0.028}}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 16px',
                  borderRadius: R.pill,
                  background: 'rgba(242,169,59,0.14)',
                  border: '1px solid rgba(242,169,59,0.3)',
                }}
              >
                <Icon name="spark" size={15} color={S.saffron} />
                <span style={{fontFamily: F.text, fontSize: 14, fontWeight: 600, color: S.saffron}}>متجرك جاهز</span>
              </div>
            </div>
            <Display
              text={`${head[0]} ${head[1] ?? ''}`.trim()}
              size={titleSize}
              align="center"
              delay={at(0.5)}
              step={5}
              emphasis={[head[1] ?? '']}
              emphasisColor={S.saffron}
            />
            <div style={{marginTop: cardW * 0.012, opacity: contacts, transform: `translateY(${(1 - contacts) * 14}px)`}}>
              <Ar text={sub} size={cardW * (L.portrait ? 0.056 : 0.04)} weight={500} mode="block" align="center" color="rgba(226,240,240,0.8)" lh={1.6} family={F.text} />
              <div style={{height: 1, margin: `${cardW * 0.04}px 0`, background: 'repeating-linear-gradient(to right, rgba(200,225,226,0.26) 0 6px, transparent 6px 12px)'}} />
              <div dir="ltr" style={{display: 'flex', justifyContent: 'center', gap: cardW * 0.035, flexWrap: 'wrap'}}>
                <ContactRow icon="telegram" label="تلجرام" value={CTA.tg} color="#8FE3E0" />
                <ContactRow icon="phone" label="واتساب" value={CTA.wa} color={S.saffron} />
              </div>
              <div style={{marginTop: cardW * 0.03, fontFamily: F.text, fontSize: cardW * 0.021, color: 'rgba(170,196,198,0.55)', lineHeight: 1.5}} dir="rtl">
                {CTA.foot}
              </div>
            </div>
          </div>
        </Ticket>
      </div>
    </AbsoluteFill>
  );
};

const ContactRow: React.FC<{icon: 'telegram' | 'phone'; label: string; value: string; color: string}> = ({icon, label, value, color}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '9px 16px',
      borderRadius: R.sm,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
      whiteSpace: 'nowrap',
    }}
  >
    <Icon name={icon} size={17} color={color} />
    <span style={{fontFamily: F.text, fontSize: 12.5, color: 'rgba(200,222,223,0.6)'}}>{label}</span>
    <span dir="ltr" style={{fontFamily: F.text, fontSize: 15, fontWeight: 600, color: 'rgba(240,250,250,0.95)', unicodeBidi: 'isolate'}}>
      {value}
    </span>
  </div>
);

/* ── registry for the film ─────────────────────────────────────────────────── */

export const STORE_SCENES: Record<string, React.FC<{beat: Beat; vertical: boolean; motion?: number}>> = {
  open: OpenScene,
  store: StoreScene,
  admin: AdminScene,
  security: SecurityScene,
  close: CloseScene,
  design: DesignScene,
  setup: SetupScene,
  sources: SourcesScene,
  finale: FinaleScene,
};

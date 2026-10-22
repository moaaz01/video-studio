/**
 * The end card: an ownership ticket, not a logo slide.
 *
 * Two real handles, large enough to read on a phone at arm's length, and the
 * film's one honest caveat on the same card. The ghost word behind is the film's
 * own display face, used as architecture — no invented badge, no fake rating.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {E, clamp, tween} from '../lib/anim';
import {S, F, R, GLASS} from './tokens';
import {CTA, STORE} from './demo';
import {Icon, Ticket} from './ui';
import {Ar, Kicker} from '../components/Text';
import {Bokeh, Ground} from '../components/Surfaces';
import {AtelierFX} from './atelier';
import type {Beat} from '../film/types';

const PREROLL = 8;
const FPS = 30;
const at = (sec: number) => PREROLL + Math.round(sec * FPS);
/** the scene is pre-rolled; start the card early so the cut is never empty */
const atIn = (sec: number) => at(sec) - 14;

type Lay = {
  portrait: boolean;
  square: boolean;
  W: number;
  H: number;
  card: {x: number; y: number; w: number; h: number};
  head: {x: number; y: number; w: number};
  h1: number;
  h2: number;
  kicker: number;
  align: 'right' | 'center';
  ghost: {top: number; size: number};
  chipsY: number;
  footY: number;
};

const layout = (W: number, H: number): Lay => {
  const portrait = H > W * 1.2;
  const square = !portrait && Math.abs(H - W) < 120;
  if (portrait) {
    return {
      portrait, square, W, H,
      card: {x: W * 0.05, y: H * 0.42, w: W * 0.9, h: H * 0.36},
      head: {x: W * 0.06, y: H * 0.085, w: W * 0.88},
      h1: W * 0.078,
      h2: W * 0.034,
      kicker: W * 0.027,
      align: 'center',
      ghost: {top: H * 0.02, size: W * 0.9},
      chipsY: H * 0.322,
      footY: H * 0.9,
    };
  }
  if (square) {
    return {
      portrait, square, W, H,
      card: {x: W * 0.07, y: H * 0.33, w: W * 0.86, h: H * 0.56},
      head: {x: W * 0.06, y: H * 0.075, w: W * 0.9},
      h1: W * 0.058,
      h2: W * 0.028,
      kicker: W * 0.017,
      align: 'center',
      ghost: {top: H * 0.01, size: W * 0.86},
      chipsY: H * 0.295,
      footY: H * 0.9,
    };
  }
  return {
    portrait, square, W, H,
    card: {x: W * 0.55, y: H * 0.205, w: W * 0.4, h: H * 0.6},
    head: {x: W * 0.05, y: H * 0.19, w: W * 0.47},
    h1: W * 0.052,
    h2: W * 0.024,
    kicker: W * 0.016,
    align: 'right',
    ghost: {top: H * 0.06, size: W * 0.34},
    chipsY: H * 0.71,
    footY: H * 0.94,
  };
};

const ContactRow: React.FC<{
  icon: 'telegram' | 'phone';
  label: string;
  value: string;
  small?: string;
  color: string;
  cw: number;
  delay: number;
  pulse?: number;
}> = ({icon, label, value, small, color, cw, delay, pulse = 0}) => {
  const f = useCurrentFrame();
  const p = tween(f, delay, 26, E.outExpo);
  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: cw * 0.028,
        padding: `${cw * 0.026}px ${cw * 0.03}px`,
        borderRadius: R.md,
        background: 'rgba(255,255,255,0.045)',
        border: `1px solid ${color}44`,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: cw * 0.095,
          height: cw * 0.095,
          borderRadius: cw * 0.032,
          background: `linear-gradient(150deg, ${color}, ${color}bb)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
          boxShadow: `0 10px 24px -12px ${color}`,
        }}
      >
        <Icon name={icon} size={cw * 0.045} color="#FFFFFF" />
      </div>
      <div style={{minWidth: 0, flex: 1}}>
        <div style={{fontFamily: F.text, fontSize: cw * 0.026, fontWeight: 600, color: 'rgba(198,226,222,0.62)', lineHeight: 1.35}}>{label}</div>
        <div
          dir="ltr"
          style={{
            fontFamily: F.display,
            fontSize: cw * 0.047,
            fontWeight: 600,
            color: 'rgba(245,255,252,0.97)',
            lineHeight: 1.35,
            unicodeBidi: 'isolate',
            marginTop: 2,
            letterSpacing: 0,
          }}
        >
          {value}
        </div>
        {small ? (
          <div dir="ltr" style={{fontFamily: F.text, fontSize: cw * 0.021, color: 'rgba(198,226,222,0.44)', lineHeight: 1.4, marginTop: 1}}>
            {small}
          </div>
        ) : null}
      </div>
      <Icon name="forward" size={cw * 0.032} color={`${color}dd`} />
      {pulse > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: R.md,
            border: `2px solid ${color}`,
            opacity: 0.5 * pulse,
            transform: `scale(${1 + (1 - pulse) * 0.06})`,
          }}
        />
      )}
    </div>
  );
};

export const FinaleScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const head = (d.head as string[]) ?? ['متجرك الرقمي', 'جاهز باسمك.'];
  const sub = (d.sub as string) ?? CTA.sub;
  const sec = (f - PREROLL) / FPS;
  const stage = d.stage === 'atelier' ? 'atelier' : d.stage === 'cobalt' ? 'cobalt' : 'golden-souk';
  const accent = stage === 'cobalt' ? '#2F6BFF' : S.tealLight;

  const cw = L.card.w;
  const cardIn = tween(f, atIn(0.18), 40, E.outExpo);
  const headIn = tween(f, atIn(0.05), 30, E.outExpo);
  const pulse = clamp(1 - (sec - 1.1) / 1.2);
  const breathe = 1 + Math.sin((sec - 4.2) * 1.3) * 0.004 * clamp((sec - 4.2) / 1.2);

  const chips = [
    {label: 'هوية باسمك', icon: 'spark'},
    {label: 'منتجاتك', icon: 'bag'},
    {label: 'أرباحك', icon: 'chart'},
  ];

  return (
    <AbsoluteFill style={{background: '#03100F'}}>
      <Ground tone="ink" variant={stage} grain={0.07} vignette={0.5} />
      <Bokeh count={8} opacity={0.3} />
      <AtelierFX accent={accent} intensity={0.8} />

      {/* architecture: the word itself, oversized and ghosted */}
      <div
        style={{
          position: 'absolute',
          left: L.portrait ? -W * 0.08 : -W * 0.02,
          top: L.ghost.top,
          width: L.portrait ? W * 1.16 : W * 0.7,
          fontFamily: F.display,
          fontSize: L.ghost.size,
          fontWeight: 700,
          lineHeight: 1,
          color: 'transparent',
          WebkitTextStroke: '1.5px rgba(170,235,222,0.12)',
          opacity: clamp(headIn),
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textAlign: L.portrait ? 'center' : 'right',
        }}
      >
        متجرك
      </div>

      {/* the one light: a soft mint pool under the ticket */}
      <div
        style={{
          position: 'absolute',
          left: L.card.x + cw * 0.5,
          top: L.card.y + L.card.h * 0.6,
          width: cw * 1.4,
          height: cw * 0.8,
          marginLeft: -cw * 0.7,
          marginTop: -cw * 0.4,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(42,165,169,0.22), transparent 72%)',
          filter: 'blur(22px)',
          pointerEvents: 'none',
        }}
      />

      {/* headline */}
      <div style={{position: 'absolute', left: L.head.x, top: L.head.y, width: L.head.w, textAlign: L.align}}>
        <Kicker
          text="نسختك · هويتك · أرباحك"
          color="rgba(112,231,204,0.9)"
          size={L.kicker}
          align={L.align === 'right' ? 'right' : 'center'}
          side={L.align === 'right' ? 'right' : 'left'}
          delay={atIn(0.05)}
        />
        <div style={{marginTop: L.portrait ? H * 0.01 : H * 0.016}}>
          {head.map((line, i) => (
            <div key={line} style={{marginTop: i === 0 ? 0 : -L.h1 * 0.02}}>
              <Ar
                text={line}
                size={L.h1 * (i === 0 ? 0.88 : 1)}
                weight={i === 0 ? 700 : 800}
                mode="words"
                align={L.align}
                color={i === 0 ? 'rgba(240,250,248,0.98)' : S.saffron}
                emphasis={i === 0 ? [] : [line]}
                emphasisColor={S.saffron}
                family={F.headline}
                lh={1.28}
                delay={atIn(0.1 + i * 0.18)}
                step={4}
                dur={24}
              />
            </div>
          ))}
        </div>
        <div style={{marginTop: L.portrait ? H * 0.01 : H * 0.014}}>
          <Ar text={sub} size={L.h2} weight={500} mode="block" align={L.align} color="rgba(218,238,234,0.78)" lh={1.65} family={F.text} delay={atIn(0.46)} />
        </div>
      </div>

      {/* three claims, not a feature list: the three things the owner keeps */}
      {!L.square && <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: L.chipsY,
          left: L.portrait || L.square ? 0 : L.head.x,
          right: L.portrait || L.square ? 0 : undefined,
          width: L.portrait || L.square ? undefined : L.head.w,
          display: 'flex',
          justifyContent: L.portrait || L.square ? 'center' : 'flex-start',
          gap: cw * 0.028,
          paddingInline: L.portrait ? W * 0.07 : 0,
        }}
      >
        {chips.map((c, i) => {
          const p = tween(f, atIn(0.72 + i * 0.1), 24, E.outExpo);
          return (
            <div
              key={c.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: cw * 0.012,
                padding: `${cw * 0.012}px ${cw * 0.022}px`,
                borderRadius: 999,
                background: 'rgba(10,32,30,0.72)',
                border: '1px solid rgba(160,230,216,0.16)',
                opacity: p,
                transform: `translateY(${(1 - p) * 12}px)`,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name={c.icon as never} size={cw * 0.02} color="rgba(120,228,204,0.9)" />
              <span style={{fontFamily: F.text, fontSize: cw * 0.022, fontWeight: 600, color: 'rgba(228,246,242,0.82)'}}>{c.label}</span>
            </div>
          );
        })}
      </div>}

      {/* the ticket */}
      <div
        style={{
          position: 'absolute',
          left: L.card.x,
          top: L.card.y,
          width: L.card.w,
          height: L.card.h,
          transform: `translateY(${(1 - cardIn) * 54}px) scale(${cardIn * breathe})`,
          opacity: clamp(cardIn * 1.5),
        }}
      >
        <Ticket notch="transparent" body="#081A18" radius={R.lg} style={{height: '100%', boxShadow: '0 40px 100px -48px rgba(0,0,0,0.95), 0 0 0 1px rgba(160,230,216,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'}}>
          <div dir="rtl" style={{padding: cw * 0.045, boxSizing: 'border-box', height: '100%', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
              <div style={{display: 'flex', alignItems: 'center', gap: cw * 0.016}}>
                <div
                  style={{
                    width: cw * 0.07,
                    height: cw * 0.07,
                    borderRadius: cw * 0.023,
                    background: `linear-gradient(150deg, ${S.brandDark}, ${S.brand})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 18px -9px rgba(42,165,169,0.9)',
                  }}
                >
                  <span style={{fontFamily: F.display, fontSize: cw * 0.036, fontWeight: 700, color: '#FFFFFF'}}>م</span>
                </div>
                <div>
                  <div style={{fontFamily: F.display, fontSize: cw * 0.033, fontWeight: 600, color: 'rgba(244,255,252,0.97)', lineHeight: 1.3}}>{STORE.name}</div>
                  <div style={{fontFamily: F.text, fontSize: cw * 0.018, color: 'rgba(180,214,208,0.55)', lineHeight: 1.4}}>{STORE.handle}</div>
                </div>
              </div>
              <span
                style={{
                  fontFamily: F.text,
                  fontSize: cw * 0.016,
                  fontWeight: 600,
                  color: 'rgba(242,169,59,0.9)',
                  background: 'rgba(242,169,59,0.12)',
                  border: '1px solid rgba(242,169,59,0.28)',
                  borderRadius: 999,
                  padding: `${cw * 0.006}px ${cw * 0.014}px`,
                  whiteSpace: 'nowrap',
                }}
              >
                نسخة خاصة
              </span>
            </div>

            <div style={{marginTop: cw * 0.026, marginBottom: cw * 0.022}}>
              <div style={{fontFamily: F.display, fontSize: cw * 0.047, fontWeight: 600, color: 'rgba(246,255,252,0.98)', lineHeight: 1.4}}>تواصل معي مباشرة</div>
              <div style={{height: 1, marginTop: cw * 0.018, background: 'repeating-linear-gradient(to right, rgba(160,230,216,0.24) 0 6px, transparent 6px 12px)'}} />
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: cw * 0.02}}>
              <ContactRow icon="telegram" label="تلجرام" value={CTA.tg} color="#2AA5A9" cw={cw} delay={atIn(0.32)} pulse={pulse} />
              <ContactRow icon="phone" label="واتساب" value="wa.me/905528552420" small="+90 552 855 2420" color="#1E9E6A" cw={cw} delay={atIn(0.46)} />
            </div>

            <div style={{marginTop: 'auto', paddingTop: cw * 0.016, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
              <span style={{fontFamily: F.text, fontSize: cw * 0.018, color: 'rgba(176,208,202,0.48)', lineHeight: 1.5}}>{(d.foot as string) || CTA.foot}</span>
              <span style={{fontFamily: F.text, fontSize: cw * 0.016, color: 'rgba(242,169,59,0.7)', whiteSpace: 'nowrap'}}>نسخة باسمك</span>
            </div>
          </div>
        </Ticket>
      </div>

      {/* the fine print lives inside the ticket, on the same card as the handles */}
    </AbsoluteFill>
  );
};

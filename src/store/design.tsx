/**
 * Scene: the atelier — the store's identity, shown as a live material.
 *
 * This beat exists to answer one question the buyer actually has: «هل يطلع
 * متجري حلو؟». It does not describe customisation; it performs it. The real
 * swatches and the real card-style names from
 * `admin/screens/settings/IdentityForm.svelte` + `admin/kit/CardStylePicker.svelte`
 * sit on a console, and the storefront beside them is repainted on the bar.
 *
 * Every string here is the app's own:
 *   - «لون المتجر», «شكل الكروت», «معاينة حية»   → IdentityForm.svelte
 *   - «كلاسيكي / صورة كاملة / إطار» + hints      → CardStylePicker.svelte
 *   - categories, product names, prices, tabs    → lib/api/mock/fixtures.ts + Home
 *   - «وضوح النص على اللون»                      → IdentityForm.svelte
 *
 * The preview is a reconstruction, not a screenshot: same 412 px logical canvas,
 * same radii, same type. It is labelled «معاينة حية» exactly like the app's panel.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {E, clamp, tween} from '../lib/anim';
import {S, F, R, GLASS} from './tokens';
import {STORE, HOME, CATEGORIES, PRODUCT} from './demo';
import {Icon} from './ui';
import {Ar, Kicker} from '../components/Text';
import {Bokeh, Ground} from '../components/Surfaces';
import {AtelierFX} from './atelier';
import type {Beat} from '../film/types';

const PREROLL = 8;
const FPS = 30;
const since = (f: number) => f - PREROLL;
const at = (sec: number) => PREROLL + Math.round(sec * FPS);

/* ── colour math: the app builds a ramp from one hex; we do the same, honestly ── */

const SWATCHES = ['#0F7C80', '#2F6BFF', '#6D4AFF', '#D6336C', '#E8590C', '#2B8A3E', '#C92A2A', '#364FC7'];

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, p: number) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex((r1 + (r2 - r1) * p) / 255, (g1 + (g2 - g1) * p) / 255, (b1 + (b2 - b1) * p) / 255);
};
const soft = (hexColor: string, alpha: number) => {
  const [r, g, b] = rgb(hexColor);
  return `rgba(${r},${g},${b},${alpha})`;
};
/** WCAG relative luminance, for the contrast chip the app itself prints. */
const lum = (hexColor: string) => {
  const [r, g, b] = rgb(hexColor).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOnWhite = (hexColor: string) => (1.05 / (lum(hexColor) + 0.05)).toFixed(1);

/* ── the real picker's three looks ─────────────────────────────────────────── */

const CARD_STYLES = [
  {value: 'classic', label: 'كلاسيكي', hint: 'الصورة فوق والاسم تحتها'},
  {value: 'overlay', label: 'صورة كاملة', hint: 'الاسم فوق الصورة'},
  {value: 'framed', label: 'إطار', hint: 'صورة داخل إطار ملوّن'},
] as const;
type CardStyle = (typeof CARD_STYLES)[number]['value'];

const CATS = CATEGORIES.slice(0, 4);

/* ── the live storefront: 412 × 915 logical, same canvas as every real screen ── */

const StorePreview: React.FC<{dp: number; accent: string; style: CardStyle; t: number; sinceChange: number}> = ({
  dp,
  accent,
  style,
  t,
  sinceChange,
}) => {
  const deep = mix(accent, '#000000', 0.28);
  const light = mix(accent, '#FFFFFF', 0.82);
  const inkOn = parseFloat(contrastOnWhite(accent)) > 3.2 ? '#FFFFFF' : S.ink;

  const enter = (i: number) => {
    const p = tween(t, 4 + i * 3, 22, E.outExpo);
    return {opacity: clamp(p * 1.5), transform: `translate3d(0,${(1 - p) * 16}px,0)`};
  };

  const art = (label: string, i: number, h: number) => (
    <div
      style={{
        position: 'relative',
        height: h,
        borderRadius: style === 'framed' ? R.xs : R.sm,
        overflow: 'hidden',
        background: `radial-gradient(120% 120% at ${i % 2 === 0 ? '18%' : '82%'} 8%, ${mix(accent, '#FFFFFF', 0.28)} 0%, ${accent} 46%, ${deep} 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(70% 80% at 74% 22%, rgba(255,255,255,0.24), transparent 62%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: 10,
          width: 30,
          height: 30,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.24)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={['spark', 'coupon', 'phone', 'star'][i] as never} size={16} color="#FFFFFF" />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 8,
          fontFamily: F.display,
          fontSize: 22,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1,
          opacity: 0.55,
        }}
      >
        {['◈', '▤', '◍', '❖'][i]}
      </div>
    </div>
  );

  return (
    <div style={{width: 412 * dp, height: 915 * dp, position: 'relative', overflow: 'hidden'}}>
      <div
        dir="rtl"
        lang="ar"
        style={{
          width: 412,
          height: 915,
          transform: `scale(${dp})`,
          transformOrigin: '0 0',
          position: 'relative',
          overflow: 'hidden',
          background: S.bg,
          fontFamily: F.text,
          color: S.ink,
        }}
      >
        {/* the store's own wash, rebuilt from the selected colour */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 62% at 100% 0%, ${soft(accent, 0.16)}, transparent 58%), radial-gradient(90% 50% at 0% 100%, rgba(242,169,59,0.10), transparent 62%)`,
          }}
        />

        {/* status + store header (Home.svelte) */}
        <div style={{position: 'absolute', top: 12, left: 22, right: 22, display: 'flex', justifyContent: 'space-between', fontFamily: F.text, fontSize: 12, fontWeight: 600, color: S.ink}}>
          <span dir="ltr">9:41</span>
          <span style={{display: 'flex', gap: 4, alignItems: 'center', opacity: 0.7}}>
            <span style={{width: 14, height: 7, borderRadius: 2, border: '1px solid currentColor'}} />
            <span style={{width: 8, height: 7, borderRadius: 1, background: 'currentColor'}} />
          </span>
        </div>
        <div style={{position: 'absolute', top: 40, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10}}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: `linear-gradient(150deg, ${mix(accent, '#FFFFFF', 0.22)}, ${accent} 55%, ${deep})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 8px 18px -8px ${soft(accent, 0.9)}`,
              flex: 'none',
              transition: 'background 300ms',
            }}
          >
            <span style={{fontFamily: F.display, fontSize: 21, fontWeight: 700, color: inkOn}}>م</span>
          </div>
          <div style={{minWidth: 0, flex: 1}}>
            <div style={{fontFamily: F.display, fontSize: 16, fontWeight: 600, color: S.ink, lineHeight: 1.35, whiteSpace: 'nowrap'}}>{STORE.name}</div>
            <div style={{fontFamily: F.text, fontSize: 10.5, color: S.muted, lineHeight: 1.4}}>{STORE.handle}</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              paddingInline: 11,
              borderRadius: 999,
              background: S.saffronSoft,
              border: '1px solid rgba(242,169,59,0.35)',
              flex: 'none',
            }}
          >
            <Icon name="wallet" size={14} color={S.saffronText} />
            <span dir="ltr" style={{fontFamily: F.display, fontSize: 13, fontWeight: 600, color: S.saffronText}}>$12.56</span>
          </div>
        </div>

        {/* search (Home.svelte) */}
        <div style={{position: 'absolute', top: 96, left: 16, right: 16}}>
          <div
            style={{
              height: 42,
              borderRadius: R.sm,
              background: S.solid1,
              border: `1.4px solid ${soft(accent, 0.32)}`,
              boxShadow: '0 6px 14px -12px rgba(20,26,38,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingInline: 13,
            }}
          >
            <Icon name="search" size={16} color={S.muted} />
            <span style={{fontFamily: F.text, fontSize: 13, color: S.muted}}>{HOME.search}</span>
          </div>
        </div>

        {/* categories (Home.svelte) */}
        <div style={{position: 'absolute', top: 158, left: 16, right: 16}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
            <span style={{fontFamily: F.display, fontSize: 18, fontWeight: 600, color: S.ink}}>{HOME.section}</span>
            <span style={{fontFamily: F.text, fontSize: 11, color: accent, fontWeight: 600}}>الكل</span>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
            {CATS.map((c, i) => {
              const p = enter(i);
              const local = clamp(sinceChange / 18);
              return (
                <div key={c.label} style={{...p, opacity: p.opacity * (0.55 + local * 0.45)}}>
                  {style === 'overlay' ? (
                    <div style={{position: 'relative', height: 132, borderRadius: R.sm, overflow: 'hidden', boxShadow: '0 10px 22px -18px rgba(20,26,38,0.55)'}}>
                      {art(c.label, i, 132)}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, transparent 42%, rgba(6,14,18,0.76) 100%)',
                          display: 'flex',
                        }}
                      >
                        <div style={{position: 'absolute', left: 11, right: 11, bottom: 9, textAlign: 'right'}}>
                          <div style={{fontFamily: F.display, fontSize: 15, fontWeight: 600, color: '#FFFFFF', lineHeight: 1.25}}>{c.label}</div>
                          <div style={{fontFamily: F.text, fontSize: 9.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3, marginTop: 1}}>{c.sub}</div>
                        </div>
                      </div>
                    </div>
                  ) : style === 'framed' ? (
                    <div style={{height: 132, borderRadius: R.sm, padding: 5, background: soft(accent, 0.14), border: `1.4px solid ${soft(accent, 0.34)}`, boxSizing: 'border-box'}}>
                      {art(c.label, i, 84)}
                      <div style={{padding: '6px 6px 0'}}>
                        <div style={{fontFamily: F.display, fontSize: 13.5, fontWeight: 600, color: S.ink, lineHeight: 1.25}}>{c.label}</div>
                        <div style={{fontFamily: F.text, fontSize: 9, color: S.muted, lineHeight: 1.3, marginTop: 1}}>{c.sub}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{height: 132, borderRadius: R.sm, overflow: 'hidden', background: S.solid1, boxShadow: '0 10px 22px -18px rgba(20,26,38,0.5)', border: '1px solid rgba(20,26,38,0.05)'}}>
                      {art(c.label, i, 82)}
                      <div style={{padding: '7px 9px 0'}}>
                        <div style={{fontFamily: F.display, fontSize: 13.5, fontWeight: 600, color: S.ink, lineHeight: 1.25}}>{c.label}</div>
                        <div style={{fontFamily: F.text, fontSize: 9, color: S.muted, lineHeight: 1.3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.sub}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* most requested (the products the app's fixtures carry) */}
        <div style={{position: 'absolute', top: 482, left: 16, right: 16}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9}}>
            <span style={{fontFamily: F.display, fontSize: 17, fontWeight: 600, color: S.ink}}>الأكثر طلباً</span>
            <span style={{fontFamily: F.text, fontSize: 11, color: S.muted}}>عرض الكل</span>
          </div>
          <div style={{display: 'flex', gap: 9}}>
            {[
              {name: PRODUCT.name, price: '$9.99', tag: '660 UC'},
              {name: 'بطاقات آيتونز (متجر أمريكا)', price: '$10.60', tag: 'بطاقة 10$'},
            ].map((p, i) => (
              <div
                key={p.name}
                style={{
                  flex: 1,
                  borderRadius: R.sm,
                  background: S.solid1,
                  border: '1px solid rgba(20,26,38,0.06)',
                  boxShadow: '0 8px 18px -16px rgba(20,26,38,0.45)',
                  padding: 9,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: `radial-gradient(120% 110% at 30% 12%, ${mix(accent, '#FFFFFF', 0.3)}, ${accent} 52%, ${deep})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  <span style={{fontFamily: F.display, fontSize: 13, fontWeight: 700, color: inkOn}}>{p.tag.split(' ')[0]}</span>
                </div>
                <div style={{minWidth: 0, flex: 1}}>
                  <div style={{fontFamily: F.text, fontSize: 10.5, fontWeight: 600, color: S.ink, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p.name}</div>
                  <div dir="ltr" style={{fontFamily: F.display, fontSize: 14, fontWeight: 600, color: S.saffronText, lineHeight: 1.4, textAlign: 'right'}}>{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* tab bar (Home.svelte) */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            height: 58,
            borderRadius: R.md,
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(20,26,38,0.07)',
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          {HOME.tabs.map((tab, i) => (
            <div key={tab} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3}}>
              <Icon name={(['home', 'orders', 'wallet', 'user'] as const)[i]} size={18} color={i === 0 ? accent : S.muted} />
              <span style={{fontFamily: F.text, fontSize: 9, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? accent : S.muted}}>{tab}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── layout ───────────────────────────────────────────────────────────────── */

type Lay = {portrait: boolean; square: boolean; W: number; H: number; console: {x: number; y: number; w: number; h: number}; preview: {x: number; y: number; w: number; h: number}; head: {x: number; y: number; w: number}; h1: number; h2: number; kicker: number; align: 'right' | 'center'};

const layout = (W: number, H: number): Lay => {
  const portrait = H > W * 1.2;
  const square = !portrait && Math.abs(H - W) < 120;
  if (portrait) {
    return {
      portrait, square, W, H,
      console: {x: W * 0.05, y: H * 0.215, w: W * 0.9, h: H * 0.19},
      preview: {x: W * 0.22, y: H * 0.425, w: W * 0.56, h: H * 0.43},
      head: {x: W * 0.06, y: H * 0.062, w: W * 0.88},
      h1: W * 0.074,
      h2: W * 0.033,
      kicker: W * 0.026,
      align: 'center',
    };
  }
  if (square) {
    return {
      portrait, square, W, H,
      console: {x: W * 0.035, y: H * 0.34, w: W * 0.5, h: H * 0.46},
      preview: {x: W * 0.585, y: H * 0.325, w: W * 0.38, h: H * 0.575},
      head: {x: W * 0.05, y: H * 0.045, w: W * 0.9},
      h1: W * 0.044,
      h2: W * 0.022,
      kicker: W * 0.017,
      align: 'right',
    };
  }
  return {
    portrait, square, W, H,
      console: {x: W * 0.045, y: H * 0.44, w: W * 0.46, h: H * 0.46},
      preview: {x: W * 0.665, y: H * 0.155, w: W * 0.27, h: H * 0.76},
      head: {x: W * 0.05, y: H * 0.1, w: W * 0.5},
      h1: W * 0.044,
      h2: W * 0.024,
      kicker: W * 0.0155,
    align: 'right',
  };
};

/* ── scene ────────────────────────────────────────────────────────────────── */

export const DesignScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = since(f) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const head = (d.head as string[]) ?? ['متجرك…', 'بلونك وشكلك.'];
  const sub = (d.sub as string) ?? beat.line2 ?? '';

  /** Four real swatches, one per ~1.7 s; the ramp is derived from the live one. */
  const sequence = [0, 1, 2, 3];
  const step = 1.62;
  const seqAt = Math.max(0, Math.min(sequence.length - 1, Math.floor(sec / step)));
  const chosen = sequence[seqAt] ?? 0;
  const nextIdx = sequence[Math.min(sequence.length - 1, seqAt + 1)] ?? chosen;
  const local = clamp((sec % step) / 0.5);
  const accent = mix(SWATCHES[chosen], SWATCHES[nextIdx], local * 0.28);
  const activeSwatch = chosen;
  const styleIdx = Math.max(0, Math.min(2, Math.floor(sec / 2.15)));
  const style = CARD_STYLES[styleIdx].value;

  const boardIn = tween(f, at(0.1), 36, E.outExpo);
  const previewIn = tween(f, at(0.32), 42, E.outExpo);
  const glowPulse = 0.85 + Math.sin(sec * 2.2) * 0.15;

  const P = L.preview;
  const previewDp = (P.w - 2) / 412;
  const previewInnerH = P.h - (L.portrait ? 42 : 36);
  const ratio = contrastOnWhite(accent);

  return (
    <AbsoluteFill style={{background: '#04100F'}}>
      <Ground tone="ink" variant="atelier" grain={0.062} vignette={0.44} />
      <Bokeh count={9} opacity={0.28} />
      <AtelierFX accent={accent} intensity={0.95} />

      {/* the colour itself lighting the stage — this is the "paint" */}
      <div
        style={{
          position: 'absolute',
          left: P.x + P.w * 0.5,
          top: P.y + P.h * 0.44,
          width: P.w * 2.2,
          height: P.w * 1.55,
          marginLeft: -P.w * 1.1,
          marginTop: -P.w * 0.775,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${soft(accent, 0.24)}, ${soft(accent, 0.08)} 54%, transparent 76%)`,
          filter: 'blur(26px)',
          opacity: glowPulse * previewIn,
          pointerEvents: 'none',
        }}
      />

      {/* headline */}
      <div style={{position: 'absolute', left: L.head.x, top: L.head.y, width: L.head.w, textAlign: L.align}}>
        <Kicker
          text="هوية المتجر · لون واحد يكفي"
          color={mix(accent, '#FFFFFF', 0.18)}
          size={L.kicker}
          align={L.align === 'right' ? 'right' : 'center'}
          side={L.align === 'right' ? 'right' : 'left'}
          delay={at(0.12)}
        />
        <div style={{marginTop: L.portrait ? H * 0.012 : H * 0.018}}>
          {head.map((line, i) => (
            <div key={line} style={{marginTop: i === 0 ? 0 : -L.h1 * 0.02}}>
              <Ar
                text={line}
                size={L.h1 * (i === 0 ? 1 : 0.98)}
                weight={i === 0 ? 700 : 800}
                mode="words"
                align={L.align}
                color={i === 0 ? 'rgba(240,250,248,0.98)' : mix(accent, '#FFFFFF', 0.35)}
                emphasis={i === 0 ? [] : [line.replace('۔', '').trim()]}
                emphasisColor={mix(accent, '#FFFFFF', 0.35)}
                family={F.headline}
                lh={1.28}
                delay={at(0.2 + i * 0.16)}
                step={4}
                dur={24}
              />
            </div>
          ))}
        </div>
        <div style={{marginTop: L.portrait ? H * 0.008 : H * 0.012, maxWidth: L.head.w}}>
          {L.square ? (
            <Ar text={sub} size={L.h2} weight={500} mode="block" align={L.align} color="rgba(214,236,234,0.76)" lh={1.6} family={F.text} delay={at(0.58)} />
          ) : null}
        </div>
      </div>

      {/* ── the console: real controls ─────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: L.console.x,
          top: L.console.y,
          width: L.console.w,
          height: L.console.h,
          transform: `translateY(${(1 - boardIn) * 34}px)`,
          opacity: boardIn,
        }}
      >
        <div
          dir="rtl"
          style={{
            height: '100%',
            borderRadius: R.lg,
            padding: L.console.w * 0.042,
            boxSizing: 'border-box',
            background: 'linear-gradient(155deg, rgba(17,40,38,0.86), rgba(7,18,22,0.9))',
            border: '1px solid rgba(190,255,240,0.13)',
            boxShadow: '0 40px 90px -45px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            display: 'flex',
            flexDirection: 'column',
            gap: L.console.h * 0.032,
            overflow: 'hidden',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
            <div>
              <div style={{fontFamily: F.display, fontSize: L.portrait ? 24 : L.console.w * 0.05, fontWeight: 600, color: 'rgba(242,252,250,0.97)', lineHeight: 1.35}}>لون المتجر</div>
              <div style={{fontFamily: F.text, fontSize: L.portrait ? 13 : L.console.w * 0.024, color: 'rgba(178,206,204,0.66)', lineHeight: 1.5, marginTop: 3}}>
                لون واحد يتحوّل إلى لوحة كاملة تناسب الوضعين.
              </div>
            </div>
            <span
              dir="ltr"
              style={{
                fontFamily: F.text,
                fontSize: L.portrait ? 12 : L.console.w * 0.026,
                fontWeight: 600,
                color: 'rgba(236,252,249,0.72)',
                letterSpacing: 0.4,
              }}
            >
              {accent.toUpperCase()}
            </span>
          </div>

          <div style={{display: 'flex', gap: L.portrait ? 9 : L.console.w * 0.018, alignItems: 'center', flexWrap: 'wrap'}}>
            {SWATCHES.map((c, i) => {
              const on = i === activeSwatch;
              const press = tween(f, at(i * 0.06), 20, E.outBack);
              return (
                <div key={c} style={{position: 'relative', width: L.portrait ? 34 : L.console.w * 0.068, height: L.portrait ? 34 : L.console.w * 0.068}}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: c,
                      transform: `scale(${on ? 1.06 : 1} * ${0.8 + press * 0.2})`,
                      boxShadow: on ? `0 0 0 2.5px #0B211E, 0 0 0 4px ${c}, 0 0 22px ${soft(c, 0.6)}` : 'inset 0 0 0 1px rgba(255,255,255,0.16)',
                    }}
                  />
                </div>
              );
            })}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: F.text,
                fontSize: L.portrait ? 12 : L.console.w * 0.024,
                color: 'rgba(210,232,230,0.66)',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="plus" size={L.portrait ? 12 : 13} color="rgba(210,232,230,0.66)" />
              لون آخر
            </div>
          </div>

          {!L.portrait && (
            <div>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5}}>
                <span style={{fontFamily: F.text, fontSize: L.console.w * 0.019, color: 'rgba(178,206,204,0.6)'}}>درجات اللون الناتجة</span>
                <span dir="ltr" style={{fontFamily: F.text, fontSize: L.console.w * 0.016, color: 'rgba(178,206,204,0.42)'}}>50 — 900</span>
              </div>
              <div style={{display: 'flex', gap: 3}}>
                {[0.04, 0.12, 0.22, 0.34, 0.48, 0.62, 0.76, 0.88, 0.97].map((p, i) => (
                  <div key={i} style={{flex: 1, height: L.console.h * 0.045, borderRadius: 3, background: mix(accent, '#FFFFFF', 1 - p)}} />
                ))}
              </div>
            </div>
          )}

          <div style={{height: 1, background: 'rgba(190,255,240,0.10)'}} />

          <div>
            <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12}}>
              <span style={{fontFamily: F.display, fontSize: L.portrait ? 22 : L.console.w * 0.044, fontWeight: 600, color: 'rgba(242,252,250,0.96)', lineHeight: 1.35}}>شكل الكروت</span>
              <span style={{fontFamily: F.text, fontSize: L.portrait ? 11.5 : L.console.w * 0.021, color: 'rgba(178,206,204,0.6)'}}>يتغيّر في المعاينة فوراً</span>
            </div>
            <div style={{display: 'flex', gap: L.portrait ? 7 : L.console.w * 0.014, marginTop: L.portrait ? 7 : 10}}>
              {CARD_STYLES.map((s, i) => {
                const on = i === styleIdx;
                return (
                  <div
                    key={s.value}
                    style={{
                      flex: 1,
                      borderRadius: R.xs,
                      padding: L.portrait ? '6px 7px' : '7px 8px',
                      background: on ? soft(accent, 0.16) : 'rgba(255,255,255,0.035)',
                      border: `1px solid ${on ? soft(accent, 0.55) : 'rgba(190,255,240,0.10)'}`,
                      transform: `scale(${on ? 1 : 0.98})`,
                      minWidth: 0,
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                      <span
                        style={{
                          width: 22,
                          height: 27,
                          borderRadius: 5,
                          background: s.value === 'framed' ? soft(accent, 0.18) : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${on ? soft(accent, 0.5) : 'rgba(190,255,240,0.14)'}`,
                          position: 'relative',
                          overflow: 'hidden',
                          flex: 'none',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            left: s.value === 'framed' ? 3 : 0,
                            right: s.value === 'framed' ? 3 : 0,
                            top: s.value === 'framed' ? 3 : 0,
                            height: s.value === 'classic' ? 13 : s.value === 'framed' ? 14 : 27,
                            borderRadius: s.value === 'framed' ? 3 : 0,
                            background: `linear-gradient(135deg, ${mix(accent, '#FFFFFF', 0.35)}, ${accent})`,
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            left: 4,
                            right: 4,
                            bottom: 4,
                            height: 3,
                            borderRadius: 1,
                            background: s.value === 'overlay' ? 'rgba(255,255,255,0.9)' : on ? 'rgba(244,255,252,0.75)' : 'rgba(190,255,240,0.45)',
                          }}
                        />
                      </span>
                      <span style={{fontFamily: F.text, fontSize: L.portrait ? 12 : L.console.w * 0.024, fontWeight: 600, color: on ? 'rgba(244,255,252,0.98)' : 'rgba(214,236,234,0.62)', whiteSpace: 'nowrap'}}>{s.label}</span>
                    </div>
                    {!L.portrait && (
                      <div style={{fontFamily: F.text, fontSize: L.console.w * 0.017, color: 'rgba(178,206,204,0.5)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.hint}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: L.portrait ? '5px 9px' : '6px 10px',
                borderRadius: 999,
                background: 'rgba(30,158,106,0.13)',
                border: '1px solid rgba(30,158,106,0.35)',
                fontFamily: F.text,
                fontSize: L.portrait ? 11.5 : L.console.w * 0.021,
                fontWeight: 600,
                color: 'rgba(160,240,204,0.92)',
              }}
            >
              <Icon name="check" size={11} color="rgba(160,240,204,0.92)" />
              <span>وضوح النص على اللون: <b dir="ltr">{ratio}:1</b></span>
            </span>
            <span style={{fontFamily: F.text, fontSize: L.portrait ? 10 : L.console.w * 0.018, color: 'rgba(178,206,204,0.52)'}}>فاتح · داكن</span>
          </div>
        </div>
      </div>

      {/* ── the live preview ───────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: L.preview.x,
          top: L.preview.y,
          width: L.preview.w,
          height: L.preview.h,
          transform: `translateY(${(1 - previewIn) * 46}px) scale(${0.965 + previewIn * 0.035}) perspective(1600px) rotateY(${L.portrait ? -2 : -5}deg) rotateX(1.5deg)`,
          opacity: previewIn,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: L.portrait ? 26 : R.lg,
            overflow: 'hidden',
            background: '#0A1718',
            border: '1px solid rgba(210,255,244,0.16)',
            boxShadow: `0 50px 110px -50px rgba(0,0,0,0.95), 0 0 70px ${soft(accent, 0.16)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          <div
            dir="rtl"
            style={{
              height: L.portrait ? 42 : 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingInline: 14,
              background: 'rgba(8,22,22,0.9)',
              borderBottom: '1px solid rgba(210,255,244,0.10)',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <span style={{width: 8, height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 10px ${soft(accent, 0.9)}`}} />
              <span style={{fontFamily: F.text, fontSize: L.portrait ? 12 : L.preview.w * 0.026, fontWeight: 600, color: 'rgba(232,250,247,0.88)'}}>معاينة حية</span>
            </div>
            <span style={{fontFamily: F.text, fontSize: L.portrait ? 10 : L.preview.w * 0.022, color: 'rgba(178,206,204,0.48)'}}>{STORE.name}</span>
          </div>
          <div style={{height: previewInnerH, overflow: 'hidden', position: 'relative'}}>
            <StorePreview dp={previewDp} accent={accent} style={style} t={f} sinceChange={at(styleIdx * 2.15)} />
            {/* the glass of the preview, so it reads as a screen, not a flat print */}
            <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(118deg, rgba(255,255,255,0.10), transparent 26%, transparent 74%, rgba(255,255,255,0.06))', mixBlendMode: 'screen'}} />
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%', background: 'linear-gradient(180deg, transparent, rgba(8,20,22,0.9))', pointerEvents: 'none'}} />
          </div>
        </div>
        {/* a small caption under the preview, in the film's voice */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: L.portrait ? -H * 0.028 : -H * 0.034,
            textAlign: 'center',
            fontFamily: F.text,
            fontSize: L.portrait ? 12 : L.preview.w * 0.028,
            color: 'rgba(198,226,222,0.55)',
            opacity: previewIn,
          }}
        >
          نفس المتجر… بلون ثانٍ في ثانية.
        </div>
      </div>
    </AbsoluteFill>
  );
};

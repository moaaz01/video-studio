/**
 * Scene: sourcing + automatic repricing — the commercial heart of the store.
 *
 * The claims are the app's own:
 *   - a package can be linked to several API sources (R67 / D7);
 *   - routing is «بالأولوية» or «الأرخص», and the next source is tried silently (R24 / D7);
 *   - margin is a percentage or a fixed amount; a source cost rise raises the
 *     sale price, a fall only notifies the owner (R23 / D6).
 *
 * The numbers are an explicit worked example, labelled «مثال», not a live quote.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {E, clamp, tween} from '../lib/anim';
import {S, F, R, GLASS} from './tokens';
import {Ar, Kicker} from '../components/Text';
import {Bokeh, Ground} from '../components/Surfaces';
import {AtelierFX} from './atelier';
import {Icon} from './ui';
import type {Beat} from '../film/types';

const PREROLL = 8;
const FPS = 30;
const at = (sec: number) => PREROLL + Math.round(sec * FPS);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const money = (v: number) => `$${v.toFixed(2)}`;

type Source = {name: string; cost: number; available: boolean};

type Lay = {
  portrait: boolean;
  square: boolean;
  W: number;
  H: number;
  head: {x: number; y: number; w: number};
  product: {x: number; y: number; w: number; h: number};
  sources: {x: number; y: number; w: number; h: number};
  price: {x: number; y: number; w: number; h: number};
  toast: {x: number; y: number; w: number};
  h1: number;
  h2: number;
  kicker: number;
  align: 'right' | 'center';
};

const layout = (W: number, H: number): Lay => {
  const portrait = H > W * 1.2;
  const square = !portrait && Math.abs(H - W) < 120;
  if (portrait) {
    return {
      portrait, square, W, H,
      head: {x: W * 0.06, y: H * 0.055, w: W * 0.88},
      product: {x: W * 0.5, y: H * 0.255, w: W * 0.42, h: H * 0.205},
      sources: {x: W * 0.05, y: H * 0.465, w: W * 0.9, h: H * 0.125},
      price: {x: W * 0.05, y: H * 0.60, w: W * 0.9, h: H * 0.27},
      toast: {x: W * 0.08, y: H * 0.89, w: W * 0.84},
      h1: W * 0.07, h2: W * 0.032, kicker: W * 0.026, align: 'center',
    };
  }
  if (square) {
    return {
      portrait, square, W, H,
      head: {x: W * 0.05, y: H * 0.055, w: W * 0.9},
      product: {x: W * 0.43, y: H * 0.28, w: W * 0.25, h: H * 0.42},
      sources: {x: W * 0.025, y: H * 0.3, w: W * 0.27, h: H * 0.6},
      price: {x: W * 0.60, y: H * 0.34, w: W * 0.375, h: H * 0.55},
      toast: {x: W * 0.03, y: H * 0.90, w: W * 0.55},
      h1: W * 0.043, h2: W * 0.022, kicker: W * 0.015, align: 'center',
    };
  }
  return {
    portrait, square, W, H,
    head: {x: W * 0.05, y: H * 0.08, w: W * 0.52},
    product: {x: W * 0.38, y: H * 0.53, w: W * 0.22, h: H * 0.32},
    sources: {x: W * 0.04, y: H * 0.53, w: W * 0.22, h: H * 0.44},
    price: {x: W * 0.60, y: H * 0.24, w: W * 0.36, h: H * 0.58},
    toast: {x: W * 0.29, y: H * 0.86, w: W * 0.26},
    h1: W * 0.040, h2: W * 0.022, kicker: W * 0.0155, align: 'right',
  };
};

const SourceCard: React.FC<{
  index: number;
  name: string;
  cost: number;
  cheapest: boolean;
  p: number;
  w: number;
  highlight: boolean;
}> = ({index, name, cost, cheapest, p, w, highlight}) => (
  <div
    dir="rtl"
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: w * 0.055,
      padding: `${w * 0.05}px ${w * 0.06}px`,
      borderRadius: R.sm,
      background: highlight
        ? 'linear-gradient(150deg, rgba(28,58,112,0.92), rgba(10,22,44,0.92))'
        : 'linear-gradient(150deg, rgba(17,34,64,0.76), rgba(6,14,28,0.82))',
      border: `1px solid ${highlight ? 'rgba(120,180,255,0.52)' : 'rgba(150,190,255,0.13)'}`,
      boxShadow: highlight ? '0 18px 45px -28px rgba(47,107,255,0.9), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      opacity: p,
      transform: `translateY(${(1 - p) * 16}px) scale(${0.97 + p * 0.03})`,
      height: '100%',
      boxSizing: 'border-box',
      minWidth: 0,
    }}
  >
    <div
      style={{
        width: w * 0.12,
        height: w * 0.12,
        borderRadius: w * 0.035,
        background: highlight ? 'linear-gradient(150deg, #4C8CFF, #1E3A7A)' : 'rgba(120,160,220,0.12)',
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
      }}
    >
      <Icon name="bolt" size={w * 0.06} color={highlight ? '#F4FAFF' : 'rgba(190,215,255,0.55)'} />
    </div>
    <div style={{minWidth: 0, flex: 1}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
        <span style={{fontFamily: F.headline, fontSize: w * 0.062, fontWeight: 700, color: 'rgba(244,248,255,0.95)', lineHeight: 1.3, whiteSpace: 'nowrap'}}>{name}</span>
        {cheapest ? (
          <span style={{fontFamily: F.text, fontSize: w * 0.038, fontWeight: 600, color: '#BFD9FF', background: 'rgba(76,140,255,0.18)', border: '1px solid rgba(120,180,255,0.35)', borderRadius: 999, padding: `1px ${w * 0.025}px`, whiteSpace: 'nowrap'}}>الأرخص</span>
        ) : null}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 5, marginTop: 2}}>
        <span style={{width: 5, height: 5, borderRadius: 3, background: '#4C8CFF'}} />
        <span style={{fontFamily: F.text, fontSize: w * 0.042, color: 'rgba(178,205,240,0.55)'}}>متوفر · API</span>
      </div>
    </div>
    <div style={{textAlign: 'left', flex: 'none'}}>
      <div style={{fontFamily: F.text, fontSize: w * 0.036, color: 'rgba(178,205,240,0.45)', lineHeight: 1.3}}>التكلفة</div>
      <div dir="ltr" style={{fontFamily: F.display, fontSize: w * 0.075, fontWeight: 600, color: 'rgba(245,249,255,0.96)', lineHeight: 1.25}}>{money(cost)}</div>
    </div>
  </div>
);

export const SourcesScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = (f - PREROLL) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const head = (d.head as string[]) ?? ['من عدة مصادر…', 'أفضل سعر، وأعلى ربح.'];
  const sub = (d.sub as string) ?? beat.line2 ?? '';
  const sources = (d.sources as Source[]) ?? [
    {name: 'مصدر ١', cost: 8.2, available: true},
    {name: 'مصدر ٢', cost: 8.45, available: true},
    {name: 'مصدر ٣', cost: 8.6, available: true},
  ];
  const marginPct = Number(d.marginPct ?? 15) / 100;

  // the source price rises once, on the beat; the sale price follows automatically
  const bump = tween(f, at(4.9), 26, E.inOut);
  const cost0 = lerp(sources[0].cost, 8.7, bump);
  const costs = sources.map((s, i) => (i === 0 ? cost0 : s.cost));
  const cheapestCost = Math.min(...costs);
  const cheapestIdx = costs.indexOf(cheapestCost);
  const sale = cheapestCost * (1 + marginPct);
  const profit = sale - cheapestCost;

  const boardIn = tween(f, at(0.08), 36, E.outExpo);
  const productIn = tween(f, at(0.25), 34, E.outExpo);
  const priceIn = tween(f, at(0.4), 36, E.outExpo);
  const alertIn = tween(f, at(5.1), 24, E.outBack);

  const cw = L.product.w;
  const priceW = L.price.w;

  return (
    <AbsoluteFill style={{background: '#030713'}}>
      <Ground tone="ink" variant="cobalt" grain={0.06} vignette={0.44} />
      <Bokeh count={8} opacity={0.24} />
      <AtelierFX accent="#2F6BFF" intensity={0.75} />

      <div style={{position: 'absolute', left: L.head.x, top: L.head.y, width: L.head.w, textAlign: L.align}}>
        <Kicker
          text="المصادر والتسعير · ربحك أولاً"
          color="rgba(150,195,255,0.92)"
          size={L.kicker}
          align={L.align === 'right' ? 'right' : 'center'}
          side={L.align === 'right' ? 'right' : 'left'}
          delay={at(0.05)}
        />
        <div style={{marginTop: L.portrait ? H * 0.01 : H * 0.016}}>
          {head.map((line, i) => (
            <div key={line} style={{marginTop: i === 0 ? 0 : -L.h1 * 0.02}}>
              <Ar
                text={line}
                size={L.h1 * (i === 0 ? 0.86 : 1)}
                weight={i === 0 ? 700 : 800}
                mode="words"
                align={L.align}
                color={i === 0 ? 'rgba(243,247,255,0.98)' : '#F2A93B'}
                emphasis={i === 0 ? [] : [line]}
                emphasisColor="#F2A93B"
                family={F.headline}
                lh={1.28}
                delay={at(0.1 + i * 0.14)}
                step={4}
                dur={24}
              />
            </div>
          ))}
        </div>
        <div style={{marginTop: L.portrait ? H * 0.006 : H * 0.012, maxWidth: L.head.w}}>
          <Ar text={sub} size={L.h2} weight={500} mode="block" align={L.align} color="rgba(196,218,245,0.72)" lh={1.6} family={F.text} delay={at(0.5)} />
        </div>
      </div>

      {/* sources column / row */}
      <div
        style={{
          position: 'absolute',
          left: L.sources.x,
          top: L.sources.y,
          width: L.sources.w,
          height: L.sources.h,
          display: 'flex',
          flexDirection: L.portrait ? 'row' : 'column',
          gap: L.portrait ? L.sources.w * 0.018 : L.sources.h * 0.03,
          opacity: boardIn,
        }}
      >
        {sources.map((s, i) => (
          <div key={s.name} style={{flex: 1, minWidth: 0}}>
            <SourceCard
              index={i}
              name={s.name}
              cost={i === 0 ? cost0 : s.cost}
              cheapest={i === cheapestIdx}
              p={tween(f, at(0.45 + i * 0.16), 26, E.outExpo)}
              w={L.portrait ? L.sources.w * 0.31 : L.sources.w}
              highlight={i === cheapestIdx}
            />
          </div>
        ))}
      </div>

      {/* product ticket */}
      <div
        style={{
          position: 'absolute',
          left: L.product.x,
          top: L.product.y,
          width: L.product.w,
          height: L.product.h,
          transform: `translate(-50%,${(1 - productIn) * 30}px) scale(${0.96 + productIn * 0.04})`,
          opacity: productIn,
        }}
      >
        <div
          dir="rtl"
          style={{
            height: '100%',
            borderRadius: R.lg,
            padding: cw * 0.07,
            boxSizing: 'border-box',
            background: 'linear-gradient(160deg, #FFFFFF 0%, #F5F8FD 55%, #EAF0F8 100%)',
            boxShadow: `0 45px 90px -45px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.16), 0 0 70px rgba(47,107,255,0.18)`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,124,128,0.08)', border: '1px solid rgba(15,124,128,0.18)', borderRadius: 999, padding: `${cw * 0.018}px ${cw * 0.03}px`}}>
              <Icon name="bolt" size={cw * 0.035} color={S.brandText} />
              <span style={{fontFamily: F.text, fontSize: cw * 0.03, fontWeight: 600, color: S.brandText}}>مرتبط بمصادر</span>
            </div>
            <span style={{fontFamily: F.text, fontSize: cw * 0.024, color: S.muted}}>مثال</span>
          </div>

          <div
            style={{
              marginTop: cw * 0.06,
              height: cw * 0.26,
              borderRadius: R.md,
              background: `radial-gradient(120% 120% at 78% 8%, #46C7CB 0%, ${S.brand} 48%, #0A5F63 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 18px 30px -22px rgba(15,124,128,0.8)',
            }}
          >
            <span style={{fontFamily: F.display, fontSize: cw * 0.12, fontWeight: 600, color: '#FFFFFF', opacity: 0.92}}>UC</span>
          </div>

          <div style={{marginTop: cw * 0.045, fontFamily: F.headline, fontSize: cw * 0.052, fontWeight: 700, color: S.ink, lineHeight: 1.35}}>
            شدّات ببجي موبايل
          </div>
          <div style={{marginTop: 2, fontFamily: F.text, fontSize: cw * 0.031, color: S.muted, lineHeight: 1.45}}>660 UC · شحن فوري</div>

          <div style={{marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8}}>
            <div>
              <div style={{fontFamily: F.text, fontSize: cw * 0.026, color: S.muted, lineHeight: 1.4}}>سعر البيع</div>
              <div dir="ltr" style={{fontFamily: F.display, fontSize: cw * 0.085, fontWeight: 600, color: S.saffronText, lineHeight: 1.2}}>{money(sale)}</div>
            </div>
            <span style={{fontFamily: F.text, fontSize: cw * 0.025, color: S.success, fontWeight: 600}}>+ ربح {money(profit)}</span>
          </div>
        </div>
      </div>

      {/* pricing panel */}
      <div
        style={{
          position: 'absolute',
          left: L.price.x,
          top: L.price.y,
          width: L.price.w,
          height: L.price.h,
          opacity: priceIn,
          transform: `translateY(${(1 - priceIn) * 28}px)`,
        }}
      >
        <div
          dir="rtl"
          style={{
            height: '100%',
            borderRadius: R.lg,
            padding: priceW * 0.06,
            boxSizing: 'border-box',
            background: 'linear-gradient(155deg, rgba(16,34,62,0.86), rgba(5,13,27,0.9))',
            border: '1px solid rgba(160,200,255,0.18)',
            boxShadow: '0 45px 100px -50px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            display: 'flex',
            flexDirection: 'column',
            gap: priceW * (L.portrait ? 0.012 : 0.018),
            overflow: 'hidden',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
            <div style={{fontFamily: F.headline, fontSize: priceW * (L.portrait ? 0.041 : 0.048), fontWeight: 700, color: 'rgba(245,249,255,0.97)', lineHeight: 1.3}}>التسعير التلقائي</div>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: F.text, fontSize: priceW * 0.024, fontWeight: 600, color: '#CDE3FF', background: 'rgba(76,140,255,0.14)', border: '1px solid rgba(120,180,255,0.3)', borderRadius: 999, padding: `${priceW * 0.009}px ${priceW * 0.018}px`, whiteSpace: 'nowrap'}}>
              <Icon name="check" size={priceW * 0.024} color="#9CC8FF" />
              مفعّل
            </span>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: priceW * 0.008}}>
            <span style={{fontFamily: F.text, fontSize: priceW * 0.026, color: 'rgba(180,205,240,0.62)'}}>هامش الربح</span>
            <span dir="ltr" style={{fontFamily: F.display, fontSize: priceW * 0.042, fontWeight: 600, color: 'rgba(245,249,255,0.96)'}}>15%</span>
            <div style={{flex: 1, height: 5, borderRadius: 3, background: 'rgba(120,160,220,0.14)', overflow: 'hidden'}}>
              <div style={{width: '62%', height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #4C8CFF, #9CC8FF)'}} />
            </div>
          </div>

          <div style={{height: 1, background: 'rgba(150,190,255,0.12)', marginBlock: priceW * 0.012}} />

          {[
            {label: 'تكلفة المصدر', value: money(cheapestCost), tone: 'rgba(196,218,245,0.9)'},
            {label: 'سعر البيع', value: money(sale), tone: '#9CC8FF'},
            {label: 'ربحك', value: money(profit), tone: '#7FE3C0'},
          ].map((row) => (
            <div key={row.label} style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8}}>
              <span style={{fontFamily: F.text, fontSize: priceW * 0.028, color: 'rgba(178,205,240,0.62)'}}>{row.label}</span>
              <span dir="ltr" style={{fontFamily: F.display, fontSize: priceW * (L.portrait ? 0.046 : 0.055), fontWeight: 600, color: row.tone, lineHeight: 1.3}}>{row.value}</span>
            </div>
          ))}

          <div style={{marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'}}>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: F.text, fontSize: priceW * 0.024, color: 'rgba(196,218,245,0.72)'}}>
              <Icon name="bolt" size={priceW * 0.024} color="#9CC8FF" />
              التنفيذ: الأرخص
            </span>
            <span style={{fontFamily: F.text, fontSize: priceW * 0.022, color: 'rgba(178,205,240,0.48)', whiteSpace: 'nowrap'}}>إن تعذّر: التالي تلقائياً</span>
          </div>
          {!L.portrait && !L.square ? (
            <div style={{fontFamily: F.text, fontSize: priceW * 0.022, color: 'rgba(178,205,240,0.5)', lineHeight: 1.5}}>
              عند انخفاض التكلفة نُبلغك لتخفّض سعرك وتبقى منافساً.
            </div>
          ) : null}
        </div>
      </div>

      {/* the automatic update alert */}
      <div
        style={{
          position: 'absolute',
          left: L.toast.x,
          top: L.toast.y,
          width: L.toast.w,
          transform: `translateY(${(1 - alertIn) * 18}px)`,
          opacity: alertIn,
        }}
      >
        <div
          dir="rtl"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: priceW * 0.026,
            padding: `${priceW * 0.026}px ${priceW * 0.034}px`,
            borderRadius: R.sm,
            background: 'linear-gradient(150deg, rgba(58,42,18,0.94), rgba(20,18,12,0.92))',
            border: '1px solid rgba(242,169,59,0.38)',
            boxShadow: '0 22px 50px -30px rgba(0,0,0,0.9), 0 0 34px rgba(242,169,59,0.12)',
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
          }}
        >
          <div style={{width: priceW * 0.07, height: priceW * 0.07, borderRadius: priceW * 0.022, background: 'rgba(242,169,59,0.14)', display: 'grid', placeItems: 'center', flex: 'none'}}>
            <Icon name="refresh" size={priceW * 0.036} color="#F2A93B" />
          </div>
          <div style={{minWidth: 0, flex: 1}}>
            <div style={{fontFamily: F.headline, fontSize: priceW * 0.032, fontWeight: 700, color: 'rgba(240,255,250,0.96)', lineHeight: 1.35}}>ارتفع سعر المصدر</div>
            <div style={{fontFamily: F.text, fontSize: priceW * 0.024, color: 'rgba(190,225,215,0.68)', lineHeight: 1.45}}>انتقلنا للأرخص وحدّثنا سعر البيع — ربحك محفوظ.</div>
          </div>
          <span dir="ltr" style={{fontFamily: F.display, fontSize: priceW * 0.04, fontWeight: 600, color: '#F2A93B', whiteSpace: 'nowrap'}}>{money(sale)}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

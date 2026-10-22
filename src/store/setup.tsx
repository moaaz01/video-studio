/**
 * Scene: the guided setup — the shortest path from a new store to "open".
 *
 * The labels are the real wizard steps (`STEPS` in
 * `webapp/src/lib/api/mock/admin/store.setup.ts`); the 15-minute figure is the
 * app's own guide (`lib/setup/guides.ts` → welcome.example), conditioned on the
 * payment/source keys being ready. This is a data scene, not a fake screen.
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

const STEPS = [
  {title: 'هوية المتجر', hint: 'الاسم والشعار واللون', icon: 'spark'},
  {title: 'العملة وسعر الليرة', hint: 'الدولار والليرة', icon: 'coin'},
  {title: 'وسائل الدفع', hint: 'يدوي أو تحقق تلقائي', icon: 'wallet'},
  {title: 'المصادر', hint: 'اربط مزوّديك', icon: 'bolt'},
  {title: 'المنتجات', hint: 'استيراد أو إدخال يدوي', icon: 'bag'},
  {title: 'الإطلاق', hint: 'افتح متجرك للعملاء', icon: 'send'},
] as const;

type Lay = {
  portrait: boolean;
  square: boolean;
  W: number;
  H: number;
  head: {x: number; y: number; w: number};
  board: {x: number; y: number; w: number; h: number};
  h1: number;
  h2: number;
  kicker: number;
  align: 'right' | 'center';
  stepCols: number;
};

const layout = (W: number, H: number): Lay => {
  const portrait = H > W * 1.2;
  const square = !portrait && Math.abs(H - W) < 120;
  if (portrait) {
    return {
      portrait, square, W, H,
      head: {x: W * 0.06, y: H * 0.06, w: W * 0.88},
      board: {x: W * 0.05, y: H * 0.275, w: W * 0.9, h: H * 0.585},
      h1: W * 0.074, h2: W * 0.033, kicker: W * 0.026, align: 'center', stepCols: 1,
    };
  }
  if (square) {
    return {
      portrait, square, W, H,
      head: {x: W * 0.06, y: H * 0.055, w: W * 0.88},
      board: {x: W * 0.035, y: H * 0.32, w: W * 0.93, h: H * 0.54},
      h1: W * 0.045, h2: W * 0.024, kicker: W * 0.016, align: 'center', stepCols: 2,
    };
  }
  return {
    portrait, square, W, H,
    head: {x: W * 0.05, y: H * 0.12, w: W * 0.4},
    board: {x: W * 0.475, y: H * 0.11, w: W * 0.475, h: H * 0.78},
    h1: W * 0.052, h2: W * 0.026, kicker: W * 0.0155, align: 'right', stepCols: 2,
  };
};

const StepCard: React.FC<{
  index: number;
  title: string;
  hint: string;
  icon: string;
  p: number;
  cw: number;
  compact: boolean;
  cols: number;
}> = ({index, title, hint, icon, p, cw, compact, cols}) => (
  <div
    dir="rtl"
    style={{
      position: 'relative',
      flex: cols === 1 ? '1 0 100%' : `0 0 calc(50% - ${cw * 0.012}px)`,
      minHeight: cols === 1 ? (compact ? cw * 0.075 : cw * 0.09) : compact ? cw * 0.095 : cw * 0.13,
      borderRadius: R.sm,
      padding: `${cw * 0.018}px ${cw * 0.022}px`,
      background: 'linear-gradient(150deg, rgba(18,36,64,0.78), rgba(7,16,32,0.82))',
      border: `1px solid ${p > 0.55 ? 'rgba(120,180,255,0.30)' : 'rgba(150,190,255,0.12)'}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px -30px rgba(0,0,0,0.9)',
      opacity: p,
      transform: `translateY(${(1 - p) * 18}px) scale(${0.97 + p * 0.03})`,
      display: 'flex',
      alignItems: 'center',
      gap: cw * 0.016,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: cw * 0.052,
        height: cw * 0.052,
        borderRadius: cw * 0.017,
        background: p > 0.55 ? 'linear-gradient(150deg, #3F7BFF, #1D45B8)' : 'rgba(120,160,220,0.12)',
        boxShadow: p > 0.55 ? '0 8px 18px -8px rgba(63,123,255,0.9)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <Icon name={icon as never} size={cw * 0.026} color={p > 0.55 ? '#FFFFFF' : 'rgba(190,215,255,0.55)'} />
    </div>
    <div style={{minWidth: 0, flex: 1}}>
      <div style={{fontFamily: F.headline, fontSize: cw * 0.025, fontWeight: 700, color: 'rgba(244,248,255,0.96)', lineHeight: 1.32, whiteSpace: 'nowrap'}}>{title}</div>
      <div style={{fontFamily: F.text, fontSize: cw * 0.016, color: 'rgba(178,205,240,0.62)', lineHeight: 1.4, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{hint}</div>
    </div>
    <span
      style={{
        fontFamily: F.display,
        fontSize: cw * 0.024,
        fontWeight: 600,
        color: `rgba(190,215,255,${0.28 + p * 0.45})`,
        flex: 'none',
      }}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
    {p > 0.72 ? (
      <span
        style={{
          position: 'absolute',
          left: cw * 0.012,
          bottom: cw * 0.012,
          width: cw * 0.018,
          height: cw * 0.018,
          borderRadius: 99,
          background: '#4C8CFF',
          boxShadow: '0 0 10px rgba(76,140,255,0.9)',
          opacity: (p - 0.72) / 0.28,
        }}
      />
    ) : null}
  </div>
);

export const SetupScene: React.FC<{beat: Beat; vertical?: boolean; motion?: number}> = ({beat}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const L = layout(W, H);
  const sec = (f - PREROLL) / FPS;
  const d = (beat.data ?? {}) as Record<string, unknown>;
  const head = (d.head as string[]) ?? ['من أول خطوة…', 'إلى الإطلاق.'];
  const sub = (d.sub as string) ?? beat.line2 ?? '';

  const boardIn = tween(f, at(0.08), 38, E.outExpo);
  const ring = tween(f, at(0.35), 60, E.inOut);
  const launch = tween(f, at(4.7), 30, E.outBack);
  const cw = Math.min(L.board.w, L.board.h * 1.15);
  const compact = L.square;

  return (
    <AbsoluteFill style={{background: '#030713'}}>
      <Ground tone="ink" variant="cobalt" grain={0.06} vignette={0.46} />
      <Bokeh count={9} opacity={0.26} />
      <AtelierFX accent="#2F6BFF" intensity={0.85} />

      <div style={{position: 'absolute', left: L.head.x, top: L.head.y, width: L.head.w, textAlign: L.align}}>
        <Kicker
          text="الإعداد · من الهوية إلى الإطلاق"
          color="rgba(150,195,255,0.92)"
          size={L.kicker}
          align={L.align === 'right' ? 'right' : 'center'}
          side={L.align === 'right' ? 'right' : 'left'}
          delay={at(0.05)}
        />
        <div style={{marginTop: L.portrait ? H * 0.012 : H * 0.018}}>
          {head.map((line, i) => (
            <div key={line} style={{marginTop: i === 0 ? 0 : -L.h1 * 0.02}}>
              <Ar
                text={line}
                size={L.h1 * (i === 0 ? 0.94 : 1)}
                weight={i === 0 ? 700 : 800}
                mode="words"
                align={L.align}
                color={i === 0 ? 'rgba(243,247,255,0.98)' : '#9CC8FF'}
                emphasis={i === 0 ? [] : [line]}
                emphasisColor="#9CC8FF"
                family={F.headline}
                lh={1.3}
                delay={at(0.12 + i * 0.14)}
                step={4}
                dur={24}
              />
            </div>
          ))}
        </div>
        <div style={{marginTop: L.portrait ? H * 0.008 : H * 0.014, maxWidth: L.head.w}}>
          <Ar text={sub} size={L.h2} weight={500} mode="block" align={L.align} color="rgba(196,218,245,0.72)" lh={1.6} family={F.text} delay={at(0.55)} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: L.board.x,
          top: L.board.y,
          width: L.board.w,
          height: L.board.h,
          opacity: boardIn,
          transform: `translateY(${(1 - boardIn) * 36}px)`,
        }}
      >
        <div
          dir="rtl"
          style={{
            height: '100%',
            borderRadius: R.lg,
            padding: cw * 0.032,
            boxSizing: 'border-box',
            background: 'linear-gradient(155deg, rgba(16,34,62,0.82), rgba(5,13,27,0.88))',
            border: '1px solid rgba(160,200,255,0.18)',
            boxShadow: '0 50px 120px -55px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.07)',
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            display: 'flex',
            flexDirection: 'column',
            gap: cw * 0.02,
            overflow: 'hidden',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
            <div>
              <div style={{fontFamily: F.headline, fontSize: cw * 0.033, fontWeight: 700, color: 'rgba(245,249,255,0.98)', lineHeight: 1.3}}>إعداد المتجر</div>
              <div style={{fontFamily: F.text, fontSize: cw * 0.017, color: 'rgba(180,205,240,0.6)', lineHeight: 1.4, marginTop: 2}}>خطوة واحدة في كل شاشة، والحفظ تلقائي.</div>
              <div style={{display: 'flex', alignItems: 'center', gap: cw * 0.009, marginTop: cw * 0.012}}>
                <span style={{display: 'inline-flex', alignItems: 'center', gap: 4, padding: `${cw * 0.007}px ${cw * 0.013}px`, borderRadius: 999, background: 'rgba(76,140,255,0.16)', border: '1px solid rgba(120,180,255,0.34)'}}>
                  <Icon name="bolt" size={cw * 0.018} color="#9CC8FF" />
                  <span style={{fontFamily: F.text, fontSize: cw * 0.019, fontWeight: 600, color: '#D6E7FF'}}>≈ 15 دقيقة</span>
                </span>
                <span style={{fontFamily: F.text, fontSize: cw * 0.013, color: 'rgba(178,205,240,0.5)'}}>إذا كانت المفاتيح جاهزة</span>
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: cw * 0.012}}>
              <div
                style={{
                  width: cw * 0.085,
                  height: cw * 0.085,
                  borderRadius: '50%',
                  background: `conic-gradient(#4C8CFF ${ring * 360}deg, rgba(120,160,220,0.14) 0)`,
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <div style={{width: '78%', height: '78%', borderRadius: '50%', background: '#08142A', display: 'grid', placeItems: 'center'}}>
                  <span style={{fontFamily: F.display, fontSize: cw * 0.022, fontWeight: 600, color: 'rgba(245,249,255,0.95)'}}>{Math.round(ring * 6)}/6</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{flex: 1, display: 'flex', flexWrap: 'wrap', gap: cw * 0.012, alignContent: L.portrait ? 'space-between' : 'center'}}>
            {STEPS.map((s, i) => {
              const p = tween(f, at(0.4 + i * 0.28), 26, E.outExpo);
              return <StepCard key={s.title} index={i} title={s.title} hint={s.hint} icon={s.icon} p={p} cw={cw} compact={compact} cols={L.stepCols} />;
            })}
          </div>

          <div style={{marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cw * 0.02, flexWrap: 'wrap'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: cw * 0.012}}>
              <span style={{fontFamily: F.text, fontSize: cw * 0.014, color: 'rgba(178,205,240,0.52)'}}>كل الخطوات في مكان واحد.</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: cw * 0.01,
                padding: `${cw * 0.014}px ${cw * 0.028}px`,
                borderRadius: R.sm,
                background: `linear-gradient(180deg, ${launch > 0.1 ? '#4C8CFF' : '#2A4A86'}, #1E3A7A)`,
                boxShadow: launch > 0.1 ? '0 14px 30px -14px rgba(76,140,255,0.85), inset 0 1px 0 rgba(255,255,255,0.25)' : undefined,
                transform: `scale(${0.96 + launch * 0.04})`,
                opacity: 0.55 + launch * 0.45,
              }}
            >
              <Icon name="send" size={cw * 0.022} color="#F4FAFF" />
              <span style={{fontFamily: F.headline, fontSize: cw * 0.022, fontWeight: 700, color: '#F4FAFF', whiteSpace: 'nowrap'}}>أطلق متجرك</span>
            </div>
          </div>
        </div>
      </div>

      {/* a slim champagne thread: the one visual link to the source/price scene */}
      <div
        style={{
          position: 'absolute',
          left: L.portrait ? W * 0.08 : W * 0.43,
          top: L.board.y + L.board.h * 0.07,
          width: 2,
          height: L.board.h * ring * 0.84,
          background: 'linear-gradient(to bottom, rgba(242,169,59,0.0), rgba(242,169,59,0.75), rgba(242,169,59,0.0))',
          boxShadow: '0 0 18px rgba(242,169,59,0.25)',
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

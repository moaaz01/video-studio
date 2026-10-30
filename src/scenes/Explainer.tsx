import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ground, Glow, Ruled, Bokeh} from '../components/Surfaces';
import {FONT} from '../theme';
import {clamp, countUp, E, entrance, entStyle, tween} from '../lib/anim';
import type {SceneProps} from '../film/types';

/**
 * Explainer: one spoken sentence per beat, one card that proves it.
 *
 * The headline is the VO line. Every word is laid out from the first frame but
 * only becomes visible when it is spoken, using the word timings compiled by
 * `make_timeline.py` (ElevenLabs timestamps when present, a measured-duration
 * character-weight estimate otherwise). Arabic is split on whitespace only —
 * never into letters — and the base direction is always RTL.
 *
 * The card is not decoration: it carries the concrete object the sentence names
 * (a checklist, a window, a counter, a comparison, a real image). Every string
 * comes from `beat.data.card`; this scene invents nothing.
 */

type WordTiming = {w: string; start: number; end: number};
type CardRow = string | {n?: string; title?: string; sub?: string};
type CardSide = {label?: string; rows?: string[]};
type Card = {
  type?: 'checklist' | 'counter' | 'window' | 'steps' | 'compare' | 'quote' | 'image' | 'statement' | 'none';
  title?: string;
  value?: string;
  label?: string;
  sub?: string;
  rows?: CardRow[];
  left?: CardSide;
  right?: CardSide;
  quote?: string;
  by?: string;
  src?: string;
  caption?: string;
};
type Data = {words?: WordTiming[]; keyword?: string; card?: Card; wordSource?: string};

const IVORY = '#F7FAFF';
const INK = '#122033';
const INK_SOFT = 'rgba(18,32,51,0.62)';
const HAIR = 'rgba(18,32,51,0.12)';

const norm = (s: string) => s.replace(/[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').replace(/[^\w\u0600-\u06FF]+/g, '');

const fallbackWords = (text: string, seconds: number): WordTiming[] => {
  const tokens = text.replace(/[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const weights = tokens.map((t) => Math.max(1, norm(t).length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0.12;
  const usable = Math.max(0.4, seconds - 0.4);
  return tokens.map((w, i) => {
    const span = usable * weights[i] / total;
    const out = {w, start: cursor, end: cursor + span};
    cursor += span;
    return out;
  });
};

const Check: React.FC<{color: string; size: number; delay: number; frame: number}> = ({color, size, delay, frame}) => {
  const p = tween(frame, delay, 12, E.outExpo);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        border: `1.5px solid ${color}`,
        display: 'grid',
        placeItems: 'center',
        opacity: p,
        transform: `scale(${0.6 + p * 0.4})`,
        flex: 'none',
      }}
    >
      <span
        style={{
          width: size * 0.34,
          height: size * 0.18,
          borderLeft: `${Math.max(1.5, size * 0.08)}px solid ${color}`,
          borderBottom: `${Math.max(1.5, size * 0.08)}px solid ${color}`,
          transform: 'rotate(-45deg) translateY(-1px)',
          opacity: p,
        }}
      />
    </span>
  );
};

const CardShell: React.FC<{
  children: React.ReactNode;
  frame: number;
  w: number;
  h: number;
  dark: boolean;
  accent: string;
}> = ({children, frame, w, h, dark, accent}) => {
  const e = entrance(frame, 10, {dist: 26, dur: 26, from: 0.975});
  const bar = tween(frame, 14, 40, E.outExpo);
  return (
    <div
      style={{
        ...entStyle(e),
        position: 'relative',
        width: w,
        height: h,
        borderRadius: w * 0.026,
        padding: w * 0.042,
        boxSizing: 'border-box',
        background: dark
          ? 'linear-gradient(155deg, rgba(20,36,58,0.94), rgba(7,16,30,0.96))'
          : 'linear-gradient(155deg, rgba(255,253,247,0.96), rgba(250,244,232,0.94))',
        border: `1px solid ${dark ? 'rgba(180,214,255,0.18)' : 'rgba(18,32,51,0.10)'}`,
        boxShadow: dark
          ? '0 40px 90px -46px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 34px 70px -42px rgba(62,40,18,0.38), inset 0 1px 0 rgba(255,255,255,0.8)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        direction: 'rtl',
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 0, height: 3, width: `${bar * 100}%`, background: accent, opacity: 0.9}} />
      {children}
    </div>
  );
};

const RowLine: React.FC<{
  text: string;
  frame: number;
  delay: number;
  size: number;
  color: string;
  accent: string;
  check?: boolean;
}> = ({text, frame, delay, size, color, accent, check = true}) => {
  const e = entrance(frame, delay, {dist: 10, dur: 18, blur: 4});
  return (
    <div style={{...entStyle(e), display: 'flex', alignItems: 'center', gap: size * 0.42, minHeight: size * 1.5}}>
      {check ? <Check color={accent} size={size * 0.82} delay={delay} frame={frame} /> : <span style={{width: size * 0.82, flex: 'none'}} />}
      <span style={{fontFamily: FONT.tajawal, fontSize: size, fontWeight: 500, color, lineHeight: 1.35, direction: 'rtl'}}>{text}</span>
    </div>
  );
};

const ExplainerCard: React.FC<{card: Card; frame: number; w: number; h: number; dark: boolean; accent: string; fps: number}> = ({
  card,
  frame,
  w,
  h,
  dark,
  accent,
  fps,
}) => {
  const type = card.type ?? 'statement';
  if (type === 'none') return null;
  const ink = dark ? IVORY : INK;
  const soft = dark ? 'rgba(220,236,255,0.62)' : INK_SOFT;
  const hair = dark ? 'rgba(180,214,255,0.14)' : HAIR;
  const base = Math.min(w, h * 1.9);
  const fs = base * 0.046;

  const body = (() => {
    if (type === 'checklist') {
      const rows = (card.rows ?? []).map((r) => (typeof r === 'string' ? r : r.title ?? ''));
      return (
        <>
          {card.title ? (
            <div style={{fontFamily: 'monospace', fontSize: fs * 0.78, letterSpacing: 1.2, color: accent, marginBottom: fs * 0.6}}>
              {card.title}
            </div>
          ) : null}
          <div style={{display: 'flex', flexDirection: 'column', gap: fs * 0.28}}>
            {rows.slice(0, 5).map((r, i) => (
              <RowLine key={`${r}-${i}`} text={r} frame={frame} delay={18 + i * 5} size={fs} color={ink} accent={accent} />
            ))}
          </div>
        </>
      );
    }
    if (type === 'window') {
      const rows = (card.rows ?? []).map((r) => (typeof r === 'string' ? r : r.title ?? ''));
      return (
        <>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, paddingBottom: fs * 0.5, borderBottom: `1px solid ${hair}`}}>
            {['#F27C6A', '#F2C14E', '#63C28B'].map((c) => (
              <span key={c} style={{width: fs * 0.36, height: fs * 0.36, borderRadius: 99, background: c, opacity: 0.9}} />
            ))}
            <span style={{fontFamily: 'monospace', fontSize: fs * 0.68, color: soft, marginInlineStart: fs * 0.4}}>{card.title ?? 'window'}</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: fs * 0.45, marginTop: fs * 0.6, direction: 'ltr'}}>
            {rows.slice(0, 5).map((r, i) => {
              const e = entrance(frame, 18 + i * 4, {dist: 8, dur: 16, blur: 3});
              return (
                <div key={`${r}-${i}`} style={{...entStyle(e), display: 'flex', alignItems: 'center', gap: fs * 0.5, fontFamily: 'monospace', fontSize: fs * 0.84, color: i === 0 ? accent : ink}}>
                  <span style={{color: soft, fontSize: fs * 0.7}}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{direction: 'ltr', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r}</span>
                  {i === 0 ? <span style={{width: fs * 0.4, height: fs * 0.9, background: accent, opacity: frame % 30 < 15 ? 0.9 : 0.2}} /> : null}
                </div>
              );
            })}
          </div>
        </>
      );
    }
    if (type === 'counter') {
      const raw = String(card.value ?? '0');
      const number = Number(raw.replace(/[^\d.-]/g, ''));
      const shown = Number.isFinite(number) ? String(countUp(frame, 16, 30, number)) : raw;
      return (
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', direction: 'rtl', textAlign: 'right'}}>
          <div style={{fontFamily: FONT.tajawal, fontSize: base * 0.17, fontWeight: 800, color: accent, lineHeight: 1, direction: 'ltr', textAlign: 'right'}}>{shown}</div>
          <div style={{fontFamily: FONT.tajawal, fontSize: fs * 1.1, fontWeight: 700, color: ink, marginTop: fs * 0.45}}>{card.label ?? ''}</div>
          {card.sub ? <div style={{fontFamily: FONT.tajawal, fontSize: fs * 0.82, color: soft, marginTop: fs * 0.25, lineHeight: 1.45}}>{card.sub}</div> : null}
        </div>
      );
    }
    if (type === 'steps') {
      const rows = (card.rows ?? []) as {n?: string; title?: string; sub?: string}[];
      return (
        <div style={{display: 'flex', flexDirection: 'column', gap: fs * 0.5}}>
          {rows.slice(0, 4).map((r, i) => {
            const e = entrance(frame, 18 + i * 6, {dist: 12, dur: 20});
            return (
              <div key={`${r.n}-${i}`} style={{...entStyle(e), display: 'flex', alignItems: 'center', gap: fs * 0.6}}>
                <span style={{width: fs * 1.55, height: fs * 1.55, borderRadius: fs * 0.42, background: `${accent}1F`, border: `1px solid ${accent}66`, display: 'grid', placeItems: 'center', fontFamily: 'monospace', fontSize: fs * 0.78, color: accent, flex: 'none'}}>
                  {r.n ?? String(i + 1).padStart(2, '0')}
                </span>
                <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                  <span style={{fontFamily: FONT.tajawal, fontSize: fs, fontWeight: 700, color: ink}}>{r.title ?? ''}</span>
                  {r.sub ? <span style={{fontFamily: 'monospace', fontSize: fs * 0.7, color: soft, direction: 'ltr'}}>{r.sub}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (type === 'compare') {
      const left = card.left ?? {};
      const right = card.right ?? {};
      return (
        <div style={{display: 'flex', gap: fs * 0.8, height: '100%'}}>
          {[
            {side: left, good: true},
            {side: right, good: false},
          ].map(({side, good}, col) => (
            <div key={good ? 'l' : 'r'} style={{flex: 1, display: 'flex', flexDirection: 'column', gap: fs * 0.35}}>
              <div style={{fontFamily: FONT.tajawal, fontSize: fs * 0.9, fontWeight: 700, color: good ? accent : soft, paddingBottom: fs * 0.3, borderBottom: `1px solid ${hair}`}}>
                {side.label ?? ''}
              </div>
              {(side.rows ?? []).slice(0, 4).map((r, i) => {
                const e = entrance(frame, 18 + col * 4 + i * 4, {dist: 8, dur: 16});
                return (
                  <div key={`${r}-${i}`} style={{...entStyle(e), display: 'flex', gap: fs * 0.35, alignItems: 'flex-start', fontFamily: FONT.tajawal, fontSize: fs * 0.82, color: good ? ink : soft, lineHeight: 1.4}}>
                    <span style={{color: good ? accent : soft, fontFamily: 'monospace'}}>{good ? '+' : '−'}</span>
                    <span>{r}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    if (type === 'quote') {
      return (
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%'}}>
          <div style={{fontFamily: FONT.tajawal, fontSize: fs * 1.3, fontWeight: 500, color: ink, lineHeight: 1.55, direction: 'rtl'}}>{card.quote ?? ''}</div>
          {card.by ? <div style={{fontFamily: FONT.tajawal, fontSize: fs * 0.78, color: soft, marginTop: fs * 0.6}}>— {card.by}</div> : null}
        </div>
      );
    }
    if (type === 'image') {
      return (
        <div style={{position: 'absolute', inset: 0}}>
          <Img src={staticFile(card.src ?? '')} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.02 + 0.04 * clamp(frame / 180)})`}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,8,16,0.05) 40%, rgba(4,8,16,0.82) 100%)'}} />
          {card.caption ? (
            <div style={{position: 'absolute', left: w * 0.05, right: w * 0.05, bottom: w * 0.045, fontFamily: FONT.tajawal, fontSize: fs * 0.85, color: IVORY, direction: 'rtl'}}>{card.caption}</div>
          ) : null}
        </div>
      );
    }
    // statement
    const isNumeric = /^[\d٠-٩.,$%−-]+$/.test(String(card.value ?? ''));
    return (
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', direction: 'rtl', textAlign: 'center'}}>
        <div style={{fontFamily: FONT.tajawal, fontSize: base * (isNumeric ? 0.24 : 0.15), fontWeight: 800, color: accent, lineHeight: 1.05, direction: 'rtl', textAlign: 'center'}}>{card.value ?? ''}</div>
        <div style={{fontFamily: FONT.tajawal, fontSize: fs * 1.1, fontWeight: 700, color: ink, marginTop: fs * 0.4, textAlign: 'center'}}>{card.label ?? ''}</div>
        {card.sub ? <div style={{fontFamily: FONT.tajawal, fontSize: fs * 0.82, color: soft, marginTop: fs * 0.25, lineHeight: 1.45, textAlign: 'center'}}>{card.sub}</div> : null}
      </div>
    );
  })();

  return (
    <CardShell frame={frame} w={w} h={h} dark={dark} accent={accent}>
      {type === 'image' ? body : <div style={{flex: 1, minHeight: 0}}>{body}</div>}
    </CardShell>
  );
};

export const Explainer: React.FC<SceneProps> = ({beat, motion = 1, preRoll = 0}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H, fps} = useVideoConfig();
  const portrait = H > W * 1.2;
  const square = !portrait && Math.abs(H - W) < 120;
  const dark = beat.tone === 'ink';
  const data = (beat.data ?? {}) as Data;
  const card = data.card ?? {type: 'none'};
  const accent = (data as {accent?: string}).accent ?? '#2F6BFF';
  const padX = portrait ? W * 0.085 : W * 0.09;
  const colW = portrait ? W - padX * 2 : Math.min(W * 0.68, 1180);
  const left = (W - colW) / 2;
  const top = portrait ? H * 0.115 : H * 0.10;
  const headlineSize = portrait ? W * 0.072 : square ? W * 0.064 : W * 0.052;
  const words = data.words?.length ? data.words : fallbackWords(beat.line1 ?? '', beat.dur / fps);
  const keyword = new Set((data.keyword ?? '').split(/\s+/).map(norm).filter(Boolean));
  const ink = dark ? IVORY : INK;
  const soft = dark ? 'rgba(220,236,255,0.6)' : INK_SOFT;
  const isStatement = card.type === 'statement';
  const cardTop = portrait ? H * 0.41 : H * 0.47;
  const cardH = portrait ? H * (isStatement ? 0.24 : 0.30) : H * (isStatement ? 0.24 : 0.29);
  const cardW = colW;
  const kicker = beat.kicker || 'EXPLAINER';

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Ground tone={dark ? 'ink' : 'paper'} variant={dark ? 'ink-aurora' : 'paper-glow'} grain={0.05} vignette={0.3} />
      <AbsoluteFill style={{background: `radial-gradient(52% 38% at 82% 8%, ${accent}22, transparent 70%), radial-gradient(46% 34% at 8% 92%, ${accent}14, transparent 72%)`}} />
      {dark ? <Bokeh count={6} opacity={0.18} /> : <Ruled gap={H * 0.028} color="rgba(18,32,51,0.055)" opacity={0.7} />}

      <div style={{position: 'absolute', left, top, width: colW, direction: 'rtl'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: W * 0.012, justifyContent: 'flex-start', opacity: tween(frame, 2, 18)}}>
          <span style={{width: W * 0.03, height: 2, background: accent, display: 'inline-block'}} />
          <span style={{fontFamily: 'monospace', fontSize: portrait ? W * 0.018 : W * 0.012, letterSpacing: 1.4, color: accent, direction: 'ltr'}}>{kicker}</span>
        </div>

        <div
          dir="rtl"
          lang="ar"
          style={{
            marginTop: H * 0.022,
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: headlineSize * 0.22,
            rowGap: headlineSize * 0.04,
            justifyContent: 'flex-start',
            fontFamily: FONT.tajawal,
            fontSize: headlineSize,
            fontWeight: 800,
            lineHeight: 1.38,
            color: ink,
          }}
        >
          {words.map((word, i) => {
            const start = Math.max(0, Math.round(word.start * fps) + preRoll);
            const p = tween(frame, start, Math.max(4, Math.round(fps * 0.18)), E.outExpo);
            const isKey = keyword.has(norm(word.w));
            return (
              <span
                key={`${word.w}-${i}`}
                style={{
                  display: 'inline-block',
                  opacity: p,
                  transform: `translate3d(0, ${((1 - p) * headlineSize * 0.22).toFixed(1)}px, 0)`,
                  filter: p < 0.99 ? `blur(${((1 - p) * 5).toFixed(2)}px)` : undefined,
                  color: isKey ? accent : ink,
                }}
              >
                {word.w}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{position: 'absolute', left, top: cardTop, width: cardW, height: cardH, transform: `translateY(${Math.sin(frame / 42) * 2 * motion}px)`}}>
        <ExplainerCard card={card} frame={frame} w={cardW} h={cardH} dark={dark} accent={accent} fps={fps} />
      </div>

      <div style={{position: 'absolute', left, width: colW, top: portrait ? H * 0.815 : H * 0.885, display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'ltr'}}>
        <span style={{fontFamily: 'monospace', fontSize: portrait ? W * 0.016 : W * 0.011, color: soft, letterSpacing: 1.2}}>
          AR · {portrait ? '9:16' : square ? '1:1' : '16:9'}
        </span>
        <span style={{display: 'flex', alignItems: 'center', gap: W * 0.008}}>
          <span style={{width: W * 0.006, height: W * 0.006, borderRadius: 99, background: accent}} />
          <span style={{fontFamily: 'monospace', fontSize: portrait ? W * 0.016 : W * 0.011, color: soft, letterSpacing: 1.2}}>EXPLAINER</span>
        </span>
      </div>
    </AbsoluteFill>
  );
};

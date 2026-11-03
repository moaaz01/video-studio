import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Ground} from '../components/Surfaces';
import {Ar} from '../components/Text';
import {Ico} from '../components/Ico';
import {FONT, C} from '../theme';
import {E, countUp, rnd, sp, SPRING, tween} from '../lib/anim';
import {toAr} from '../lib/rtl';
import type {SceneProps} from '../film/types';

/**
 * Gfx: motion graphics as data. A beat is a stack of layers (shapes, drawn paths,
 * Arabic type, icons, bar charts, counters, progress rings, connectors, images,
 * lower thirds), each with a position in 0–1 frame space, an entrance time in
 * seconds and an animation verb. `v` overrides position/size for vertical canvases,
 * so one layout serves 16:9 and 9:16 without guessing.
 *
 * Layers paint in order; later layers sit on top. Numbers render in Arabic-Indic
 * digits; text never splits below the word.
 */

type Anim = 'pop' | 'fade' | 'rise' | 'slide' | 'spin' | 'pulse' | 'draw' | 'none';
type Base = {
  at?: number; x?: number; y?: number; size?: number; color?: string; anim?: Anim; w?: number; h?: number;
  v?: {x?: number; y?: number; size?: number; w?: number; h?: number};
};
type Layer = Base & (
  | {type: 'shape'; shape?: 'circle' | 'rect' | 'ring' | 'blob' | 'triangle'; fill?: boolean}
  | {type: 'path'; d: string; width?: number; dur?: number}
  | {type: 'text'; text: string; weight?: number; align?: 'right' | 'center' | 'left'; w?: number}
  | {type: 'icon'; name: string}
  | {type: 'bars'; values: number[]; labels?: string[]; w?: number; h?: number; suffix?: string}
  | {type: 'counter'; from?: number; to: number; suffix?: string; dur?: number; label?: string}
  | {type: 'ring'; value: number; label?: string}
  | {type: 'connector'; to: [number, number]}
  | {type: 'image'; src: string; w?: number}
  | {type: 'lowerthird'; title: string; sub?: string}
);
type Data = {layers?: Layer[]; bg?: string; grid?: boolean};

const anchor = (x: number, y: number): React.CSSProperties => ({
  position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%,-50%)',
});

/** Entrance verbs -> a style for the layer wrapper. */
const enter = (anim: Anim, f: number, fps: number, startF: number): React.CSSProperties => {
  const k = anim === 'pop' ? sp(f, fps, startF, SPRING.pop) : tween(f, startF, 18);
  const visible = f >= startF;
  switch (anim) {
    case 'pop':
      return {opacity: visible ? Math.min(1, k * 2) : 0, scale: `${k}`};
    case 'rise':
      return {opacity: k, translate: `0 ${(1 - k) * 40}px`};
    case 'slide':
      return {opacity: k, translate: `${(1 - k) * -80}px 0`};
    case 'spin':
      return {opacity: k, rotate: `${(1 - k) * -120}deg`, scale: `${0.6 + 0.4 * k}`};
    case 'pulse':
      return {opacity: k, scale: `${1 + 0.04 * Math.sin((f - startF) / 6)}`};
    case 'none':
      return {opacity: visible ? 1 : 0};
    default:
      return {opacity: k};
  }
};

const BLOB = 'M50 4 C74 4 96 22 96 48 C96 76 74 96 48 96 C22 96 4 74 4 50 C4 26 26 4 50 4 Z';

type ViewProps = {l: Layer; i: number; f: number; fps: number; vertical: boolean; unit: number; dark: boolean; cw: number; ch: number};

const LayerView: React.FC<ViewProps> = ({l, i, f, fps, vertical, unit, dark, cw, ch}) => {
  const o = vertical && l.v ? {...l, ...l.v} : l;
  const x = o.x ?? 0.5;
  const y = o.y ?? 0.5;
  const size = (o.size ?? 0.2) * 1080 * unit;
  const color = l.color ?? (dark ? '#FFFFFF' : C.ink);
  const startF = Math.round((l.at ?? 0) * fps);
  const anim = l.anim ?? (l.type === 'path' || l.type === 'connector' ? 'draw' : 'pop');
  const wrap = (child: React.ReactNode, extra: React.CSSProperties = {}) => (
    <div style={{...anchor(x, y), ...enter(anim, f, fps, startF), ...extra}}>{child}</div>
  );

  switch (l.type) {
    case 'shape': {
      const fill = l.fill !== false ? color : 'none';
      const stroke = l.fill === false || l.shape === 'ring' ? color : 'none';
      const wob = 1 + 0.03 * Math.sin((f + i * 11) / 14);
      const body = {
        circle: <circle cx={50} cy={50} r={46} fill={fill} stroke={stroke} strokeWidth={4} />,
        ring: <circle cx={50} cy={50} r={44} fill="none" stroke={color} strokeWidth={6} />,
        rect: <rect x={4} y={4} width={92} height={92} rx={18} fill={fill} stroke={stroke} strokeWidth={4} />,
        triangle: <path d="M50 6 L94 90 L6 90 Z" fill={fill} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />,
        blob: <path d={BLOB} fill={fill} transform={`rotate(${(f + i * 40) * 0.6} 50 50) scale(${wob})`} style={{transformOrigin: '50px 50px'}} />,
      }[l.shape ?? 'circle'];
      return wrap(<svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>{body}</svg>);
    }
    case 'path': {
      const p = interpolate(f, [startF, startF + Math.round((l.dur ?? 1) * fps)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
      const ev = evolvePath(p, l.d);
      return (
        <div style={{...anchor(x, y), opacity: f >= startF ? 1 : 0}}>
          <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
            <path d={l.d} fill="none" stroke={color} strokeWidth={l.width ?? 4} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
          </svg>
        </div>
      );
    }
    case 'text':
      return wrap(
        <div style={{width: (o.w ?? 0.8) * cw}}>
          <Ar text={l.text} size={size / 4} weight={l.weight ?? 800} color={color} align={l.align ?? 'center'} lh={1.3} />
        </div>,
      );
    case 'icon':
      return wrap(<Ico name={l.name} size={size} color={color} />);
    case 'bars': {
      const w = (o.w ?? 0.5) * cw;
      const h = (o.h ?? 0.35) * ch;
      const max = Math.max(...l.values, 1);
      const gap = w * 0.06;
      const bw = (w - gap * (l.values.length - 1)) / l.values.length;
      return (
        <div style={{...anchor(x, y), width: w, height: h, display: 'flex', alignItems: 'flex-end', gap, direction: 'rtl'}}>
          {l.values.map((v, k) => {
            const g = sp(f, fps, startF + k * 5, SPRING.ui);
            return (
              <div key={k} style={{width: bw, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * unit}}>
                <div style={{fontFamily: FONT.tajawal, fontWeight: 800, fontSize: 30 * unit, color, opacity: g}}>
                  {toAr(Math.round(v * g))}{l.suffix ?? ''}
                </div>
                <div style={{width: '100%', height: (h * 0.78 * v) / max * g, borderRadius: 12 * unit,
                  background: k === l.values.length - 1 ? C.amber : color, opacity: k === l.values.length - 1 ? 1 : 0.85}} />
                {l.labels?.[k] ? <Ar text={l.labels[k]} size={32 * unit} weight={700} color={color} align="center" /> : null}
              </div>
            );
          })}
        </div>
      );
    }
    case 'counter': {
      const n = countUp(f, startF, Math.round((l.dur ?? 1.2) * fps), l.to, l.from ?? 0);
      return wrap(
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: FONT.tajawal, fontWeight: 900, fontSize: size / 2.2, color, lineHeight: 1}}>
            {toAr(n)}{l.suffix ?? ''}
          </div>
          {l.label ? <Ar text={l.label} size={size / 8} color={color} align="center" /> : null}
        </div>,
      );
    }
    case 'ring': {
      const p = interpolate(f, [startF, startF + fps], [0, Math.max(0, Math.min(1, l.value))], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.outExpo});
      const r = 42;
      const len = 2 * Math.PI * r;
      return wrap(
        <div style={{position: 'relative', width: size, height: size}}>
          <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={8} />
            <circle cx={50} cy={50} r={r} fill="none" stroke={C.amber} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={`${len * p} ${len}`} transform="rotate(-90 50 50)" />
          </svg>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT.tajawal, fontWeight: 900, fontSize: size / 4.5, color}}>
            {`${toAr(Math.round(p * 100))}٪`}
          </div>
        </div>,
        {opacity: f >= startF ? 1 : 0},
      );
    }
    case 'connector': {
      const [tx, ty] = l.to;
      const W = cw;
      const H = ch;
      const d = `M${x * W} ${y * H} C${((x + tx) / 2) * W} ${y * H} ${((x + tx) / 2) * W} ${ty * H} ${tx * W} ${ty * H}`;
      const p = interpolate(f, [startF, startF + 0.7 * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
      const ev = evolvePath(p, d);
      return (
        <svg style={{position: 'absolute', inset: 0, opacity: f >= startF ? 1 : 0}} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          <path d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
          <circle cx={tx * W} cy={ty * H} r={9} fill={C.amber} opacity={p > 0.98 ? 1 : 0} />
        </svg>
      );
    }
    case 'image':
      return wrap(<Img src={staticFile(l.src)} style={{width: (o.w ?? 0.3) * cw, borderRadius: 20 * unit, display: 'block'}} />);
    case 'lowerthird': {
      const k = tween(f, startF, 20);
      return (
        <div dir="rtl" style={{position: 'absolute', right: 80 * unit, bottom: (vertical ? 260 : 90) * unit, opacity: k,
          translate: `${(1 - k) * 60}px 0`, display: 'flex', alignItems: 'stretch', gap: 18 * unit}}>
          <div style={{width: 10 * unit, borderRadius: 6, background: C.amber, transform: `scaleY(${k})`}} />
          <div>
            <Ar text={l.title} size={46 * unit} weight={800} color={color} />
            {l.sub ? <Ar text={l.sub} size={30 * unit} color={color} style={{opacity: 0.75}} /> : null}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
};

export const Gfx: React.FC<SceneProps> = ({beat, vertical, preRoll = 0}) => {
  const f = useCurrentFrame() - preRoll;
  const {fps, width, height} = useVideoConfig();
  const d = (beat.data ?? {}) as Data;
  const unit = Math.min(width, height) / 1080;
  const dark = beat.tone !== 'paper';
  return (
    <AbsoluteFill style={d.bg ? {background: d.bg} : undefined}>
      {!d.bg && <Ground tone={beat.tone === 'emerald' ? 'emerald' : dark ? 'ink' : 'paper'} dots={d.grid} />}
      {d.grid && d.bg
        ? Array.from({length: 24}).map((_, k) => (
            <div key={k} style={{position: 'absolute', left: `${rnd(k, 3) * 100}%`, top: `${rnd(k, 7) * 100}%`, width: 4, height: 4,
              borderRadius: 9, background: dark ? '#fff' : C.ink, opacity: 0.12}} />
          ))
        : null}
      {(d.layers ?? []).map((l, i) => (
        <LayerView key={i} l={l} i={i} f={f} fps={fps} vertical={vertical} unit={unit} dark={dark} cw={width} ch={height} />
      ))}
    </AbsoluteFill>
  );
};

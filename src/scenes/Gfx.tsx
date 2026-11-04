import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Ground} from '../components/Surfaces';
import {Backdrop, type BackdropVariant} from '../components/Backdrop';
import {Badge, Donut, GlassCard, LineChart, Progress, type Kit} from '../components/GfxKit';
import {Ar} from '../components/Text';
import {Ico} from '../components/Ico';
import {FONT, C} from '../theme';
import {E, countUp, rnd, sp, SPRING, tween} from '../lib/anim';
import {toAr} from '../lib/rtl';
import {resolvePalette, type Palette} from '../look/palettes';
import type {SceneProps} from '../film/types';

/**
 * Gfx: motion graphics as data. A beat is a stack of layers on a moving
 * backdrop, painted in order. Every layer has a position in 0–1 frame space, an
 * entrance time (`at`, seconds; omitted = auto-stagger), an optional exit (`out`),
 * a depth (`z`, parallax against a slow drift) and an optional `glow`. `v`
 * overrides position/size for vertical canvases, so one layout serves 16:9 and
 * 9:16. `data.palette` names a palette from `look/palettes.ts`; every colour a
 * layer does not set comes from it.
 *
 * Numbers render in Arabic-Indic digits; text never splits below the word.
 */

type Anim = 'pop' | 'fade' | 'rise' | 'slide' | 'spin' | 'pulse' | 'draw' | 'none';
type TextFx = 'gradient' | 'outline' | 'marker';
type Base = {
  at?: number; out?: number; x?: number; y?: number; size?: number; color?: string; anim?: Anim; w?: number; h?: number;
  z?: number; glow?: boolean;
  v?: {x?: number; y?: number; size?: number; w?: number; h?: number; to?: [number, number]};
};
type Shape = 'circle' | 'rect' | 'ring' | 'blob' | 'triangle' | 'hexagon' | 'star' | 'pill' | 'arrow';
type Layer = Base & (
  | {type: 'shape'; shape?: Shape; fill?: boolean}
  | {type: 'path'; d: string; width?: number; dur?: number}
  | {type: 'text'; text: string; weight?: number; align?: 'right' | 'center' | 'left'; fx?: TextFx}
  | {type: 'icon'; name: string}
  | {type: 'bars'; values: number[]; labels?: string[]; suffix?: string; ltr?: boolean}
  | {type: 'counter'; from?: number; to: number; suffix?: string; dur?: number; label?: string}
  | {type: 'ring'; value: number; label?: string}
  | {type: 'connector'; to: [number, number]}
  | {type: 'image'; src: string}
  | {type: 'lowerthird'; title: string; sub?: string}
  | {type: 'card'; title: string; sub?: string; icon?: string}
  | {type: 'line'; values: number[]; labels?: string[]; suffix?: string}
  | {type: 'donut'; segments: {value: number; label?: string}[]; center?: string}
  | {type: 'progress'; value: number; label?: string}
  | {type: 'badge'; text: string; solid?: boolean}
);
type Data = {layers?: Layer[]; bg?: string; grid?: boolean; palette?: string; backdrop?: BackdropVariant; intensity?: number};

const STAGGER = 0.14;
const BLOB = 'M50 4 C74 4 96 22 96 48 C96 76 74 96 48 96 C22 96 4 74 4 50 C4 26 26 4 50 4 Z';
const SHAPES: Record<string, string> = {
  triangle: 'M50 6 L94 90 L6 90 Z',
  hexagon: 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z',
  star: 'M50 4 L61 38 L96 38 L68 59 L79 94 L50 73 L21 94 L32 59 L4 38 L39 38 Z',
  arrow: 'M96 50 L56 14 L56 36 L4 36 L4 64 L56 64 L56 86 Z',
};

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
      return {opacity: k, translate: `0 ${(1 - k) * 40}px`, filter: k < 0.98 ? `blur(${((1 - k) * 8).toFixed(2)}px)` : undefined};
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

type ViewProps = {l: Layer; i: number; f: number; fps: number; vertical: boolean; unit: number; pal: Palette; cw: number; ch: number; dur: number};

const LayerView: React.FC<ViewProps> = ({l, i, f, fps, vertical, unit, pal, cw, ch, dur}) => {
  const o = vertical && l.v ? {...l, ...l.v} : l;
  const x = o.x ?? 0.5;
  const y = o.y ?? 0.5;
  const size = (o.size ?? 0.2) * 1080 * unit;
  const color = l.color ?? pal.ink;
  const startF = Math.round((l.at ?? i * STAGGER) * fps);
  const anim = l.anim ?? (l.type === 'path' || l.type === 'connector' ? 'draw' : 'pop');
  const kit: Kit = {f, fps, startF, unit, ink: color, accent: pal.accent, accent2: pal.accent2, dark: pal.dark};
  // depth: deeper layers drift more and rise a little over the beat (cheap parallax)
  const z = l.z ?? 0;
  const drift: React.CSSProperties = z ? {translate: `${Math.sin(f / fps * 0.5 + i) * 14 * z}px ${(f / Math.max(1, dur)) * -18 * z}px`} : {};
  const outK = l.out != null
    ? interpolate(f, [l.out * fps, l.out * fps + 10], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  const glow: React.CSSProperties = l.glow ? {filter: `drop-shadow(0 0 22px ${pal.accent}AA)`} : {};
  const ent = enter(anim, f, fps, startF);
  /** `self`: the part animates its own entrance (kit parts); the wrapper only gates and exits. */
  const wrap = (child: React.ReactNode, self = false) => {
    const baseO = self ? (f >= startF ? 1 : 0) : ((ent.opacity as number | undefined) ?? 1);
    return (
      <div style={{...anchor(x, y), ...drift}}>
        <div style={{...(self ? {} : ent), ...glow, opacity: baseO * outK, scale: outK < 1 ? `${0.9 + 0.1 * outK}` : (self ? undefined : ent.scale)}}>
          {child}
        </div>
      </div>
    );
  };

  switch (l.type) {
    case 'shape': {
      const fill = l.fill !== false ? color : 'none';
      const stroke = l.fill === false || l.shape === 'ring' ? color : 'none';
      const wob = 1 + 0.03 * Math.sin((f + i * 11) / 14);
      const shape = l.shape ?? 'circle';
      const body =
        shape === 'circle' ? <circle cx={50} cy={50} r={46} fill={fill} stroke={stroke} strokeWidth={4} />
        : shape === 'ring' ? <circle cx={50} cy={50} r={44} fill="none" stroke={color} strokeWidth={6} />
        : shape === 'rect' ? <rect x={4} y={4} width={92} height={92} rx={18} fill={fill} stroke={stroke} strokeWidth={4} />
        : shape === 'pill' ? <rect x={4} y={30} width={92} height={40} rx={20} fill={fill} stroke={stroke} strokeWidth={4} />
        : shape === 'blob' ? <path d={BLOB} fill={fill} transform={`rotate(${(f + i * 40) * 0.6} 50 50) scale(${wob})`} style={{transformOrigin: '50px 50px'}} />
        : <path d={SHAPES[shape]} fill={fill} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />;
      return wrap(<svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>{body}</svg>);
    }
    case 'path': {
      const p = interpolate(f, [startF, startF + Math.round((l.dur ?? 1) * fps)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
      const ev = evolvePath(p, l.d);
      return wrap(
        <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
          <path d={l.d} fill="none" stroke={l.color ?? pal.accent} strokeWidth={l.width ?? 4} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
        </svg>,
        true,
      );
    }
    case 'text': {
      const fx = l.fx;
      const marker = fx === 'marker' ? tween(f, startF + 6, 16) : 0;
      const style: React.CSSProperties =
        fx === 'gradient' ? {backgroundImage: `linear-gradient(270deg, ${pal.accent}, ${pal.accent2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text'}
        : fx === 'outline' ? {WebkitTextStroke: `${3 * unit}px ${color}`}
        : {};
      return wrap(
        <div style={{position: 'relative', width: (o.w ?? 0.8) * cw}}>
          {fx === 'marker' ? (
            <div style={{position: 'absolute', left: '8%', right: '8%', top: '55%', height: '34%', background: pal.accent, opacity: 0.8,
              borderRadius: 10 * unit, transform: `scaleX(${marker})`, transformOrigin: 'right center'}} />
          ) : null}
          <div style={{position: 'relative'}}>
            <Ar text={l.text} size={size / 4} weight={l.weight ?? 800} color={fx === 'gradient' || fx === 'outline' ? 'transparent' : color}
              align={l.align ?? 'center'} lh={1.3} style={style} />
          </div>
        </div>,
      );
    }
    case 'icon':
      return wrap(<Ico name={l.name} size={size} color={l.color ?? pal.accent} />);
    case 'bars': {
      const w = (o.w ?? 0.5) * cw;
      const h = (o.h ?? 0.35) * ch;
      const max = Math.max(...l.values, 1);
      const gap = w * 0.06;
      const bw = (w - gap * (l.values.length - 1)) / l.values.length;
      return (
        <div style={{...anchor(x, y), ...drift, opacity: outK, width: w, height: h, display: 'flex', alignItems: 'flex-end', gap, direction: l.ltr ? 'ltr' : 'rtl'}}>
          {l.values.map((val, k) => {
            const g = sp(f, fps, startF + k * 5, SPRING.ui);
            const hot = k === l.values.length - 1;
            return (
              <div key={k} style={{width: bw, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * unit}}>
                <div style={{fontFamily: FONT.tajawal, fontWeight: 800, fontSize: 32 * unit, color: hot ? pal.accent : color, opacity: g}}>
                  {toAr(Math.round(val * g))}{l.suffix ?? ''}
                </div>
                <div style={{width: '100%', height: (h * 0.78 * val) / max * g, borderRadius: 14 * unit,
                  background: hot ? `linear-gradient(180deg, ${pal.accent}, ${pal.accent}99)` : `linear-gradient(180deg, ${color}55, ${color}22)`,
                  boxShadow: hot ? `0 0 34px ${pal.accent}77` : undefined, border: hot ? undefined : `1px solid ${color}33`}} />
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
          <div style={{fontFamily: FONT.tajawal, fontWeight: 900, fontSize: size / 2.2, color: l.color ?? pal.accent, lineHeight: 1}}>
            {toAr(n)}{l.suffix ?? ''}
          </div>
          {l.label ? <Ar text={l.label} size={size / 8} color={pal.ink} align="center" /> : null}
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
            <circle cx={50} cy={50} r={r} fill="none" stroke={pal.accent} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={`${len * p} ${len}`} transform="rotate(-90 50 50)" />
          </svg>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT.tajawal, fontWeight: 900, fontSize: size / 4.5, color}}>
            {`${toAr(Math.round(p * 100))}%`}
          </div>
        </div>,
        true,
      );
    }
    case 'connector': {
      const [tx, ty] = (o as {to?: [number, number]}).to ?? l.to;
      const d = `M${x * cw} ${y * ch} C${((x + tx) / 2) * cw} ${y * ch} ${((x + tx) / 2) * cw} ${ty * ch} ${tx * cw} ${ty * ch}`;
      const p = interpolate(f, [startF, startF + 0.7 * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
      const ev = evolvePath(p, d);
      const stroke = l.color ?? pal.accent;
      return (
        <svg style={{position: 'absolute', inset: 0, opacity: (f >= startF ? 1 : 0) * outK}} viewBox={`0 0 ${cw} ${ch}`} width="100%" height="100%">
          <path d={d} fill="none" stroke={stroke} strokeWidth={4} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
          <circle cx={tx * cw} cy={ty * ch} r={9} fill={stroke} opacity={p > 0.98 ? 1 : 0} />
        </svg>
      );
    }
    case 'image':
      return wrap(<Img src={staticFile(l.src)} style={{width: (o.w ?? 0.3) * cw, borderRadius: 24 * unit, display: 'block',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)'}} />);
    case 'card':
      return wrap(<GlassCard {...kit} title={l.title} sub={l.sub} icon={l.icon} width={(o.w ?? 0.4) * cw} />, true);
    case 'line':
      return wrap(<LineChart {...kit} values={l.values} labels={l.labels} suffix={l.suffix} w={(o.w ?? 0.6) * cw} h={(o.h ?? 0.4) * ch} />, true);
    case 'donut':
      return wrap(<Donut {...kit} segments={l.segments} center={l.center} size={size} />, true);
    case 'progress':
      return wrap(<Progress {...kit} value={l.value} label={l.label} w={(o.w ?? 0.6) * cw} />, true);
    case 'badge':
      return wrap(<Badge {...kit} text={l.text} solid={l.solid} />, true);
    case 'lowerthird': {
      const k = tween(f, startF, 20);
      return (
        <div dir="rtl" style={{position: 'absolute', right: 80 * unit, bottom: (vertical ? 260 : 90) * unit, opacity: k * outK,
          translate: `${(1 - k) * 60}px 0`, display: 'flex', alignItems: 'stretch', gap: 18 * unit}}>
          <div style={{width: 10 * unit, borderRadius: 6, background: pal.accent, transform: `scaleY(${k})`}} />
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

/** Beats without a palette keep their tone ground and the studio's amber accent. */
const legacyPalette = (tone: string): Palette =>
  tone === 'paper'
    ? {bg: C.paper, bg2: C.paperSunken, ink: C.ink, accent: C.amber, accent2: C.emerald, dark: false}
    : {bg: C.inkBg, bg2: C.inkSurfaceHi, ink: '#FFFFFF', accent: C.amber, accent2: C.emerald, dark: true};

export const Gfx: React.FC<SceneProps> = ({beat, vertical, preRoll = 0}) => {
  const f = useCurrentFrame() - preRoll;
  const {fps, width, height} = useVideoConfig();
  const d = (beat.data ?? {}) as Data;
  const unit = Math.min(width, height) / 1080;
  const named = resolvePalette(d.palette);
  const pal = named ?? legacyPalette(beat.tone);
  return (
    <AbsoluteFill style={d.bg ? {background: d.bg} : undefined}>
      {named || d.backdrop ? (
        <Backdrop variant={d.backdrop ?? 'mesh'} palette={pal} intensity={d.intensity} />
      ) : !d.bg ? (
        <Ground tone={beat.tone === 'emerald' ? 'emerald' : pal.dark ? 'ink' : 'paper'} dots={d.grid} />
      ) : null}
      {d.grid && d.bg
        ? Array.from({length: 24}).map((_, k) => (
            <div key={k} style={{position: 'absolute', left: `${rnd(k, 3) * 100}%`, top: `${rnd(k, 7) * 100}%`, width: 4, height: 4,
              borderRadius: 9, background: pal.ink, opacity: 0.12}} />
          ))
        : null}
      {(d.layers ?? []).map((l, i) => (
        <LayerView key={i} l={l} i={i} f={f} fps={fps} vertical={vertical} unit={unit} pal={pal} cw={width} ch={height} dur={beat.dur} />
      ))}
    </AbsoluteFill>
  );
};

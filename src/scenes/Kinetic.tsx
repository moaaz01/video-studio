import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Grain, Vignette} from '../components/Surfaces';
import {FONT} from '../theme';
import {clamp, E, tween} from '../lib/anim';
import type {SceneProps} from '../film/types';

/**
 * Kinetic: a beat-grid film, one idea per shot, words as the only object.
 *
 * Arabic-first adaptation of the kinetic-film grammar: cuts land on the beat,
 * grounds flip on phrase changes, and Arabic is animated by word or phrase —
 * never letter by letter. A shot can also be a real picture (`style: "image"`)
 * or the end card (`style: "logo"`).
 *
 * Two renderer constraints shaped this file:
 *   1. Chromium mis-shapes Arabic when a frame contains several large text
 *      nodes, any <tspan>, or any geometric transform on the text. So the film
 *      draws ONE direct SVG <text> per frame and animates its x / y / font-size /
 *      opacity — never a transform.
 *   2. The global Camera / BeatShell transforms every scene; kinetic beats skip
 *      that shell in `Film.tsx` and animate only their background here. The type
 *      therefore stays outside every transform and every join stays intact.
 *
 * Data (compiled by `make_timeline.py`):
 *   data.shots[]  {at, style, text, ground, color, fx, cue, in, src, ...}
 *   data.palette  {bg, paper, accent, hot, ink}
 *   data.logo     {wordmark, tagline, small, url}
 *   data.bpm      the tempo the `at` values are measured in
 */

type Palette = {bg: string; paper: string; accent: string; hot: string; ink: string};
type Shot = {
  at: number;
  style?: 'slam' | 'stack' | 'split' | 'pair' | 'cut' | 'punch' | 'image' | 'logo';
  text?: string | string[];
  ground?: string;
  color?: string;
  fx?: 'hit' | 'punch' | 'beat' | 'none';
  in?: 'cut' | 'whipX' | 'whipY';
  rot?: number;
  size?: number;
  second?: number;
  src?: string;
  tint?: number;
  cue?: string;
};
type Logo = {wordmark?: string; tagline?: string; small?: string; url?: string};
type Data = {shots?: Shot[]; palette?: Palette; logo?: Logo; bpm?: number; charge?: boolean};

const DEFAULT_PALETTE: Palette = {bg: '#050B18', paper: '#F3F7FF', accent: '#F2A93B', hot: '#2F6BFF', ink: '#071225'};
const ARABIC = /[\u0600-\u06FF]/;
const isArabic = (s: string) => ARABIC.test(s);
const dirOf = (s: string) => (isArabic(s) ? 'rtl' : 'ltr');

const colorOf = (name: string | undefined, p: Palette): string | undefined => {
  if (!name) return undefined;
  if (name in p) return p[name as keyof Palette];
  return name;
};

const typeOn = (ground: string | undefined, p: Palette): string => {
  if (!ground) return p.paper;
  if (ground === 'paper' || ground === 'accent') return p.ink;
  if (ground === 'hot') return p.paper;
  return p.paper;
};

const groundOf = (name: string | undefined, p: Palette): string => {
  if (!name) return p.bg;
  if (name === 'bg') return p.bg;
  if (name === 'paper') return p.paper;
  if (name === 'accent') return p.accent;
  if (name === 'hot') return p.hot;
  if (name === 'ink') return p.ink;
  return name;
};

const fit = (text: string, base: number, maxWidth: number): number => {
  const units = Math.max(1, [...text].length);
  return Math.max(base * 0.32, Math.min(base, maxWidth / (units * 0.54)));
};

/** A ray burst built from one conic gradient; deterministic and cheap. */
const Rays: React.FC<{color: string; opacity: number; rotate: number}> = ({color, opacity, rotate}) => (
  <div
    style={{
      position: 'absolute',
      inset: '-30%',
      background: `repeating-conic-gradient(from ${rotate}deg, ${color} 0deg 0.5deg, transparent 0.5deg 7deg)`,
      opacity,
      maskImage: 'radial-gradient(circle, transparent 12%, #000 48%, transparent 74%)',
      WebkitMaskImage: 'radial-gradient(circle, transparent 12%, #000 48%, transparent 74%)',
      pointerEvents: 'none',
    }}
  />
);

const Ring: React.FC<{color: string; t: number; at: number; size: number}> = ({color, t, at, size}) => {
  const p = clamp((t - at) / 0.55);
  if (p <= 0 || p >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        opacity: (1 - p) * 0.7,
        transform: `scale(${0.2 + p * 1.15})`,
      }}
    />
  );
};

const Flash: React.FC<{color: string; t: number; at: number; peak?: number}> = ({color, t, at, peak = 0.35}) => {
  const d = t - at;
  if (d < 0 || d > 0.22) return null;
  return <AbsoluteFill style={{background: color, opacity: Math.max(0, 1 - d / 0.22) * peak, mixBlendMode: 'screen'}} />;
};

/** One direct SVG text node. No g, no tspan, no transform: only attributes. */
const Line: React.FC<{
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  W: number;
  H: number;
  maxWidth: number;
  opacity?: number;
}> = ({text, x, y, size, color, W, H, maxWidth, opacity = 1}) => (
  <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      direction={dirOf(text)}
      fontFamily={FONT.tajawal}
      fontSize={fit(text, size, maxWidth)}
      fontWeight={800}
      fill={color}
      opacity={opacity}
      style={{letterSpacing: 0}}
    >
      {text}
    </text>
  </svg>
);

const ShotLayer: React.FC<{
  shot: Shot;
  t: number;
  local: number;
  p: Palette;
  W: number;
  H: number;
  fps: number;
  bpm: number;
  shotSpan: number;
  logo?: Logo;
  enter: number;
  exit: number;
  groundOnly?: boolean;
}> = ({shot, t, local, p, W, H, fps, bpm, shotSpan, logo, enter, exit, groundOnly = false}) => {
  const style = shot.style ?? 'slam';
  const ground = groundOf(shot.ground, p);
  const typeColor = colorOf(shot.color, p) ?? typeOn(shot.ground, p);
  const accentText = shot.ground === 'accent' || shot.ground === 'paper' ? p.ink : p.accent;
  const base = H > W * 1.2 ? W * 0.34 : W > H * 1.2 ? Math.min(W * 0.205, H * 0.34) : W * 0.30;
  const textLines = Array.isArray(shot.text) ? shot.text : shot.text ? [shot.text] : [];
  const long = textLines.join(' ');
  const size = shot.size ? Math.min(shot.size, base) : fit(long, base, W * 0.86);
  const shotStart = (shot.at * 60) / bpm;
  const secondAt = shotStart + (shot.second ?? 0.4) * 60 / bpm;
  const u = clamp(local / Math.max(0.001, 0.55));
  const hit = shot.fx ?? 'hit';
  const shakeAt = shotStart + (style === 'stack' || style === 'split' || style === 'pair' ? 30 / bpm : 0);
  const shake = t >= shakeAt && t < shakeAt + 0.4 ? Math.exp(-(t - shakeAt) * 10) * (hit === 'punch' ? 14 : 8) : 0;

  const enterXf = () => {
    if (!shot.in || shot.in === 'cut') return {x: 0, y: 0, skew: 0, blur: 0};
    const k = 1 - E.outExpo(clamp(enter));
    if (shot.in === 'whipX') return {x: -W * 0.6 * k, y: 0, skew: 10 * k, blur: 12 * k};
    return {x: 0, y: -H * 0.5 * k, skew: 0, blur: 12 * k};
  };
  const exitXf = () => {
    const k = E.inExpo(clamp(exit));
    return {x: -W * 0.45 * k, y: 0, skew: -8 * k, blur: 10 * k};
  };
  const xf = exit > 0 && exit < 1 ? exitXf() : enterXf();
  const bgStyle = {
    position: 'absolute' as const,
    inset: 0,
    background: ground,
    overflow: 'hidden',
    transform: `translate3d(${xf.x + Math.sin(t * 61) * shake}px, ${xf.y + Math.cos(t * 47) * shake * 0.6}px, 0) skewX(${xf.skew}deg)`,
    filter: xf.blur > 0.2 ? `blur(${xf.blur}px)` : undefined,
  };

  const bgLayer = (
    <AbsoluteFill style={bgStyle}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(46% 46% at ${50 + 18 * Math.sin(t * 1.7)}% ${50 + 12 * Math.cos(t * 1.3)}%, ${p.accent}33, transparent 72%)`,
          opacity: 0.55,
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, top: `${(t * 35) % 110}%`, height: 1, background: p.paper, opacity: 0.07}} />
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background: `linear-gradient(${105 + 12 * Math.sin(t * 0.9)}deg, transparent 32%, ${p.accent}2E 46%, transparent 60%)`,
          transform: `translateX(${Math.sin(t * 1.2) * W * 0.18}px)`,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );

  if (groundOnly) {
    return bgLayer;
  }

  if (style === 'image') {
    const lineIndex = t >= shotStart + 0.45 ? 1 : 0;
    return (
      <>
        <AbsoluteFill style={bgStyle}>
          <Img
            src={staticFile(shot.src ?? '')}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${1.06 + 0.06 * u}) translate(${Math.sin(u * 2.4) * 1.2}%, ${Math.cos(u * 1.8) * 1.2}%)`,
            }}
          />
          <AbsoluteFill style={{background: `rgba(3,8,16,${shot.tint ?? 0.34})`}} />
          <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 35%, rgba(3,8,16,0.72) 100%)'}} />
          <AbsoluteFill style={{background: `radial-gradient(40% 40% at ${50 + 18 * Math.sin(t * 1.7)}% ${50 + 12 * Math.cos(t * 1.3)}%, ${p.accent}22, transparent 72%)`, opacity: 0.5}} />
        </AbsoluteFill>
        {textLines.length ? (
          <Line
            text={textLines[lineIndex] ?? textLines[0]}
            x={W / 2}
            y={H * 0.82}
            size={base * 0.78}
            color={lineIndex === 0 ? p.paper : p.accent}
            W={W}
            H={H}
            maxWidth={W * 0.84}
            opacity={tween(t * fps, (shotStart + 0.12 + lineIndex * 0.33) * fps, Math.round(fps * 0.2), E.outExpo)}
          />
        ) : null}
      </>
    );
  }

  if (style === 'logo') {
    const word = logo?.wordmark ?? 'VIDEO STUDIO';
    const line = tween(t * fps, shotStart * fps + 4, 22, E.outExpo);
    return (
      <>
        {bgLayer}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column'}}>
          <div style={{width: W * 0.14, height: 2, background: p.accent, transform: `scaleX(${line})`, opacity: line, marginBottom: H * 0.035}} />
          <div dir={dirOf(word)} style={{fontFamily: FONT.tajawal, fontSize: fit(word, W * 0.105, W * 0.86), fontWeight: 800, color: p.paper, lineHeight: 1.05, letterSpacing: 0, textAlign: 'center'}}>{word}</div>
          {logo?.tagline ? (
            <div dir={dirOf(logo.tagline)} style={{fontFamily: FONT.tajawal, fontSize: W * 0.026, fontWeight: 500, color: p.accent, marginTop: H * 0.022, opacity: tween(t * fps, shotStart * fps + 10, 22)}}>{logo.tagline}</div>
          ) : null}
          {logo?.small ? (
            <div style={{fontFamily: 'monospace', fontSize: W * 0.013, color: 'rgba(243,247,255,0.62)', marginTop: H * 0.02, letterSpacing: 1.5, opacity: tween(t * fps, shotStart * fps + 16, 22)}}>{logo.small}</div>
          ) : null}
          {logo?.url ? (
            <div dir="ltr" style={{fontFamily: 'monospace', fontSize: W * 0.015, color: p.paper, marginTop: H * 0.035, padding: `${H * 0.012}px ${W * 0.02}px`, border: '1px solid rgba(243,247,255,0.22)', borderRadius: 999, opacity: tween(t * fps, shotStart * fps + 22, 22)}}>{logo.url}</div>
          ) : null}
        </AbsoluteFill>
      </>
    );
  }

  const secondP = style === 'stack' || style === 'split' || style === 'pair' ? tween(t * fps, secondAt * fps, Math.max(4, Math.round(fps * 0.2)), E.outExpo) : 1;
  const slamP = E.outExpo(clamp(local / 0.28));
  const cutP = E.outExpo(clamp(local / 0.14));
  const yMid = H / 2;

  let text = long;
  let x = W / 2;
  let y = yMid;
  let textSize = size;
  let color = typeColor;
  let opacity = 1;

  if (style === 'slam') {
    textSize = size * (1.28 - 0.28 * slamP);
    opacity = clamp(local / 0.08);
  } else if (style === 'punch') {
    textSize = size * (1.5 - 0.5 * E.outExpo(clamp(local / 0.3)));
    opacity = clamp(local / 0.06);
  } else if (style === 'stack') {
    const second = t >= secondAt;
    text = second ? textLines[1] ?? '' : textLines[0] ?? '';
    y = second ? H * 0.57 : H * 0.39;
    textSize = second ? size * (1.6 - 0.6 * secondP) : size * 0.4;
  } else if (style === 'split') {
    const second = t >= secondAt;
    text = second ? textLines[1] ?? '' : textLines[0] ?? '';
    y = second ? H * 0.57 : H * 0.36;
    textSize = second ? size * (1.25 - 0.25 * secondP) : size * 0.4;
    color = second ? accentText : typeColor;
    x = second ? W / 2 + (1 - secondP) * W * 0.22 : W / 2;
  } else if (style === 'pair') {
    const second = t >= secondAt;
    text = second ? textLines[1] ?? '' : textLines[0] ?? '';
    y = second ? H * 0.60 : H * 0.42;
    textSize = size * 0.72;
    color = second ? accentText : typeColor;
    x = second ? W / 2 + (1 - secondP) * W * 0.18 : W / 2 - (1 - E.outExpo(clamp(local / 0.2))) * W * 0.18;
  } else if (style === 'cut') {
    textSize = size * (1.25 - 0.25 * cutP);
    opacity = clamp(local / 0.06);
  }

  // a small positional echo of the camera move; never a transform on the type
  x += xf.x * 0.18 + Math.sin(t * 61) * shake * 0.3 + 18 * Math.sin(t * 1.9);
  y += 10 * Math.cos(t * 1.4);
  // keep the type alive inside the shot: a 3.5 % grow over the shot, by font-size
  // (not transform), so the glyphs keep their joins.
  textSize *= 1 + 0.035 * clamp(local / Math.max(0.1, shotSpan));

  return (
    <>
      {bgLayer}
      <Line text={text} x={x} y={y} size={textSize} color={color} W={W} H={H} maxWidth={W * 0.9} opacity={opacity} />
      {style === 'stack' && t >= secondAt ? (
        <div style={{position: 'absolute', left: '50%', top: '68%', width: `${Math.min(92, 90 * secondP)}%`, height: 8, background: p.accent, transform: 'translateX(-50%)', opacity: secondP}} />
      ) : null}
      {hit === 'hit' || hit === 'punch' ? <Flash color={p.paper} t={t} at={shotStart} peak={hit === 'punch' ? 0.45 : 0.28} /> : null}
      {hit === 'punch' ? <Ring color={p.accent} t={t} at={shotStart + 0.02} size={Math.min(W, H) * 0.8} /> : null}
      {hit === 'punch' ? <Rays color={`${p.accent}44`} opacity={0.35 * (1 - clamp(local / 0.6))} rotate={0} /> : null}
    </>
  );
};

export const Kinetic: React.FC<SceneProps> = ({beat}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H, fps} = useVideoConfig();
  const data = (beat.data ?? {}) as Data;
  const p = data.palette ?? DEFAULT_PALETTE;
  const bpm = data.bpm ?? 160;
  const shots = data.shots ?? [];
  const seconds = frame / fps;
  const beatSeconds = beat.dur / fps;
  const shotStart = (s: Shot) => (s.at * 60) / bpm;
  const active = shots.findIndex((s, i) => {
    const next = shots[i + 1];
    return seconds >= shotStart(s) && (!next || seconds < shotStart(next));
  });
  const index = active >= 0 ? active : 0;
  const shot = shots[index];
  const prev = index > 0 ? shots[index - 1] : undefined;
  const next = shots[index + 1];
  const start = shot ? shotStart(shot) : 0;
  const nextStart = next ? shotStart(next) : beatSeconds;
  const local = Math.max(0, seconds - start);
  const shotSpan = Math.max(0.1, nextStart - start);
  const enter = shot?.in && shot.in !== 'cut' ? clamp(local / 0.18) : 1;
  const exit = next ? clamp((seconds - (nextStart - 0.18)) / 0.18) : 0;
  const charge = data.charge && seconds < 0.35 && index === 0;

  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      {charge ? (
        <AbsoluteFill style={{background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Rays color={`${p.accent}66`} opacity={0.7 * clamp(seconds / 0.35)} rotate={seconds * 200} />
          <div style={{width: 12 + 18 * clamp(seconds / 0.35), height: 12 + 18 * clamp(seconds / 0.35), borderRadius: 99, background: p.accent, boxShadow: `0 0 60px ${p.accent}`}} />
        </AbsoluteFill>
      ) : null}

      {prev && exit < 1 ? (
        <ShotLayer shot={prev} t={seconds} local={local + 0.2} p={p} W={W} H={H} fps={fps} bpm={bpm} shotSpan={shotSpan} logo={data.logo} enter={1} exit={exit} groundOnly />
      ) : null}
      {shot ? (
        <ShotLayer shot={shot} t={seconds} local={local} p={p} W={W} H={H} fps={fps} bpm={bpm} shotSpan={shotSpan} logo={data.logo} enter={enter} exit={0} />
      ) : null}

      <Grain opacity={0.055} />
      <Vignette strength={0.36} />

      {shot?.style !== 'logo' ? (
        <div style={{position: 'absolute', left: W * 0.035, bottom: H * 0.035, fontFamily: 'monospace', fontSize: W * 0.009, letterSpacing: 1.6, color: p.paper, opacity: 0.35, direction: 'ltr'}}>
          {String(index + 1).padStart(2, '0')} / {String(shots.length).padStart(2, '0')}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

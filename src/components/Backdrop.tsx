import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {noise3D} from '@remotion/noise';
import {Grain, Vignette} from './Surfaces';
import type {Palette} from '../look/palettes';

/**
 * Backdrop: a moving ground for motion graphics, driven by one palette.
 *
 * The ground is never a flat fill: something always breathes (light drifting,
 * a grid travelling, particles on a noise field), slowly enough that the content
 * stays the subject. Every variant is deterministic per frame and paints with
 * the palette's bg/bg2/accent only, under a shared grain + vignette so all
 * variants sit in one photographic space.
 */

export type BackdropVariant = 'mesh' | 'grid' | 'flow' | 'topo' | 'dots' | 'beams' | 'solid';

type Props = {variant?: BackdropVariant; palette: Palette; intensity?: number};

const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const Mesh: React.FC<{p: Palette; t: number; k: number}> = ({p, t, k}) => {
  const blobs = [
    {c: p.bg2, x: 30 + 12 * Math.sin(t * 0.21), y: 28 + 10 * Math.cos(t * 0.17), r: 70},
    {c: alpha(p.accent, 0.28 * k), x: 72 + 10 * Math.cos(t * 0.19), y: 70 + 8 * Math.sin(t * 0.23), r: 55},
    {c: alpha(p.accent2, 0.18 * k), x: 20 + 8 * Math.sin(t * 0.13 + 2), y: 82 + 6 * Math.cos(t * 0.15), r: 45},
  ];
  return (
    <AbsoluteFill
      style={{
        background: [...blobs.map((b) => `radial-gradient(circle at ${b.x}% ${b.y}%, ${b.c} 0%, transparent ${b.r}%)`), p.bg].join(','),
      }}
    />
  );
};

const GridFloor: React.FC<{p: Palette; t: number; k: number; h: number}> = ({p, t, k, h}) => {
  const cell = 90;
  const line = alpha(p.accent, 0.22 * k);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${p.bg} 0%, ${p.bg2} 100%)`, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: '-50%', right: '-50%', top: '52%', height: h * 1.2, transformOrigin: 'top center',
        transform: 'perspective(700px) rotateX(62deg)',
        backgroundImage: `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`,
        backgroundSize: `${cell}px ${cell}px`, backgroundPosition: `0 ${(t * 40) % cell}px`,
        maskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 100%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: '44%', height: '16%',
        background: `radial-gradient(ellipse at 50% 60%, ${alpha(p.accent, 0.35 * k)} 0%, transparent 70%)`}} />
    </AbsoluteFill>
  );
};

const Flow: React.FC<{p: Palette; t: number; k: number; w: number; h: number}> = ({p, t, k, w, h}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, ${p.bg2} 0%, ${p.bg} 75%)`}}>
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      {Array.from({length: 70}).map((_, i) => {
        const x = ((i * 137.5) % 100) / 100 * w + noise3D('fx', i * 0.3, 0, t * 0.08) * 120;
        const y = (((i * 61.8) % 100) / 100 * h + t * (12 + (i % 5) * 6)) % h;
        const r = 1.5 + (i % 4);
        const o = (0.25 + 0.35 * (noise3D('fo', i, t * 0.2, 0) + 1) / 2) * k;
        return <circle key={i} cx={x} cy={h - y} r={r} fill={i % 9 === 0 ? p.accent2 : p.accent} opacity={o} />;
      })}
    </svg>
  </AbsoluteFill>
);

const Topo: React.FC<{p: Palette; t: number; k: number; w: number; h: number}> = ({p, t, k, w, h}) => (
  <AbsoluteFill style={{background: p.bg}}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width={w} height={h} style={{position: 'absolute', inset: 0}}>
      {Array.from({length: 14}).map((_, i) => {
        const wob = 1 + 0.04 * Math.sin(t * 0.4 + i * 0.7);
        return (
          <ellipse key={i} cx={62} cy={42} rx={(6 + i * 6) * wob} ry={(4 + i * 4.2) / wob} fill="none"
            stroke={i % 4 === 0 ? p.accent : p.bg2} strokeWidth={i % 4 === 0 ? 0.25 : 0.35} opacity={0.9 * k}
            transform={`rotate(${t * 2 + i * 3} 62 42)`} />
        );
      })}
    </svg>
  </AbsoluteFill>
);

const DotMatrix: React.FC<{p: Palette; t: number; k: number; w: number; h: number}> = ({p, t, k, w, h}) => {
  const gap = 44;
  const cols = Math.ceil(w / gap) + 1;
  const rows = Math.ceil(h / gap) + 1;
  return (
    <AbsoluteFill style={{background: p.bg}}>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: cols * rows}).map((_, i) => {
          const cx = (i % cols) * gap;
          const cy = Math.floor(i / cols) * gap;
          const d = Math.hypot(cx - w * 0.5, cy - h * 0.45) / gap;
          const wave = (Math.sin(d * 0.6 - t * 2.2) + 1) / 2;
          return <circle key={i} cx={cx} cy={cy} r={1.6 + wave * 2.2} fill={wave > 0.8 ? p.accent : p.bg2} opacity={(0.35 + 0.65 * wave) * k} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

const Beams: React.FC<{p: Palette; t: number; k: number}> = ({p, t, k}) => (
  <AbsoluteFill style={{background: `linear-gradient(160deg, ${p.bg} 0%, ${p.bg2} 100%)`, overflow: 'hidden'}}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{position: 'absolute', top: '-40%', bottom: '-40%', width: '18%',
        left: `${((t * 6 + i * 37) % 140) - 20}%`, transform: 'rotate(22deg)',
        background: `linear-gradient(90deg, transparent, ${alpha(i === 1 ? p.accent2 : p.accent, 0.12 * k)}, transparent)`}} />
    ))}
  </AbsoluteFill>
);

export const Backdrop: React.FC<Props> = ({variant = 'mesh', palette, intensity = 1}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const k = Math.max(0, Math.min(1.5, intensity));
  const body = {
    mesh: <Mesh p={palette} t={t} k={k} />,
    grid: <GridFloor p={palette} t={t} k={k} h={height} />,
    flow: <Flow p={palette} t={t} k={k} w={width} h={height} />,
    topo: <Topo p={palette} t={t} k={k} w={width} h={height} />,
    dots: <DotMatrix p={palette} t={t} k={k} w={width} h={height} />,
    beams: <Beams p={palette} t={t} k={k} />,
    solid: <AbsoluteFill style={{background: palette.bg}} />,
  }[variant];
  return (
    <AbsoluteFill>
      {body}
      <Vignette strength={palette.dark ? 0.55 : 0.25} />
      <Grain opacity={palette.dark ? 0.06 : 0.045} />
    </AbsoluteFill>
  );
};

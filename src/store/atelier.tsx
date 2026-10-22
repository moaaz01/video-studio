/**
 * The atelier stage: a bespoke, deterministic set for the emerald cut.
 *
 * Nothing here is a stock texture. The vocabulary is built from the brand's own
 * two hues plus silver:
 *
 *   - a liquid-chrome ribbon that crosses the frame like a brush stroke;
 *   - glass monoliths at the edges, lit by a cool key;
 *   - an eight-point arabesque lattice crossed with circuit traces — the same
 *     geometry as the product's ticket motif, not a generic "tech" grid;
 *   - a specular sweep that crosses on the bar, never as a random glitch.
 *
 * Everything is a pure function of `frame`. No randomness, no timers, no canvas.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

const mix = (a: string, b: string, p: number) => {
  const parse = (h: string) => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * p).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
};

/** A broad metallic tube crossing the stage, with one specular edge. */
const Ribbon: React.FC<{W: number; H: number; accent: string; phase: number; opacity: number}> = ({
  W,
  H,
  accent,
  phase,
  opacity,
}) => {
  const f = useCurrentFrame();
  const drift = Math.sin(f * 0.006 + phase) * H * 0.025;
  const drift2 = Math.cos(f * 0.005 + phase) * H * 0.018;
  const d = `M ${-W * 0.22} ${H * 0.24 + drift}
    C ${W * 0.18} ${H * 0.02 + drift2}, ${W * 0.34} ${H * 0.72 + drift}, ${W * 0.58} ${H * 0.5 + drift2}
    S ${W * 0.92} ${H * 0.14 + drift}, ${W * 1.18} ${H * 0.62 + drift2}`;
  const chrome = mix(mix(accent, '#03100F', 0.35), '#BFF9EC', 0.35);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{position: 'absolute', inset: 0, opacity, mixBlendMode: 'screen', pointerEvents: 'none'}}
    >
      <defs>
        <linearGradient id="atelier-ribbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mix(accent, '#04100F', 0.7)} />
          <stop offset="0.26" stopColor={accent} />
          <stop offset="0.46" stopColor={chrome} />
          <stop offset="0.58" stopColor={mix(accent, '#FFFFFF', 0.55)} />
          <stop offset="0.76" stopColor={mix(accent, '#04100F', 0.25)} />
          <stop offset="1" stopColor="#03100F" />
        </linearGradient>
        <filter id="atelier-ribbon-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={H * 0.018} />
        </filter>
      </defs>
      <path d={d} fill="none" stroke="url(#atelier-ribbon)" strokeWidth={H * 0.19} strokeLinecap="round" opacity={0.14} filter="url(#atelier-ribbon-soft)" />
      <path d={d} fill="none" stroke="url(#atelier-ribbon)" strokeWidth={H * 0.058} strokeLinecap="round" opacity={0.22} />
      <path d={d} fill="none" stroke="rgba(225,255,247,0.30)" strokeWidth={Math.max(1.2, H * 0.0018)} strokeLinecap="round" transform={`translate(0 ${-H * 0.032})`} opacity={0.7} />
      <path d={d} fill="none" stroke="rgba(5,25,22,0.55)" strokeWidth={Math.max(1, H * 0.0012)} strokeLinecap="round" transform={`translate(0 ${H * 0.04})`} opacity={0.6} />
    </svg>
  );
};

/** Tall glass slabs, mostly out of frame, that give the stage depth. */
const Monoliths: React.FC<{W: number; H: number; accent: string; opacity: number}> = ({W, H, accent, opacity}) => {
  const f = useCurrentFrame();
  const slabs = [
    {x: -0.085, y: 0.12, w: 0.17, h: 0.78, rot: -7, p: 0.0},
    {x: 0.9, y: 0.02, w: 0.2, h: 0.86, rot: 6, p: 1.7},
    {x: 0.02, y: 0.72, w: 0.13, h: 0.4, rot: 11, p: 3.1},
  ];
  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
      {slabs.map((s, i) => {
        const bob = Math.sin(f * 0.006 + s.p) * H * 0.012;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: W * s.x,
              top: H * s.y + bob,
              width: W * s.w,
              height: H * s.h,
              borderRadius: Math.min(W, H) * 0.045,
              transform: `rotate(${s.rot + Math.sin(f * 0.004 + s.p) * 1.2}deg)`,
              background: `linear-gradient(155deg, ${mix(accent, '#FFFFFF', 0.55)}22 0%, rgba(255,255,255,0.035) 26%, rgba(3,14,13,0.52) 68%, ${accent}18 100%)`,
              border: '1px solid rgba(190,255,240,0.12)',
              boxShadow: `inset 0 0 80px ${mix(accent, '#FFFFFF', 0.7)}12, 0 30px 80px -40px rgba(0,0,0,0.8)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 1,
                borderRadius: 'inherit',
                background: 'linear-gradient(116deg, rgba(255,255,255,0.14), transparent 22%, transparent 72%, rgba(255,255,255,0.06))',
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Eight-point star + circuit traces, as a low-opacity architectural lattice. */
const Lattice: React.FC<{W: number; H: number; accent: string; opacity: number}> = ({W, H, accent, opacity}) => {
  const f = useCurrentFrame();
  const size = 132;
  const star = `M ${size / 2} 10 L ${size / 2 + 16} ${size / 2 - 16} L ${size - 10} ${size / 2} L ${size / 2 + 16} ${size / 2 + 16} L ${size / 2} ${size - 10} L ${size / 2 - 16} ${size / 2 + 16} L 10 ${size / 2} L ${size / 2 - 16} ${size / 2 - 16} Z`;
  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none', mixBlendMode: 'screen'}}>
      <svg width="100%" height="100%">
        <defs>
          <pattern id="atelier-lattice" width={size} height={size} patternUnits="userSpaceOnUse" patternTransform={`rotate(${f * 0.02})`}>
            <g fill="none" stroke={mix(accent, '#FFFFFF', 0.45)} strokeWidth="0.8">
              <path d={star} opacity="0.55" />
              <circle cx={size / 2} cy={size / 2} r={size * 0.1} opacity="0.55" />
              <path d={`M0 ${size / 2} H${size * 0.32} M${size * 0.68} ${size / 2} H${size}`} opacity="0.35" />
              <path d={`M${size / 2} 0 V${size * 0.3} M${size / 2} ${size * 0.7} V${size}`} opacity="0.28" />
              <rect x={size * 0.36} y={size * 0.36} width={size * 0.28} height={size * 0.28} opacity="0.18" />
            </g>
          </pattern>
          <radialGradient id="atelier-lattice-fade" cx="50%" cy="44%" r="62%">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <mask id="atelier-lattice-mask">
            <rect width="100%" height="100%" fill="url(#atelier-lattice-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#atelier-lattice)" mask="url(#atelier-lattice-mask)" />
      </svg>
    </AbsoluteFill>
  );
};

/** A chrome sphere, partly out of frame; the stage's one sculptural mass. */
const Sphere: React.FC<{W: number; H: number; accent: string; opacity: number}> = ({W, H, accent, opacity}) => {
  const f = useCurrentFrame();
  const size = Math.min(W, H) * 0.52;
  return (
    <div
      style={{
        position: 'absolute',
        left: W * 0.78 + Math.sin(f * 0.004) * W * 0.008,
        top: H * 0.02 + Math.cos(f * 0.005) * H * 0.01,
        width: size,
        height: size,
        borderRadius: '50%',
        opacity,
        background: `radial-gradient(circle at 32% 26%, #F4FFFC 0%, ${mix(accent, '#FFFFFF', 0.62)} 8%, ${accent} 28%, ${mix(accent, '#02100E', 0.55)} 58%, #020B0A 82%)`,
        boxShadow: `inset -${size * 0.08}px -${size * 0.12}px ${size * 0.22}px rgba(0,0,0,0.65), inset ${size * 0.03}px ${size * 0.02}px ${size * 0.08}px rgba(255,255,255,0.32), 0 40px 120px -40px ${mix(accent, '#000000', 0.4)}`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 28%, rgba(255,255,255,0.18), transparent 38%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
};

/** A slow specular band, the only moving highlight on the set. */
const Sweep: React.FC<{W: number; H: number; opacity: number}> = ({W, H, opacity}) => {
  const f = useCurrentFrame();
  const p = (f % 260) / 260;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity}}>
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: `${-40 + p * 140}%`,
          width: '18%',
          height: '160%',
          transform: 'rotate(18deg)',
          background: 'linear-gradient(90deg, transparent, rgba(210,255,246,0.12) 42%, rgba(255,255,255,0.22) 50%, rgba(210,255,246,0.10) 58%, transparent)',
          filter: 'blur(12px)',
        }}
      />
    </AbsoluteFill>
  );
};

export const AtelierFX: React.FC<{
  accent?: string;
  /** 0 = just the lattice; 1 = the full set */
  intensity?: number;
  /** pass false on a dense scene where the ribbon would fight the UI */
  ribbon?: boolean;
  sphere?: boolean;
}> = ({accent = '#0F7C80', intensity = 1, ribbon = true, sphere = true}) => {
  const {width: W, height: H} = useVideoConfig();
  const f = useCurrentFrame();
  // one breath per 4 s, never a loop the eye can catch
  const breath = 0.88 + 0.12 * Math.sin(f * 0.012);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: intensity}}>
      <Lattice W={W} H={H} accent={accent} opacity={0.1 * breath} />
      {ribbon && <Ribbon W={W} H={H} accent={accent} phase={0.7} opacity={0.55 * breath} />}
      {sphere && <Sphere W={W} H={H} accent={accent} opacity={0.34 * breath} />}
      <Monoliths W={W} H={H} accent={accent} opacity={0.65 * breath} />
      <Sweep W={W} H={H} opacity={0.55 * breath} />
    </AbsoluteFill>
  );
};

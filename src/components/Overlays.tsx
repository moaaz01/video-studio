import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, tween} from '../lib/anim';
import {C} from '../theme';
import {Grain} from '../components/Surfaces';

type Variant = 'paper' | 'ink' | 'emerald' | 'plum';

const palette: Record<Variant, {fill: string; accent: string; edge: string}> = {
  paper: {fill: C.paper, accent: C.emerald, edge: 'rgba(26,42,54,0.10)'},
  ink: {fill: C.inkBg, accent: C.amber, edge: 'rgba(241,233,220,0.12)'},
  emerald: {fill: '#0A6B56', accent: '#36C4A0', edge: 'rgba(255,255,255,0.16)'},
  plum: {fill: '#2A2350', accent: C.plum, edge: 'rgba(255,255,255,0.14)'},
};

/**
 * A panel sweeps across the frame and is opaque for exactly one instant — the
 * cut. Its leading edge is skewed and blurred so it reads as a sheet of paper
 * passing the lens rather than a CSS rectangle. Mount it as a Sequence of
 * `2 * half` frames centred on the cut frame.
 */
export const Wipe: React.FC<{variant?: Variant; half?: number; skew?: number; softness?: number}> = ({
  variant = 'paper',
  half = 9,
  skew = 9,
  softness = 42,
}) => {
  const f = useCurrentFrame();
  const total = half * 2;
  const p = Math.min(1, Math.max(0, f / (total - 1)));
  // ease so the panel is fast at the edges and hangs for a beat at full cover
  const x = p < 0.5 ? E.inOut(p * 2) : E.inOut((p - 0.5) * 2);
  const tx = p < 0.5 ? (1 - x) * 106 : -x * 106;
  const c = palette[variant];
  const cover = 1 - Math.min(1, Math.abs(p - 0.5) * 2.1);

  return (
    <AbsoluteFill style={{zIndex: 60, pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: '-12%',
          top: '-14%',
          width: '124%',
          height: '128%',
          transform: `translateX(${tx}%) skewX(${skew}deg)`,
          background: c.fill,
          boxShadow: `0 0 ${softness}px 14px ${c.edge}`,
        }}
      >
        <AbsoluteFill
          style={{
            background: `radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.10), transparent 70%)`,
          }}
        />
        <Grain opacity={0.05} blend={variant === 'paper' ? 'multiply' : 'overlay'} />
      </div>
      {/* accent hairline riding the leading edge */}
      <div
        style={{
          position: 'absolute',
          top: '-14%',
          height: '128%',
          width: 5,
          left: 0,
          transform: `translateX(calc(${tx}vw)) skewX(${skew}deg)`,
          display: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: c.accent,
          opacity: cover * 0.5,
          mixBlendMode: 'soft-light',
        }}
      />
    </AbsoluteFill>
  );
};

/** Light floods the frame — used to lift the film out of the dark opening. */
export const Flash: React.FC<{color?: string; peak?: number}> = ({color = '#FFF9F0', peak = 0.94}) => {
  const f = useCurrentFrame();
  const a = f <= 5 ? E.outExpo(f / 5) * peak : (1 - E.inOut(Math.min(1, (f - 5) / 13))) * peak;
  return (
    <AbsoluteFill
      style={{
        zIndex: 61,
        background: color,
        opacity: Math.max(0, a),
        pointerEvents: 'none',
      }}
    />
  );
};

/** A soft warm bloom that travels across the frame — a lens artefact, not a gradient. */
export const LightLeak: React.FC<{from?: 'right' | 'left'; color?: string; strength?: number}> = ({
  from = 'right',
  color = 'rgba(255,214,140,0.5)',
  strength = 1,
}) => {
  const f = useCurrentFrame();
  const p = tween(f, 0, 34, E.inOut);
  const x = from === 'right' ? 118 - p * 136 : -18 + p * 136;
  return (
    <AbsoluteFill style={{zIndex: 55, pointerEvents: 'none', mixBlendMode: 'screen'}}>
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: '-30%',
          width: '60%',
          height: '160%',
          background: `radial-gradient(closest-side, ${color}, transparent 72%)`,
          opacity: strength * Math.sin(Math.PI * p),
          filter: 'blur(18px)',
          transform: 'rotate(12deg)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Fade to ink and back, for the two heaviest cuts. */
export const Blackout: React.FC<{peak?: number}> = ({peak = 1}) => {
  const f = useCurrentFrame();
  const a = f <= 4 ? f / 4 : Math.max(0, 1 - (f - 4) / 10);
  return (
    <AbsoluteFill style={{zIndex: 62, background: '#080705', opacity: Math.min(1, a) * peak}} />
  );
};

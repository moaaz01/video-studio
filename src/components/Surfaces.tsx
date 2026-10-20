import React, {useMemo} from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {C} from '../theme';

const noiseSvg = (freq: number, octaves: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>` +
  `<filter id='n' x='0' y='0' width='100%' height='100%'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' stitchTiles='stitch'/>` +
  `<feColorMatrix type='saturate' values='0'/>` +
  `</filter><rect width='256' height='256' filter='url(#n)'/></svg>`;

/** Film grain. Dithers 4K gradients so they never band, and adds a printed feel. */
export const Grain: React.FC<{opacity?: number; blend?: React.CSSProperties['mixBlendMode']; scale?: number}> = ({
  opacity = 0.055,
  blend = 'overlay',
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const url = useMemo(
    () => `url("data:image/svg+xml;utf8,${encodeURIComponent(noiseSvg(0.82, 4))}")`,
    [],
  );
  // deterministic 2-frame jitter — static grain reads as a texture, moving grain reads as film
  const step = Math.floor(frame / 2);
  const x = Math.round(random(`gx${step}`) * 256);
  const y = Math.round(random(`gy${step}`) * 256);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: url,
        backgroundRepeat: 'repeat',
        backgroundSize: `${256 * scale}px ${256 * scale}px`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: blend,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Exercise-book ruling — the brand's "كرّاسة" motif. */
export const Ruled: React.FC<{gap?: number; color?: string; opacity?: number; offset?: number}> = ({
  gap = 46,
  color = C.hairline,
  opacity = 0.55,
  offset = 0,
}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 1px, transparent 1px, transparent ${gap}px)`,
      backgroundPosition: `0 ${offset}px`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** Soft dot grid, for the "product" surfaces. */
export const Dots: React.FC<{gap?: number; color?: string; opacity?: number; size?: number}> = ({
  gap = 52,
  color = 'rgba(26,42,54,0.10)',
  opacity = 0.6,
  size = 1.4,
}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `radial-gradient(${color} ${size}px, transparent ${size}px)`,
      backgroundSize: `${gap}px ${gap}px`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** Big soft colour bloom. */
export const Glow: React.FC<{
  x: number | string;
  y: number | string;
  r: number;
  color: string;
  opacity?: number;
}> = ({x, y, r, color, opacity = 0.5}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: r * 2,
      height: r * 2,
      marginLeft: -r,
      marginTop: -r,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, ${color}00 68%)`,
      opacity,
      pointerEvents: 'none',
      filter: 'blur(2px)',
    }}
  />
);

export const Vignette: React.FC<{strength?: number; color?: string}> = ({
  strength = 0.5,
  color = '26,42,54',
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 44%, rgba(${color},0) 38%, rgba(${color},${strength * 0.55}) 82%, rgba(${color},${strength}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

export type Tone = 'paper' | 'paperRaised' | 'sunken' | 'ink' | 'emerald';

/**
 * The film's ground. Light = the product world (warm paper); ink = the problem
 * and the closing statement. Never a flat CSS colour: always paper + ambient
 * blooms + ruling + grain, because flat colour is what makes a render look cheap.
 */
export const Ground: React.FC<{
  tone?: Tone;
  ruled?: boolean;
  dots?: boolean;
  grain?: number;
  vignette?: number;
  children?: React.ReactNode;
}> = ({tone = 'paper', ruled = false, dots = false, grain = 0.055, vignette = 0.35, children}) => {
  const bg: Record<Tone, React.CSSProperties> = {
    paper: {background: C.paper},
    paperRaised: {background: C.paperRaised},
    sunken: {background: C.paperSunken},
    ink: {background: C.inkBg},
    emerald: {background: 'linear-gradient(150deg,#0E8A6E 0%,#0A6B56 48%,#114E47 100%)'},
  };
  const dark = tone === 'ink' || tone === 'emerald';
  return (
    <AbsoluteFill style={bg[tone]}>
      {tone === 'paper' && (
        <>
          <Glow x="88%" y="6%" r={760} color={C.emeraldSoft} opacity={0.55} />
          <Glow x="6%" y="92%" r={720} color={C.amberSoft} opacity={0.5} />
          <Glow x="50%" y="50%" r={900} color="#FFFFFF" opacity={0.35} />
        </>
      )}
      {tone === 'sunken' && (
        <>
          <Glow x="80%" y="10%" r={700} color="#FFFFFF" opacity={0.6} />
          <Glow x="10%" y="90%" r={700} color={C.emeraldSoft} opacity={0.4} />
        </>
      )}
      {dark && (
        <>
          <Glow x="72%" y="18%" r={860} color="#0E8A6E" opacity={0.42} />
          <Glow x="12%" y="86%" r={720} color="#0A6B56" opacity={0.3} />
        </>
      )}
      {ruled && <Ruled color={dark ? C.hairlineDark : C.hairline} opacity={dark ? 0.5 : 0.6} />}
      {dots && <Dots color={dark ? 'rgba(241,233,220,0.10)' : 'rgba(26,42,54,0.10)'} />}
      {children}
      {vignette > 0 && <Vignette strength={vignette} color={dark ? '8,6,4' : '26,42,54'} />}
      {grain > 0 && <Grain opacity={grain} blend={dark ? 'soft-light' : 'overlay'} />}
    </AbsoluteFill>
  );
};

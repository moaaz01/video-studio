import React, {useMemo} from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
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

/**
 * A slow aurora: three huge radial gradients whose centres drift on sine waves.
 * It replaces the "flat colour + one glow" background that reads cheap on a big
 * screen. Pure function of the frame — a still and its video frame match.
 */
export const Aurora: React.FC<{
  colors: [string, string, string];
  opacity?: number;
  speed?: number;
  blend?: React.CSSProperties['mixBlendMode'];
}> = ({colors, opacity = 0.55, speed = 1, blend = 'screen'}) => {
  const frame = useCurrentFrame();
  const t = frame * 0.0035 * speed;
  const at = (cx: number, cy: number) => `at ${cx}% ${cy}%`;
  return (
    <AbsoluteFill
      style={{
        opacity,
        mixBlendMode: blend,
        pointerEvents: 'none',
        background: [
          `radial-gradient(46% 58% ${at(24 + 8 * Math.sin(t), 20 + 6 * Math.cos(t * 0.8))}, ${colors[0]}, transparent 70%)`,
          `radial-gradient(52% 60% ${at(76 + 6 * Math.cos(t * 0.9), 72 + 8 * Math.sin(t * 0.7))}, ${colors[1]}, transparent 72%)`,
          `radial-gradient(38% 44% ${at(58 + 10 * Math.sin(t * 0.6 + 1.7), 18 + 5 * Math.cos(t * 0.9))}, ${colors[2]}, transparent 74%)`,
        ].join(','),
      }}
    />
  );
};

/** A light shaft raking across the frame — lens, not gradient. */
export const Rays: React.FC<{color?: string; opacity?: number; angle?: number; x?: number}> = ({
  color = 'rgba(255,238,205,0.30)',
  opacity = 0.5,
  angle = 22,
  x = 62,
}) => (
  <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity}}>
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: '-40%',
        width: '26%',
        height: '180%',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        filter: 'blur(26px)',
        transform: `rotate(${angle}deg)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: `${x - 22}%`,
        top: '-30%',
        width: '8%',
        height: '160%',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        filter: 'blur(16px)',
        opacity: 0.6,
        transform: `rotate(${angle + 4}deg)`,
      }}
    />
  </AbsoluteFill>
);

/** Decorative ring with a dashed arc; used behind the phone and the stat. */
export const OrbitRing: React.FC<{size: number; color?: string; dash?: number; opacity?: number; reverse?: boolean}> = ({
  size,
  color = 'rgba(241,233,220,0.16)',
  dash = 6,
  opacity = 1,
  reverse = false,
}) => {
  const frame = useCurrentFrame();
  const rot = (reverse ? -1 : 1) * frame * 0.12;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{position: 'absolute', inset: 0, transform: `rotate(${rot}deg)`, opacity, pointerEvents: 'none'}}
    >
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={`${dash} ${dash * 2.4}`} />
    </svg>
  );
};

/** Corner registration marks — the editorial "this frame was composed" signal. */
export const CornerMarks: React.FC<{color?: string; inset?: number; label?: string}> = ({
  color = 'rgba(241,233,220,0.30)',
  inset = 48,
  label,
}) => (
  <>
    {[
      {top: inset, left: inset, b: 'top', s: 'left'},
      {top: inset, right: inset, b: 'top', s: 'right'},
      {bottom: inset, left: inset, b: 'bottom', s: 'left'},
      {bottom: inset, right: inset, b: 'bottom', s: 'right'},
    ].map((p, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          ...p,
          width: 18,
          height: 18,
          borderTop: p.b === 'top' ? `1.5px solid ${color}` : undefined,
          borderBottom: p.b === 'bottom' ? `1.5px solid ${color}` : undefined,
          borderLeft: p.s === 'left' ? `1.5px solid ${color}` : undefined,
          borderRight: p.s === 'right' ? `1.5px solid ${color}` : undefined,
          pointerEvents: 'none',
        }}
      />
    ))}
    {label ? (
      <div
        style={{
          position: 'absolute',
          bottom: inset + 2,
          left: inset + 30,
          fontFamily: 'Tajawal',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 2,
          color,
        }}
      >
        {label}
      </div>
    ) : null}
  </>
);

export type Tone = 'paper' | 'paperRaised' | 'sunken' | 'ink' | 'emerald';
export type GroundVariant =
  | 'auto'
  | 'paper-glow'
  | 'ink-aurora'
  | 'emerald-depth'
  | 'souk-night'
  | 'golden-souk'
  | 'vault-night'
  | 'vault-warm'
  | 'atelier'
  | 'cobalt';

/**
 * The film's ground. Light = the product world (warm paper); ink = the problem
 * and the closing statement. Never a flat CSS colour: always paper + ambient
 * blooms + ruling + grain, because flat colour is what makes a render look cheap.
 */
/** An eight-point star lattice, the souk's tile, at a whisper of opacity. */
export const Arabesque: React.FC<{color?: string; opacity?: number; size?: number}> = ({
  color = 'rgba(255,206,140,0.55)',
  opacity = 0.06,
  size = 96,
}) => (
  <AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: 'screen'}}>
    <svg width="100%" height="100%">
      <defs>
        <pattern id="arabesque-star" width={size} height={size} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth={1.1}>
            <path
              d={`M${size / 2} 6 L${size / 2 + 10} ${size / 2 - 10} L${size - 6} ${size / 2} L${size / 2 + 10} ${size / 2 + 10} L${size / 2} ${size - 6} L${size / 2 - 10} ${size / 2 + 10} L6 ${size / 2} L${size / 2 - 10} ${size / 2 - 10} Z`}
            />
            <circle cx={size / 2} cy={size / 2} r={size * 0.11} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#arabesque-star)" />
    </svg>
  </AbsoluteFill>
);

/** Warm out-of-focus lights: the market behind the shop, not a gradient. */
export const Bokeh: React.FC<{count?: number; opacity?: number}> = ({count = 12, opacity = 0.5}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {Array.from({length: count}).map((_, i) => {
        const seed = (i * 6151 + 27449) % 93643;
        const r = (n: number) => ((Math.sin(seed * (n + 3.1)) * 10000) % 1 + 1) % 1;
        const w = width * (0.03 + r(1) * 0.07);
        const x = r(2) * width + Math.sin(frame * 0.004 + i) * 30;
        const y = (r(3) * height + frame * (0.05 + r(4) * 0.12)) % height;
        const gold = i % 3 !== 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: w,
              borderRadius: '50%',
              background: gold
                ? 'radial-gradient(circle, rgba(255,193,102,0.55), rgba(255,160,70,0.08) 60%, transparent 72%)'
                : 'radial-gradient(circle, rgba(150,240,236,0.4), rgba(60,180,180,0.06) 60%, transparent 72%)',
              filter: `blur(${w * 0.28}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Ground: React.FC<{
  tone?: Tone;
  ruled?: boolean;
  dots?: boolean;
  grain?: number;
  vignette?: number;
  variant?: GroundVariant;
  children?: React.ReactNode;
}> = ({tone = 'paper', ruled = false, dots = false, grain = 0.055, vignette = 0.35, variant = 'auto', children}) => {
  const bg: Record<Tone, React.CSSProperties> = {
    paper: {background: C.paper},
    paperRaised: {background: C.paperRaised},
    sunken: {background: C.paperSunken},
    ink: {background: C.inkBg},
    emerald: {background: 'linear-gradient(150deg,#0E8A6E 0%,#0A6B56 48%,#114E47 100%)'},
  };
  const dark = tone === 'ink' || tone === 'emerald';
  const v: GroundVariant = variant === 'auto' ? (tone === 'ink' ? 'ink-aurora' : tone === 'emerald' ? 'emerald-depth' : 'paper-glow') : variant;
  return (
    <AbsoluteFill style={bg[tone]}>
      {v === 'paper-glow' && (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(118deg,#FFF9EE 0%,#F8EBD5 48%,#F2DFC4 100%)'}} />
          <Aurora colors={['rgba(14,138,110,0.40)', 'rgba(217,152,47,0.34)', 'rgba(255,246,228,0.55)']} opacity={0.9} speed={0.8} />
          <AbsoluteFill style={{background: 'radial-gradient(70% 60% at 22% 18%, rgba(255,252,242,0.55), transparent 62%)'}} />
          <Glow x="88%" y="4%" r={780} color={C.emeraldSoft} opacity={0.52} />
          <Glow x="4%" y="94%" r={760} color={C.amberSoft} opacity={0.5} />
        </>
      )}
      {v === 'ink-aurora' && (
        <>
          <Aurora colors={['rgba(14,138,110,0.55)', 'rgba(217,152,47,0.28)', 'rgba(106,87,166,0.34)']} opacity={0.8} speed={0.7} />
          <Glow x="74%" y="10%" r={880} color="#0E8A6E" opacity={0.45} />
          <Glow x="16%" y="88%" r={720} color={C.amber} opacity={0.16} />
          <Rays color="rgba(241,233,220,0.10)" opacity={0.5} angle={18} x={70} />
        </>
      )}
      {v === 'golden-souk' && (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(150deg,#241307 0%,#3A1F0E 22%,#2A1610 46%,#122528 76%,#08171B 100%)'}} />
          <Aurora colors={['rgba(255,176,74,0.42)', 'rgba(255,104,72,0.16)', 'rgba(42,165,169,0.55)']} opacity={0.8} speed={0.5} />
          <Glow x="16%" y="6%" r={1020} color="#F2A93B" opacity={0.4} />
          <Glow x="86%" y="2%" r={900} color="#2AA5A9" opacity={0.42} />
          <Glow x="22%" y="100%" r={900} color="#7A2E1A" opacity={0.4} />
          <Rays color="rgba(255,214,150,0.16)" opacity={0.7} angle={14} x={24} />
          <Rays color="rgba(190,246,240,0.11)" opacity={0.5} angle={-8} x={78} />
          <Arabesque opacity={0.07} />
          <AbsoluteFill style={{background: 'radial-gradient(64% 68% at 50% 46%, rgba(14,6,3,0) 0%, rgba(14,6,3,0.56) 100%)'}} />
        </>
      )}
      {v === 'vault-warm' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(96% 86% at 50% 44%, #2A1810 0%, #1A0F0B 54%, #070C0F 100%)'}} />
          <Rays color="rgba(255,190,110,0.20)" opacity={0.75} angle={0} x={50} />
          <Glow x="50%" y="40%" r={820} color="#F2A93B" opacity={0.26} />
          <Glow x="86%" y="10%" r={560} color="#2AA5A9" opacity={0.16} />
          <Arabesque opacity={0.045} />
        </>
      )}
      {v === 'souk-night' && (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(166deg,#0B2B33 0%,#06171F 44%,#030A0F 100%)'}} />
          <Aurora colors={['rgba(42,165,169,0.55)', 'rgba(242,169,59,0.16)', 'rgba(15,58,60,0.72)']} opacity={0.9} speed={0.55} />
          <Glow x="78%" y="4%" r={900} color="#0F7C80" opacity={0.5} />
          <Glow x="10%" y="94%" r={780} color="#F2A93B" opacity={0.14} />
          <Rays color="rgba(190,246,240,0.10)" opacity={0.55} angle={16} x={72} />
          <AbsoluteFill style={{background: 'radial-gradient(58% 62% at 50% 44%, rgba(4,10,14,0) 0%, rgba(4,10,14,0.5) 100%)'}} />
        </>
      )}
      {v === 'vault-night' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(92% 82% at 50% 42%, #0B1A22 0%, #050B12 58%, #02050A 100%)'}} />
          <Rays color="rgba(242,169,59,0.14)" opacity={0.6} angle={0} x={50} />
          <Glow x="50%" y="42%" r={760} color="#0F7C80" opacity={0.22} />
          <Glow x="84%" y="8%" r={520} color="#F2A93B" opacity={0.10} />
        </>
      )}
      {v === 'emerald-depth' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 70% 0%, #12916F 0%, #0B6B56 46%, #073A33 100%)'}} />
          <Aurora colors={['rgba(54,196,160,0.5)', 'rgba(10,62,54,0.6)', 'rgba(255,238,205,0.26)']} opacity={0.85} speed={0.6} />
          <Rays color="rgba(255,245,225,0.16)" opacity={0.45} angle={24} x={64} />
          <Glow x="84%" y="-10%" r={760} color="#3FE0B4" opacity={0.28} />
        </>
      )}
      {v === 'atelier' && (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(152deg,#071C1A 0%,#0A2420 26%,#0B1B1F 54%,#070F16 100%)'}} />
          <Aurora colors={['rgba(38,196,160,0.34)', 'rgba(120,186,255,0.18)', 'rgba(255,236,205,0.12)']} opacity={0.72} speed={0.45} />
          <Glow x="82%" y="4%" r={980} color="#25B893" opacity={0.32} />
          <Glow x="18%" y="96%" r={860} color="#3A6FB0" opacity={0.22} />
          <Rays color="rgba(212,255,244,0.08)" opacity={0.5} angle={18} x={70} />
          <AbsoluteFill
            style={{
              backgroundImage:
                'linear-gradient(rgba(180,255,240,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(180,255,240,0.035) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              maskImage: 'radial-gradient(75% 70% at 50% 42%, #000 0%, transparent 78%)',
              WebkitMaskImage: 'radial-gradient(75% 70% at 50% 42%, #000 0%, transparent 78%)',
            }}
          />
          <AbsoluteFill style={{background: 'radial-gradient(62% 64% at 50% 44%, rgba(2,8,10,0) 0%, rgba(2,8,10,0.56) 100%)'}} />
        </>
      )}
      {v === 'cobalt' && (
        <>
          <AbsoluteFill style={{background: 'linear-gradient(152deg,#040814 0%,#08142A 28%,#0B1730 52%,#050A14 100%)'}} />
          <Aurora colors={['rgba(47,107,255,0.38)', 'rgba(120,160,255,0.18)', 'rgba(244,227,200,0.14)']} opacity={0.78} speed={0.45} />
          <Glow x="82%" y="0%" r={980} color="#2F6BFF" opacity={0.38} />
          <Glow x="14%" y="100%" r={860} color="#F2A93B" opacity={0.10} />
          <Rays color="rgba(210,230,255,0.09)" opacity={0.55} angle={20} x={72} />
          <AbsoluteFill
            style={{
              backgroundImage:
                'linear-gradient(rgba(190,220,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(190,220,255,0.04) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
              maskImage: 'radial-gradient(78% 72% at 50% 42%, #000 0%, transparent 78%)',
              WebkitMaskImage: 'radial-gradient(78% 72% at 50% 42%, #000 0%, transparent 78%)',
            }}
          />
          <AbsoluteFill style={{background: 'radial-gradient(62% 64% at 50% 44%, rgba(1,4,10,0) 0%, rgba(1,4,10,0.58) 100%)'}} />
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

import React from 'react';
import {interpolate} from 'remotion';
import type {Viseme} from '../lib/speech';

/**
 * Puppet: the studio's own presenter, drawn in SVG and rigged in code.
 *
 * Original design (no licensed character): a round head, a simple torso and two
 * two-bone arms. Everything a viewer reads as "alive" is procedural and
 * deterministic per frame: blink, breath, a head bob while speaking, the mouth
 * from the VO word timings (see `lib/speech.ts`), and poses blended over 10 frames.
 * Wardrobe (skin, hair, hijab, glasses, shirt) is data, so one rig serves a cast.
 */

export type HairStyle = 'short' | 'long' | 'hijab' | 'cap' | 'none';
export type Pose = 'idle' | 'wave' | 'point' | 'cheer' | 'think' | 'present';
export type Expression = 'neutral' | 'happy' | 'surprised' | 'thinking' | 'concerned' | 'confident';

export type Look = {
  skin?: string;
  hair?: string;
  shirt?: string;
  accent?: string;
  hairStyle?: HairStyle;
  glasses?: boolean;
};

export type PuppetProps = {
  frame: number;
  fps: number;
  look?: Look;
  /** gestures in beat-local seconds; the first entry is the pose at t=0 */
  gestures?: {at: number; pose: Pose}[];
  expression?: Expression;
  /** 0–1 jaw opening and the vowel shape, from `mouthAt` */
  mouth?: {open: number; viseme: Viseme};
  talking?: boolean;
  /** which side the pointing arm reaches toward */
  pointTo?: 'left' | 'right';
  /** deterministic per-character offset so a cast does not blink in unison */
  seed?: number;
  height: number;
};

type Arms = {la: number; le: number; ra: number; re: number};

/** Angles in degrees from straight down; positive swings away from the body. */
const POSES: Record<Pose, Arms> = {
  idle: {la: 8, le: -4, ra: 8, re: -4},
  wave: {la: 8, le: -4, ra: 140, re: 30},
  point: {la: 8, le: -4, ra: 82, re: 8},
  cheer: {la: 155, le: 10, ra: 155, re: 10},
  think: {la: 8, le: -4, ra: 10, re: -175},
  present: {la: 48, le: -22, ra: 48, re: -22},
};

const BROWS: Record<Expression, {lift: number; tilt: number; asym?: number}> = {
  neutral: {lift: 0, tilt: 0},
  happy: {lift: 4, tilt: -4},
  surprised: {lift: 14, tilt: 0},
  thinking: {lift: 2, tilt: 0, asym: 10},
  concerned: {lift: 4, tilt: 12},
  confident: {lift: -2, tilt: -8},
};

const DEFAULT_LOOK: Required<Look> = {
  skin: '#E6B48E',
  hair: '#2A1F1A',
  shirt: '#0E8A6E',
  accent: '#F2C14E',
  hairStyle: 'short',
  glasses: false,
};

const UPPER = 118;
const FORE = 112;
const rad = (d: number) => (d * Math.PI) / 180;

const poseAt = (gestures: {at: number; pose: Pose}[], t: number, fps: number): Arms => {
  const list = gestures.length ? gestures : [{at: 0, pose: 'idle' as Pose}];
  let idx = 0;
  list.forEach((g, i) => {
    if (t >= g.at) idx = i;
  });
  const cur = POSES[list[idx].pose];
  const prev = POSES[list[Math.max(0, idx - 1)].pose];
  const k = idx === 0 ? 1 : interpolate((t - list[idx].at) * fps, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
  const ease = 1 - Math.pow(1 - k, 3);
  return {
    la: prev.la + (cur.la - prev.la) * ease,
    le: prev.le + (cur.le - prev.le) * ease,
    ra: prev.ra + (cur.ra - prev.ra) * ease,
    re: prev.re + (cur.re - prev.re) * ease,
  };
};

const Arm: React.FC<{x: number; y: number; a: number; e: number; side: 1 | -1; shirt: string; skin: string}> = ({
  x, y, a, e, side, shirt, skin,
}) => {
  const ex = x + side * Math.sin(rad(a)) * UPPER;
  const ey = y + Math.cos(rad(a)) * UPPER;
  const hx = ex + side * Math.sin(rad(a + e)) * FORE;
  const hy = ey + Math.cos(rad(a + e)) * FORE;
  return (
    <g>
      {/* a darker rim keeps an arm readable against a torso of the same colour */}
      <path d={`M${x} ${y} L${ex} ${ey} L${hx} ${hy}`} stroke="rgba(0,0,0,0.28)" strokeWidth={42} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M${x} ${y} L${ex} ${ey} L${hx} ${hy}`} stroke={shirt} strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={hx} cy={hy} r={21} fill={skin} />
    </g>
  );
};

const Hair: React.FC<{style: HairStyle; color: string; accent: string; layer: 'back' | 'front'}> = ({style, color, accent, layer}) => {
  if (style === 'long' && layer === 'back') return <rect x={84} y={120} width={232} height={270} rx={110} fill={color} />;
  if (style === 'hijab' && layer === 'back')
    return <path d="M200 70 C330 70 352 200 338 300 C330 360 300 400 300 420 L100 420 C100 400 70 360 62 300 C48 200 70 70 200 70 Z" fill={accent} />;
  if (layer === 'back') return null;
  switch (style) {
    case 'short':
    case 'long':
      return <path d="M90 230 C80 120 150 88 205 90 C270 92 322 128 310 230 C300 180 268 150 230 160 C200 168 150 150 128 170 C108 188 98 210 90 230 Z" fill={color} />;
    case 'hijab':
      return <path d="M86 236 C82 130 140 92 200 92 C260 92 318 130 314 236 C306 176 262 136 200 136 C138 136 94 176 86 236 Z" fill={accent} />;
    case 'cap':
      return (
        <g>
          <path d="M92 196 C96 112 156 92 204 92 C258 92 308 120 310 196 Z" fill={accent} />
          <path d="M200 190 L340 196 C340 210 300 214 200 206 Z" fill={accent} opacity={0.85} />
        </g>
      );
    default:
      return null;
  }
};

const Mouth: React.FC<{open: number; viseme: Viseme; happy: boolean}> = ({open, viseme, happy}) => {
  if (open < 0.08) {
    const curve = happy ? 16 : 8;
    return <path d={`M174 290 Q200 ${290 + curve} 226 290`} stroke="#5A2B22" strokeWidth={6} strokeLinecap="round" fill="none" />;
  }
  const rx = viseme === 'round' ? 12 + open * 4 : viseme === 'wide' ? 26 : 20;
  const ry = viseme === 'round' ? 8 + open * 9 : viseme === 'wide' ? 4 + open * 9 : 5 + open * 16;
  return (
    <g>
      <ellipse cx={200} cy={294} rx={rx} ry={ry} fill="#5A2B22" />
      <ellipse cx={200} cy={294 + ry * 0.45} rx={rx * 0.6} ry={ry * 0.4} fill="#D9706A" />
    </g>
  );
};

export const Puppet: React.FC<PuppetProps> = ({
  frame, fps, look, gestures = [], expression = 'neutral', mouth = {open: 0, viseme: 'rest'},
  talking = false, pointTo = 'left', seed = 0, height,
}) => {
  const L = {...DEFAULT_LOOK, ...look};
  const t = frame / fps;
  // blink: ~every 3.2 s, 5 frames, offset per seed; never on frame 0
  const period = Math.round(fps * 3.2);
  const phase = (frame + seed * 37 + 40) % period;
  const blink = phase < 5 ? Math.sin((phase / 5) * Math.PI) : 0;
  const breath = Math.sin(t * Math.PI * 0.55);
  const bob = talking ? Math.sin(t * Math.PI * 4.2) * 3 : 0;
  const tilt = (expression === 'thinking' ? -6 : 0) + (talking ? Math.sin(t * Math.PI * 1.3) * 1.5 : 0);
  const arms = poseAt(gestures, t, fps);
  // the pointing pose belongs to the arm on the content side
  const mirrored = pointTo === 'left';
  const leftArm = mirrored ? {a: arms.ra, e: arms.re} : {a: arms.la, e: arms.le};
  const rightArm = mirrored ? {a: arms.la, e: arms.le} : {a: arms.ra, e: arms.re};
  const waving = gestures.some((g) => g.pose === 'wave' && t >= g.at);
  const waveOsc = waving ? Math.sin(t * Math.PI * 5) * 18 : 0;
  const brow = BROWS[expression];
  const look2 = expression === 'thinking' ? {x: 4, y: -6} : {x: mirrored ? -3 : 3, y: 0};
  const eyeRy = 20 * (1 - blink * 0.92);

  return (
    <svg viewBox="0 0 400 640" height={height} width={(height * 400) / 640} style={{overflow: 'visible', display: 'block'}}>
      <g transform={`translate(0 ${breath * 2}) scale(1 ${1 + breath * 0.006})`} style={{transformOrigin: '200px 640px'}}>
        {/* torso */}
        <path d="M118 400 C118 372 150 356 200 356 C250 356 282 372 282 400 L300 640 L100 640 Z" fill={L.shirt} />
        <path d="M176 356 L200 392 L224 356 Z" fill={L.skin} opacity={0.9} />
        <Arm x={132} y={398} a={leftArm.a + (mirrored && waving ? waveOsc : 0)} e={leftArm.e} side={-1} shirt={L.shirt} skin={L.skin} />
        <Arm x={268} y={398} a={rightArm.a + (!mirrored && waving ? waveOsc : 0)} e={rightArm.e} side={1} shirt={L.shirt} skin={L.skin} />
        {/* head */}
        <g transform={`translate(0 ${bob}) rotate(${tilt} 200 330)`}>
          <Hair style={L.hairStyle} color={L.hair} accent={L.accent} layer="back" />
          <rect x={182} y={300} width={36} height={64} rx={14} fill={L.skin} />
          <ellipse cx={200} cy={222} rx={108} ry={118} fill={L.skin} />
          <circle cx={140} cy={268} r={16} fill="#E2786B" opacity={0.22} />
          <circle cx={260} cy={268} r={16} fill="#E2786B" opacity={0.22} />
          {[160, 240].map((cx, i) => (
            <g key={cx}>
              <ellipse cx={cx} cy={226} rx={17} ry={eyeRy} fill="#FFFFFF" />
              {blink < 0.6 && <circle cx={cx + look2.x} cy={228 + look2.y} r={9} fill="#1C1A24" />}
              {blink < 0.6 && <circle cx={cx + look2.x + 3} cy={224 + look2.y} r={3} fill="#FFFFFF" />}
              <rect
                x={cx - 20}
                y={186 - brow.lift - (i === 1 ? brow.asym ?? 0 : 0)}
                width={40}
                height={9}
                rx={4.5}
                fill={L.hairStyle === 'hijab' ? '#3A2A22' : L.hair}
                transform={`rotate(${(i === 0 ? 1 : -1) * brow.tilt} ${cx} 190)`}
              />
            </g>
          ))}
          {L.glasses && (
            <g stroke="#1C1A24" strokeWidth={5} fill="none">
              <rect x={134} y={202} width={52} height={46} rx={14} />
              <rect x={214} y={202} width={52} height={46} rx={14} />
              <path d="M186 222 L214 222" />
            </g>
          )}
          <path d="M196 246 Q200 262 206 256" stroke="#B9826A" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Mouth open={mouth.open} viseme={mouth.viseme} happy={expression === 'happy' || expression === 'confident'} />
          <Hair style={L.hairStyle} color={L.hair} accent={L.accent} layer="front" />
        </g>
      </g>
    </svg>
  );
};

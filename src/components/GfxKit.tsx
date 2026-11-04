import React from 'react';
import {interpolate} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Ar} from './Text';
import {Ico} from './Ico';
import {FONT} from '../theme';
import {E, sp, SPRING} from '../lib/anim';
import {toAr} from '../lib/rtl';

/**
 * The richer motion-graphics parts: glass cards, line and donut charts, progress
 * bars and badges. Each takes the beat-local frame and its start frame, so the
 * scene owns timing and these stay pure. Colours come in as props (the palette);
 * nothing here knows a brand.
 */

export type Kit = {f: number; fps: number; startF: number; unit: number; ink: string; accent: string; accent2: string; dark: boolean};

const clampK = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.outExpo});

/** Frosted card: blur behind, a hairline, a soft sheen; RTL content. */
export const GlassCard: React.FC<Kit & {title: string; sub?: string; icon?: string; width: number}> = ({
  f, fps, startF, unit, ink, accent, dark, title, sub, icon, width,
}) => {
  const k = sp(f, fps, startF, SPRING.ui);
  return (
    <div dir="rtl" style={{width, padding: `${30 * unit}px ${34 * unit}px`, borderRadius: 30 * unit,
      background: dark ? 'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))' : 'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)'}`,
      boxShadow: `0 30px 70px rgba(0,0,0,${dark ? 0.45 : 0.14}), inset 0 1px 0 rgba(255,255,255,${dark ? 0.25 : 0.9})`,
      backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', gap: 22 * unit,
      opacity: Math.min(1, k * 1.5), transform: `translateY(${(1 - k) * 40}px) scale(${0.94 + 0.06 * k})`}}>
      {icon ? (
        <div style={{width: 84 * unit, height: 84 * unit, borderRadius: 24 * unit, flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: accent, boxShadow: `0 10px 30px ${accent}66`}}>
          <Ico name={icon} size={48 * unit} color={dark ? '#0B0F1A' : '#FFFFFF'} />
        </div>
      ) : null}
      <div style={{minWidth: 0}}>
        <Ar text={title} size={46 * unit} weight={800} color={ink} lh={1.3} />
        {sub ? <Ar text={sub} size={30 * unit} color={ink} lh={1.5} style={{opacity: 0.72}} /> : null}
      </div>
    </div>
  );
};

/** Line chart that draws itself, fills its area and lands on a glowing last value. */
export const LineChart: React.FC<Kit & {values: number[]; labels?: string[]; w: number; h: number; suffix?: string}> = ({
  f, fps, startF, unit, ink, accent, values, labels, w, h, suffix = '',
}) => {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * w, // time runs left → right, as in Arabic financial graphics
    h - ((v - min) / (max - min || 1)) * h * 0.86 - h * 0.07,
  ]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const k = clampK(f, startF, startF + 1.6 * fps);
  const ev = evolvePath(k, d);
  const last = pts[pts.length - 1];
  const gid = `lg${startF}`;
  return (
    <div style={{position: 'relative', width: w, height: h + 50 * unit}}>
      <svg width={w} height={h} style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke={ink} strokeOpacity={0.1} />)}
        <path d={`${d} L${last[0]} ${h} L0 ${h} Z`} fill={`url(#${gid})`} opacity={k} />
        <path d={d} fill="none" stroke={accent} strokeWidth={6 * unit} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} style={{filter: `drop-shadow(0 0 10px ${accent})`}} />
        {k > 0.97 ? <circle cx={last[0]} cy={last[1]} r={11 * unit} fill={accent} style={{filter: `drop-shadow(0 0 14px ${accent})`}} /> : null}
      </svg>
      {k > 0.97 ? (
        <div style={{position: 'absolute', left: last[0] - 60 * unit, top: last[1] - 74 * unit, fontFamily: FONT.tajawal,
          fontWeight: 900, fontSize: 44 * unit, color: accent}}>{toAr(values[values.length - 1])}{suffix}</div>
      ) : null}
      {labels ? (
        <div dir="ltr" style={{display: 'flex', justifyContent: 'space-between', marginTop: 12 * unit}}>
          {labels.map((l) => <Ar key={l} text={l} size={26 * unit} color={ink} style={{opacity: 0.7}} />)}
        </div>
      ) : null}
    </div>
  );
};

/** Donut: segments draw in sequence; the first segment's share is the centre label. */
export const Donut: React.FC<Kit & {segments: {value: number; label?: string}[]; size: number; center?: string}> = ({
  f, fps, startF, unit, ink, accent, accent2, segments, size, center,
}) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 40;
  const len = 2 * Math.PI * r;
  const colors = [accent, accent2, ink];
  let acc = 0;
  return (
    <div style={{position: 'relative', width: size, height: size}}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke={ink} strokeOpacity={0.1} strokeWidth={12} />
        {segments.map((s, i) => {
          const share = s.value / total;
          const k = clampK(f, startF + i * 0.35 * fps, startF + (i * 0.35 + 0.8) * fps);
          const el = (
            <circle key={i} cx={50} cy={50} r={r} fill="none" stroke={colors[i % 3]} strokeWidth={12}
              strokeOpacity={i === 2 ? 0.5 : 1} strokeDasharray={`${len * share * k} ${len}`}
              strokeDashoffset={-len * acc} transform="rotate(-90 50 50)" />
          );
          acc += share;
          return el;
        })}
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT.tajawal, fontWeight: 900, fontSize: size / 5, color: ink}}>
        {center ?? `${toAr(Math.round((segments[0]?.value ?? 0) / total * 100))}%`}
      </div>
    </div>
  );
};

/** Progress bar filling right → left, with its label and value. */
export const Progress: React.FC<Kit & {value: number; label?: string; w: number}> = ({
  f, fps, startF, unit, ink, accent, value, label, w,
}) => {
  const v = Math.max(0, Math.min(1, value)) * clampK(f, startF, startF + 1.2 * fps);
  return (
    <div dir="rtl" style={{width: w}}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 14 * unit}}>
        {label ? <Ar text={label} size={34 * unit} weight={700} color={ink} /> : <span />}
        <span style={{fontFamily: FONT.tajawal, fontWeight: 900, fontSize: 34 * unit, color: accent}}>{`${toAr(Math.round(v * 100))}%`}</span>
      </div>
      <div style={{height: 22 * unit, borderRadius: 99, background: `${ink}1F`, overflow: 'hidden'}}>
        <div style={{width: `${v * 100}%`, height: '100%', borderRadius: 99, background: `linear-gradient(270deg, ${accent}, ${accent}AA)`,
          boxShadow: `0 0 20px ${accent}88`}} />
      </div>
    </div>
  );
};

/** Pill label: a kicker, a category, a "source" tag. */
export const Badge: React.FC<Kit & {text: string; solid?: boolean}> = ({f, fps, startF, unit, accent, dark, text, solid = true}) => {
  const k = sp(f, fps, startF, SPRING.pop);
  return (
    <div dir="rtl" style={{display: 'inline-flex', padding: `${10 * unit}px ${28 * unit}px`, borderRadius: 99,
      background: solid ? accent : 'transparent', border: `2px solid ${accent}`, transform: `scale(${k})`, opacity: Math.min(1, k * 2)}}>
      <Ar text={text} size={30 * unit} weight={800} color={solid ? (dark ? '#0B0F1A' : '#FFFFFF') : accent} nowrap />
    </div>
  );
};

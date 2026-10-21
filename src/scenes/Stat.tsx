import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow, CornerMarks} from '../components/Surfaces';
import {Ico} from '../components/Ico';
import {C, FONT, shadow} from '../theme';
import {countUp, clamp, entStyle, entrance, sp, tween, E} from '../lib/anim';
import type {SceneProps} from '../film/types';

const STEP_ICONS = ['add', 'forum', 'bolt'];

/**
 * `#data`: one number, counted, landed, then its label. The ring is context, not
 * decoration: three arcs = the three steps, and they close in the order a
 * student takes them.
 */
export const Stat: React.FC<SceneProps> = ({beat, vertical, motion = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stat = beat.stat ?? {from: 0, to: 0, suffix: '', label: ''};
  const value = countUp(frame, 10, 40, stat.to, stat.from);
  const land = tween(frame, 40, 18, E.outQuart);
  const ring = tween(frame, 8, 46, E.outQuart);
  const settle = tween(frame, 46, 14, E.outQuart);
  const flash = frame < 46 ? Math.max(0, 1 - Math.abs(frame - 43) / 6) * 0.30 : 0;

  const RING = vertical ? 322 : 268;
  const S = RING * 2;
  const steps = stat.label.includes('·') ? stat.label.split('·').map((s) => s.trim()).filter(Boolean) : [];

  return (
    <AbsoluteFill>
      <Ground tone="ink" variant="ink-aurora" grain={0.06} vignette={0.44}>
        <Glow x={vertical ? 240 : 640} y={vertical ? 420 : 120} r={780} color={C.emerald} opacity={0.24} />
        <Glow x={vertical ? 860 : 1380} y={vertical ? 1500 : 900} r={620} color={C.amber} opacity={0.12} />
      </Ground>
      <CornerMarks color="rgba(241,233,220,0.24)" inset={48} label="STUDYAI" />

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: vertical ? 30 : 24}}>
        <div style={{...entStyle(entrance(frame, 0, {dist: 10, dur: 22}))}}>
          <Kicker text={beat.kicker ?? ''} color={C.emeraldLit} size={vertical ? 30 : 26} align="center" />
        </div>

        <div style={{position: 'relative', width: S, height: S, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width={S} height={S} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
            <circle cx={RING} cy={RING} r={RING - 10} fill="none" stroke="rgba(241,233,220,0.10)" strokeWidth={vertical ? 9 : 7} />
            {[0, 1, 2].map((i) => {
              const r = RING - 10 - i * (vertical ? 20 : 16);
              const seg = (2 * Math.PI * r) / 3;
              const p = clamp(ring * 1.15 - i * 0.14);
              return (
                <circle
                  key={i}
                  cx={RING}
                  cy={RING}
                  r={r}
                  fill="none"
                  stroke={i === 0 ? C.emeraldLit : i === 1 ? C.amber : 'rgba(241,233,220,0.42)'}
                  strokeWidth={vertical ? 7 : 5.5}
                  strokeLinecap="round"
                  strokeDasharray={`${seg * 0.86} ${seg * 0.2} ${seg * 0.86} 999`}
                  strokeDashoffset={seg * 3 * (1 - p)}
                  opacity={0.55 + 0.45 * p}
                />
              );
            })}
          </svg>

          {/* the number, lit from inside */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              transform: `scale(${1 + 0.03 * settle})`,
              filter: `drop-shadow(0 12px 40px rgba(54,196,160,${0.16 + 0.2 * land}))`,
            }}
          >
            <span
              style={{
                fontFamily: FONT.tajawal,
                fontWeight: 800,
                fontSize: vertical ? 236 : 206,
                lineHeight: 1,
                letterSpacing: 0,
                fontVariantNumeric: 'tabular-nums',
                backgroundImage: `linear-gradient(160deg, #FFF7E8 0%, #F1E9DC 42%, ${C.emeraldLit} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {value}
            </span>
            {stat.suffix ? (
              <span style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: vertical ? 58 : 48, color: C.emeraldLit, lineHeight: 1}}>
                {stat.suffix}
              </span>
            ) : null}
          </div>

          {/* orbiting sparks */}
          {[0, 1, 2].map((i) => {
            const a = (frame / (46 - i * 6)) * Math.PI * 2 + (i * Math.PI * 2) / 3;
            const r = RING - 10 - i * (vertical ? 20 : 16);
            const dot = clamp(ring * 1.2 - 0.2 - i * 0.1);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: RING + Math.cos(a) * r - 6,
                  top: RING + Math.sin(a) * r - 6,
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: i === 1 ? C.amber : C.emeraldLit,
                  boxShadow: `0 0 18px ${i === 1 ? C.amber : C.emeraldLit}`,
                  opacity: dot,
                  transform: `scale(${0.6 + 0.4 * dot})`,
                }}
              />
            );
          })}
        </div>

        {steps.length ? (
          <div style={{display: 'flex', gap: vertical ? 12 : 14, marginTop: vertical ? 2 : 0}}>
            {steps.map((s, i) => {
              const e = sp(frame, fps, 30 + i * 6, {damping: 17, stiffness: 170});
              const o = clamp(e);
              return (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: vertical ? '12px 20px' : '11px 20px',
                    borderRadius: 999,
                    background: 'rgba(241,233,220,0.07)',
                    border: '1px solid rgba(241,233,220,0.16)',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 16px 40px -22px rgba(0,0,0,0.7)',
                    transform: `translateY(${(1 - o) * 16}px) scale(${0.9 + 0.1 * o})`,
                    opacity: o,
                  }}
                >
                  <span
                    style={{
                      width: vertical ? 30 : 26,
                      height: vertical ? 30 : 26,
                      borderRadius: 999,
                      background: i === 0 ? C.emeraldLit : i === 1 ? C.amber : 'rgba(241,233,220,0.72)',
                      color: i === 0 ? '#0B2B24' : i === 1 ? '#2A1B02' : '#161310',
                      fontFamily: FONT.tajawal,
                      fontSize: vertical ? 16 : 14,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{fontFamily: FONT.tajawal, fontSize: vertical ? 27 : 24, fontWeight: 700, color: C.parchment}}>{s}</span>
                  <Ico name={STEP_ICONS[i] ?? 'bolt'} size={vertical ? 22 : 20} color="rgba(241,233,220,0.55)" />
                </div>
              );
            })}
          </div>
        ) : null}

        {beat.line1 ? (
          <div style={{...entStyle(entrance(frame, 44, {dist: 12, dur: 28})), marginTop: vertical ? 2 : -4}}>
            <Ar
              text={beat.line1}
              size={vertical ? 46 : 40}
              weight={500}
              color={C.parchmentSoft}
              align="center"
              lh={1.4}
              delay={44}
              emphasis={beat.emphasis}
              emphasisColor={C.emeraldLit}
              mode="words"
            />
          </div>
        ) : null}

      </AbsoluteFill>

      <AbsoluteFill style={{background: 'rgba(255,250,236,1)', opacity: flash, mixBlendMode: 'screen', pointerEvents: 'none'}} />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 180px 40px rgba(6,4,2,0.55)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

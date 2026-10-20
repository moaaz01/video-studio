import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow, Dots} from '../components/Surfaces';
import {C, FONT} from '../theme';
import {countUp, entStyle, entrance, tween, E} from '../lib/anim';
import type {SceneProps} from '../film/types';

/**
 * `#data`: one number, counted, landed, then its label. Three things on screen,
 * one idea. The ring is context, not decoration.
 */
export const Stat: React.FC<SceneProps> = ({beat, vertical}) => {
  const frame = useCurrentFrame();
  const stat = beat.stat ?? {from: 0, to: 0, suffix: '', label: ''};
  const local = frame;
  const value = countUp(local, 10, 40, stat.to, stat.from);
  const ring = tween(local, 8, 44, E.outQuart);
  const settle = tween(local, 46, 14, E.outQuart);
  const label = entrance(local, 46, {dist: 14, dur: 26});

  const RING = vertical ? 300 : 250;

  return (
    <AbsoluteFill>
      <Ground tone="ink" grain={0.06} vignette={0.44}>
        <Dots gap={vertical ? 54 : 46} color={C.parchment} opacity={0.10} size={2} />
        <Glow x={vertical ? 240 : 660} y={vertical ? 420 : 140} r={720} color={C.emerald} opacity={0.20} />
      </Ground>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: vertical ? 30 : 22}}>
        <div style={{...entStyle(entrance(frame, 0, {dist: 10, dur: 22}))}}>
          <Kicker text={beat.kicker ?? ''} color={C.emeraldLit} size={vertical ? 30 : 26} align="center" />
        </div>

        <div style={{position: 'relative', width: RING * 2, height: RING * 2, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width={RING * 2} height={RING * 2} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
            <circle cx={RING} cy={RING} r={RING - 8} fill="none" stroke="rgba(241,233,220,0.12)" strokeWidth={vertical ? 10 : 8} />
            <circle
              cx={RING}
              cy={RING}
              r={RING - 8}
              fill="none"
              stroke={C.emeraldLit}
              strokeWidth={vertical ? 10 : 8}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * (RING - 8)}
              strokeDashoffset={2 * Math.PI * (RING - 8) * (1 - 0.78 * ring)}
            />
          </svg>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              transform: `scale(${1 + 0.02 * settle})`,
            }}
          >
            <span
              style={{
                fontFamily: FONT.tajawal,
                fontWeight: 800,
                fontSize: vertical ? 168 : 150,
                lineHeight: 1,
                color: C.parchment,
                letterSpacing: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </span>
            {stat.suffix ? (
              <span style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: vertical ? 52 : 44, color: C.emeraldLit, lineHeight: 1}}>
                {stat.suffix}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{...entStyle(label), width: vertical ? 860 : 900}}>
          <Ar text={stat.label} size={vertical ? 46 : 38} weight={500} color={C.parchmentSoft} align="center" lh={1.45} delay={46} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

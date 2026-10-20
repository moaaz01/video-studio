import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow} from '../components/Surfaces';
import {C, FONT, LAYOUT, VIDEO} from '../theme';
import {entStyle, entrance, tween, E} from '../lib/anim';
import {AppIcon} from '../components/Brand';
import {BRAND} from '../brand';
import type {SceneProps} from '../film/types';

/**
 * `#kinetic` hook: the claim, alone, at display size. Words arrive as units —
 * never letters (Arabic joins), never more than one idea per beat.
 */
export const Hook: React.FC<SceneProps> = ({beat, vertical}) => {
  const frame = useCurrentFrame();
  const rule = tween(frame, 12, 34, E.outQuart);

  return (
    <AbsoluteFill>
      <Ground tone="ink" grain={0.07} vignette={0.42}>
        <Glow x={vertical ? -180 : 1080} y={-260} r={760} color={C.emerald} opacity={0.18} />
        <Glow x={vertical ? 640 : -220} y={vertical ? 1180 : 620} r={620} color={C.amber} opacity={0.10} />
      </Ground>

      <AbsoluteFill
        style={{
          alignItems: vertical ? 'center' : 'center',
          justifyContent: 'center',
          padding: vertical ? '0 92px' : `0 ${LAYOUT.marginX}px`,
        }}
      >
        <div style={{width: '100%', maxWidth: vertical ? 900 : 1180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vertical ? 34 : 26}}>
          <div style={{...entStyle(entrance(frame, 0, {dist: 12, dur: 24}))}}>
            <Kicker text={beat.kicker ?? ''} color={C.emeraldLit} size={vertical ? 30 : 26} align="center" />
          </div>

          <div
            style={{
              width: rule * (vertical ? 180 : 240),
              height: 3,
              background: C.emeraldLit,
              opacity: 0.9,
              borderRadius: 2,
            }}
          />

          <Ar
            text={beat.line1 ?? ''}
            size={vertical ? 92 : 104}
            weight={800}
            color={C.parchment}
            align="center"
            lh={1.22}
            delay={8}
            step={3}
            dur={34}
          />

          {beat.line2 ? (
            <div style={{...entStyle(entrance(frame, 26, {dist: 16, dur: 30}))}}>
              <Ar text={beat.line2} size={vertical ? 46 : 40} weight={500} color={C.parchmentSoft} align="center" lh={1.4} delay={26} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          bottom: vertical ? 120 : 64,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          ...entStyle(entrance(frame, 34, {dist: 10, dur: 26})),
        }}
      >
        <AppIcon size={vertical ? 44 : 36} />
        <span style={{fontFamily: FONT.tajawal, fontSize: vertical ? 30 : 24, fontWeight: 700, color: 'rgba(241,233,220,0.72)'}}>
          {BRAND.name}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const HOOK_FRAMES = VIDEO.fps * 6;

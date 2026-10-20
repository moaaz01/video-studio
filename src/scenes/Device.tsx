import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow} from '../components/Surfaces';
import {DpCtx, Phone} from '../components/Phone';
import {Ico} from '../components/Ico';
import {DEMO, DemoUI} from '../components/DemoUI';
import {C, FONT, LAYOUT, VIDEO, shadow} from '../theme';
import {entStyle, entrance, sp} from '../lib/anim';
import type {SceneProps} from '../film/types';

const VW = 1080;
const CARD_W = 668;
/** Device width in px, and the dp scale of what is inside the bezel. */
const PHONE_W = 470;
const BEZEL = Math.max(6, Math.round(9 * (PHONE_W / 412)));
const SCREEN_DP = (PHONE_W - 2 * BEZEL) / 412;
const CARD_SCALE = CARD_W / 412;
const CARD_H = Math.round(915 * CARD_SCALE);
const CARD_TOP = 96;

/**
 * `#device`: the product as the hero. The UI is a real screen at a real scale —
 * the phone is the frame, the copy lives outside it and never on top of it.
 */
export const Device: React.FC<SceneProps> = ({beat, vertical}) => {
  const frame = useCurrentFrame();
  const dp = CARD_SCALE;

  const copy = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: vertical ? 'center' : 'flex-start', gap: vertical ? 12 : 18}}>
      <Kicker text={beat.kicker ?? ''} color={C.emeraldDeep} size={vertical ? 26 : 24} align={vertical ? 'center' : 'right'} />
      <Ar
        text={beat.line1 ?? ''}
        size={vertical ? 62 : 62}
        weight={800}
        color={C.ink}
        align={vertical ? 'center' : 'right'}
        lh={1.28}
        delay={10}
        step={3}
        dur={30}
      />
      {beat.line2 ? (
        <Ar text={beat.line2} size={vertical ? 36 : 32} weight={500} color={C.inkSoft} align={vertical ? 'center' : 'right'} lh={1.5} delay={20} />
      ) : null}
      {!vertical ? (
        <div style={{display: 'flex', gap: 10, marginTop: 8}}>
          {DEMO.tiles.slice(0, 3).map((t, i) => (
            <div
              key={t.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 999,
                background: C.paperRaised,
                border: `1px solid ${C.hairline}`,
                boxShadow: shadow.card,
                ...entStyle(entrance(frame, 30 + i * 5, {dist: 10, dur: 24})),
              }}
            >
              <Ico name={t.icon} size={18} color={t.tone} />
              <span style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: 18, color: C.inkSoft}}>{t.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  const screen = (
    <div dir="rtl" lang="ar" style={{width: 412 * dp, height: 915 * dp, overflow: 'hidden'}}>
      <div style={{transform: `scale(${dp})`, transformOrigin: 'top right', width: 412, height: 915}}>
        <DpCtx.Provider value={1}>
          <DemoUI />
        </DpCtx.Provider>
      </div>
    </div>
  );

  if (vertical) {
    const enter = sp(frame, VIDEO.fps, 4, {damping: 22, stiffness: 120});
    return (
      <AbsoluteFill style={{background: C.paper}}>
        <Ground tone="paper" ruled grain={0.04} vignette={0.0} />
        <AbsoluteFill style={{alignItems: 'center'}}>
          <div
            style={{
              position: 'absolute',
              top: CARD_TOP,
              left: (VW - CARD_W) / 2,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 46,
              overflow: 'hidden',
              border: '1.5px solid rgba(255,255,255,0.11)',
              boxShadow: '0 40px 90px -30px rgba(26,42,54,0.45)',
              transform: `translateY(${(1 - enter) * 26}px) scale(${0.985 + 0.015 * enter})`,
              opacity: enter,
              background: C.paper,
            }}
          >
            {screen}
          </div>

          <div
            style={{
              position: 'absolute',
              top: CARD_TOP + CARD_H + 34,
              left: 96,
              right: 96,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              opacity: Math.min(1, enter * 1.2),
            }}
          >
            {copy}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const enter = sp(frame, VIDEO.fps, 2, {damping: 20, stiffness: 110});
  return (
    <AbsoluteFill>
      <Ground tone="paper" ruled grain={0.05} vignette={0.30}>
        <Glow x={1180} y={-180} r={640} color={C.emeraldSoft} opacity={0.55} />
        <Glow x={-260} y={760} r={560} color={C.amberSoft} opacity={0.5} />
      </Ground>

      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${LAYOUT.marginX}px`}}>
        <div
          style={{
            transform: `translateY(${(1 - enter) * 34}px)`,
            opacity: Math.min(1, enter * 1.15),
          }}
        >
          <Phone width={PHONE_W}>
            <DpCtx.Provider value={SCREEN_DP}>
              <DemoUI />
            </DpCtx.Provider>
          </Phone>
        </div>

        <div style={{width: 760, display: 'flex', justifyContent: 'flex-end'}}>{copy}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

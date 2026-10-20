import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow} from '../components/Surfaces';
import {DpCtx, Phone} from '../components/Phone';
import {Ico} from '../components/Ico';
import {StudyAIScreen} from '../components/StudyAIScreen';
import AR from '../generated/studyai-ar.json';

/** The app's own quick actions, verbatim from `values-ar/strings_sample.xml`. */
const QUICK = [
  {label: AR.keys.samp_quick_action_chat.ar, icon: 'forum', tone: C.emeraldDeep},
  {label: AR.keys.samp_quick_action_summary.ar, icon: 'summarize', tone: C.amber},
  {label: AR.keys.samp_quick_action_quiz.ar, icon: 'quiz', tone: C.coral},
  {label: AR.keys.samp_quick_action_diagram.ar, icon: 'gridView', tone: C.plum},
];
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
  const {width: canvasW, height: canvasH} = useVideoConfig();
  /**
   * 9:16 has room for the 1484px card; 4:5 and 1:1 do not. Instead of cropping
   * the wide film (which clips Arabic type), the card is recomputed from the
   * canvas: a real layout per aspect, same scene, same UI.
   */
  const compact = vertical && canvasH < 1700;
  /**
   * Reels, Shorts and Stories paint their own UI over the top 150px and the
   * bottom 300px of a 1920-tall frame. The phone may pass under it; the copy may
   * not. So the vertical master lays out inside the safe box, and the film says
   * so out loud: `scripts/safe_area.py --preset reels` is the gate.
   */
  const safeTop = vertical ? Math.round((canvasH * 150) / 1920) : 0;
  const safeBottom = vertical ? Math.round((canvasH * 300) / 1920) : 0;
  const copySpace = vertical ? 390 : 0; // measured: kicker + two lines + the entrance offset
  const safeCardH = vertical ? canvasH - safeTop - 34 - copySpace - safeBottom : CARD_H;
  const cardH = compact ? Math.min(1120, Math.max(540, canvasH - 360)) : Math.min(CARD_H, safeCardH);
  const cardW = compact ? Math.min(canvasW - 96, Math.round((cardH * 412) / 915)) : Math.min(CARD_W, Math.round((cardH * 412) / 915));
  const cardTop = compact ? Math.round(canvasH * 0.055) : vertical ? safeTop : CARD_TOP;
  const cardScale = cardW / 412;
  const sizeRatio = cardW / CARD_W;
  const dp = CARD_SCALE;

  const copy = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: vertical ? 'center' : 'flex-start', gap: vertical ? 12 : 18}}>
      <Kicker text={beat.kicker ?? ''} color={C.emeraldDeep} size={compact ? 22 : Math.max(20, Math.round(26 * sizeRatio))} align={vertical ? 'center' : 'right'} />
      <Ar
        text={beat.line1 ?? ''}
        size={compact ? Math.max(40, Math.round(62 * sizeRatio)) : Math.round(62 * sizeRatio)}
        weight={800}
        color={C.ink}
        align={vertical ? 'center' : 'right'}
        lh={1.28}
        delay={10}
        step={3}
        dur={30}
      />
      {beat.line2 ? (
        <Ar text={beat.line2} size={compact ? Math.max(26, Math.round(36 * sizeRatio)) : Math.round(36 * sizeRatio)} weight={500} color={C.inkSoft} align={vertical ? 'center' : 'right'} lh={1.5} delay={20} />
      ) : null}
      {!vertical ? (
        <div style={{display: 'flex', gap: 10, marginTop: 8}}>
          {QUICK.slice(0, 3).map((t, i) => (
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

  if (vertical) {
    const enter = sp(frame, VIDEO.fps, 4, {damping: 22, stiffness: 120});
    const card = {width: cardW, height: Math.round((cardW * 915) / 412)};
    return (
      <AbsoluteFill style={{background: C.paper}}>
        <Ground tone="paper" ruled grain={0.04} vignette={0.0} />
        <AbsoluteFill style={{alignItems: 'center'}}>
          <div
            style={{
              position: 'absolute',
              top: cardTop,
              left: (canvasW - card.width) / 2,
              width: card.width,
              height: card.height,
              borderRadius: 46,
              overflow: 'hidden',
              border: '1.5px solid rgba(255,255,255,0.11)',
              boxShadow: '0 40px 90px -30px rgba(26,42,54,0.45)',
              transform: `translateY(${(1 - enter) * 26}px) scale(${0.985 + 0.015 * enter})`,
              opacity: enter,
              background: C.paper,
            }}
          >
            <div dir="rtl" lang="ar" style={{width: 412 * cardScale, height: 915 * cardScale, overflow: 'hidden'}}>
              <div style={{transform: `scale(${cardScale})`, transformOrigin: 'top right', width: 412, height: 915}}>
                <DpCtx.Provider value={1}>
                  <StudyAIScreen variant={beat.screen ?? 'home'} />
                </DpCtx.Provider>
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: cardTop + card.height + (compact ? 22 : 34),
              left: compact ? 56 : 96,
              right: compact ? 56 : 96,
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

      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            position: 'absolute',
            left: 430,
            top: '50%',
            marginTop: -((470 / 412) * 915) / 2,
            transform: `translateY(${(1 - enter) * 34}px)`,
            opacity: Math.min(1, enter * 1.15),
          }}
        >
          <Phone width={PHONE_W}>
            <DpCtx.Provider value={SCREEN_DP}>
              <StudyAIScreen variant={beat.screen ?? 'home'} />
            </DpCtx.Provider>
          </Phone>
        </div>

        <div style={{position: 'absolute', left: 1036, top: '50%', width: 800, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'flex-end'}}>
          {copy}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

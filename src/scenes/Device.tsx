import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow, OrbitRing, CornerMarks} from '../components/Surfaces';
import {DpCtx, Phone} from '../components/Phone';
import {Ico} from '../components/Ico';
import {StudyAIScreen} from '../components/StudyAIScreen';
import {C, FONT, R, VIDEO, shadow} from '../theme';
import {clamp, entStyle, entrance, pulse, sp, tween, E} from '../lib/anim';
import AR from '../generated/studyai-ar.json';
import type {SceneProps} from '../film/types';

const A = AR.keys;
const VW = 1080;
const CARD_W = 668;
/** Device width in px, and the dp scale of what is inside the bezel. */
const PHONE_W = 460;
const BEZEL = Math.max(6, Math.round(9 * (PHONE_W / 412)));
const SCREEN_DP = (PHONE_W - 2 * BEZEL) / 412;
const CARD_SCALE = CARD_W / 412;
const CARD_H = Math.round(915 * CARD_SCALE);
const CARD_TOP = 96;

/** The app's own quick actions, verbatim from `values-ar/strings_sample.xml`. */
const QUICK = [
  {label: A.samp_quick_action_chat.ar, icon: 'forum', tone: C.emeraldDeep, soft: C.emeraldSoft},
  {label: A.samp_quick_action_summary.ar, icon: 'summarize', tone: C.amber, soft: C.amberSoft},
  {label: A.samp_quick_action_quiz.ar, icon: 'quiz', tone: C.coral, soft: C.coralSoft},
  {label: A.samp_quick_action_diagram.ar, icon: 'gridView', tone: C.plum, soft: C.plumSoft},
];

/**
 * A card that floats over the phone's edge. Every word in it comes from the
 * app's own resources, so a viewer can find the same strings in the product.
 */
const FloatCard: React.FC<{
  x: number;
  y: number;
  w: number;
  frame: number;
  delay: number;
  phase: number;
  motion: number;
  rotate?: number;
  children: React.ReactNode;
}> = ({x, y, w, frame, delay, phase, motion, rotate = 0, children}) => {
  const enter = sp(frame, VIDEO.fps, delay, {damping: 18, stiffness: 150});
  const o = clamp(enter);
  const bob = Math.sin(frame / 24 + phase) * 5 * motion;
  const tilt = rotate + Math.sin(frame / 34 + phase) * 0.8 * motion;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + bob,
        width: w,
        transform: `translateY(${(1 - o) * 26}px) rotate(${tilt}deg) scale(${0.94 + 0.06 * o})`,
        opacity: Math.min(1, o * 1.3),
        borderRadius: 22,
        background: 'rgba(255,253,248,0.94)',
        border: '1px solid rgba(26,42,54,0.10)',
        boxShadow: shadow.float,
        backdropFilter: 'blur(8px)',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};

const CardHead: React.FC<{label: string; tone: string; soft: string; icon: string}> = ({label, tone, soft, icon}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10}}>
    <div style={{width: 34, height: 34, borderRadius: 11, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <Ico name={icon} size={19} color={tone} />
    </div>
    <span style={{fontFamily: FONT.tajawal, fontSize: 13, fontWeight: 700, color: C.inkFaint, letterSpacing: 0}}>{label}</span>
  </div>
);

/**
 * `#device`: the product as the hero. A real screen at a real scale, opening out
 * of the paper with layered proof cards; the copy lives outside the phone and
 * never on top of it.
 */
export const Device: React.FC<SceneProps> = ({beat, vertical, motion = 1}) => {
  const frame = useCurrentFrame();
  const {width: canvasW, height: canvasH} = useVideoConfig();
  const screen = beat.screen ?? 'home';
  /**
   * 9:16 has room for the 1484px card; 4:5 and 1:1 do not. Instead of cropping
   * the wide film (which clips Arabic type), the card is recomputed from the
   * canvas: a real layout per aspect, same scene, same UI.
   */
  const compact = vertical && canvasH < 1700;
  const safeTop = vertical ? Math.round((canvasH * 150) / 1920) : 0;
  const safeBottom = vertical ? Math.round((canvasH * 300) / 1920) : 0;
  const copySpace = vertical ? 430 : 0;
  const safeCardH = vertical ? canvasH - safeTop - 34 - copySpace - safeBottom : CARD_H;
  const cardH = compact ? Math.round(canvasH * 0.6) : Math.min(CARD_H, safeCardH);
  const cardW = compact ? Math.min(canvasW - 96, Math.round((cardH * 412) / 915)) : Math.min(CARD_W, Math.round((cardH * 412) / 915));
  const cardTop = compact ? Math.round(canvasH * 0.055) : vertical ? safeTop : CARD_TOP;
  const cardScale = cardW / 412;
  const sizeRatio = cardW / CARD_W;

  const enterPhone = sp(frame, VIDEO.fps, 2, {damping: 20, stiffness: 110});
  const headlineSize = compact ? Math.max(42, Math.round(64 * sizeRatio)) : Math.round(74 * sizeRatio);

  const copy = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: vertical ? 'center' : 'stretch', gap: vertical ? 14 : 20, width: '100%'}}>
      <Kicker text={beat.kicker ?? ''} color={C.emeraldDeep} size={compact ? 22 : 25} align={vertical ? 'center' : 'right'} />
      <Ar
        text={beat.line1 ?? ''}
        size={headlineSize}
        weight={800}
        color={C.ink}
        align={vertical ? 'center' : 'right'}
        lh={1.28}
        delay={10}
        step={3}
        dur={32}
        emphasis={beat.emphasis}
        emphasisColor={C.emeraldDeep}
        mode="words"
      />
      {beat.line2 ? (
        <Ar
          text={beat.line2}
          size={compact ? Math.max(26, Math.round(34 * sizeRatio)) : Math.round(33 * sizeRatio)}
          weight={500}
          color={C.inkSoft}
          align={vertical ? 'center' : 'right'}
          lh={1.5}
          delay={20}
          step={2}
        />
      ) : null}

      <div style={{height: 1, width: vertical ? '70%' : 420, background: 'rgba(26,42,54,0.14)', marginTop: vertical ? 4 : 6, transform: `scaleX(${tween(frame, 26, 22, E.outQuart)})`, transformOrigin: 'right'}} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: vertical ? 10 : 12,
          width: vertical ? '100%' : 760,
          maxWidth: vertical ? 760 : undefined,
        }}
      >
        {QUICK.map((q, i) => {
          const e = entrance(frame, 30 + i * 4, {dist: 14, dur: 24});
          return (
            <div
              key={q.label}
              style={{
                ...entStyle(e),
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: compact ? '10px 14px' : '13px 16px',
                borderRadius: 16,
                background: 'rgba(255,253,248,0.86)',
                border: '1px solid rgba(26,42,54,0.09)',
                boxShadow: shadow.card,
              }}
            >
              <div style={{width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: 12, background: q.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Ico name={q.icon} size={compact ? 19 : 22} color={q.tone} />
              </div>
              <span style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: compact ? 20 : 22, color: C.ink, letterSpacing: 0}}>{q.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (vertical) {
    const enter = sp(frame, VIDEO.fps, 4, {damping: 22, stiffness: 120});
    return (
      <AbsoluteFill>
        <Ground tone="paper" variant="paper-glow" grain={0.04} vignette={0.22} />
        <CornerMarks color="rgba(26,42,54,0.16)" inset={compact ? 26 : 40} />
        <AbsoluteFill style={{alignItems: 'center'}}>
          <div
            style={{
              position: 'absolute',
              top: cardTop,
              left: (canvasW - cardW) / 2,
              width: cardW,
              height: Math.round((cardW * 915) / 412),
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
                  <StudyAIScreen variant={screen} />
                </DpCtx.Provider>
              </div>
            </div>
          </div>

          {/* floating proof, over the card's edges */}
          <FloatCard x={28} y={cardTop + 54} w={300} frame={frame} delay={10} phase={0.4} motion={motion} rotate={-2.5}>
            <CardHead label={A.cmp_doc_state_ready.ar} tone={C.emeraldDeep} soft={C.emeraldSoft} icon="descriptionOutline" />
            <div style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: 19, color: C.ink, lineHeight: 1.35, textAlign: 'right'}} dir="rtl">
              {A.samp_doc_d2_title.ar}
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 8}}>
              <div style={{flex: 1, height: 5, borderRadius: 999, background: C.paperSunken, overflow: 'hidden'}}>
                <div style={{width: `${40 + 38 * tween(frame, 16, 26, E.outQuart)}%`, height: '100%', borderRadius: 999, background: C.emerald}} />
              </div>
              <span style={{fontFamily: FONT.tajawal, fontSize: 12, fontWeight: 700, color: C.emeraldDeep}}>{A.home_mastery_percent.ar.replace('%1$s', '78')}</span>
            </div>
          </FloatCard>

          <div
            style={{
              position: 'absolute',
              top: cardTop + (compact ? 300 : 330),
              left: canvasW - 44 - 288,
              width: 288,
              transform: `translateY(${(1 - sp(frame, VIDEO.fps, 18, {damping: 18, stiffness: 150})) * 24}px) rotate(2.2deg)`,
              opacity: Math.min(1, sp(frame, VIDEO.fps, 18, {damping: 18, stiffness: 150}) * 1.3),
              borderRadius: 18,
              background: 'rgba(255,253,248,0.95)',
              border: '1px solid rgba(26,42,54,0.10)',
              boxShadow: shadow.float,
              padding: 14,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
              <Ico name="descriptionOutline" size={18} color={C.emeraldDeep} />
              <span style={{fontFamily: FONT.tajawal, fontSize: 13, fontWeight: 700, color: C.inkFaint}}>{A.quiz_page_reference.ar.replace('%1$s', '42')}</span>
            </div>
            <div style={{fontFamily: FONT.tajawal, fontSize: 15, fontWeight: 500, color: C.inkSoft, lineHeight: 1.45, textAlign: 'right'}} dir="rtl">
              {A.samp_doc_d1_title.ar}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: cardTop + Math.round((cardW * 915) / 412) + (compact ? 18 : 28),
              left: compact ? 46 : 96,
              right: compact ? 46 : 96,
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

  const ringR = 470;
  return (
    <AbsoluteFill>
      <Ground tone="paper" variant="paper-glow" ruled grain={0.05} vignette={0.34}>
        <Glow x={1120} y={-140} r={680} color={C.emeraldSoft} opacity={0.6} />
        <Glow x={-240} y={820} r={600} color={C.amberSoft} opacity={0.55} />
      </Ground>
      <CornerMarks color="rgba(26,42,54,0.16)" inset={44} />

      <AbsoluteFill style={{alignItems: 'center'}}>
        {/* the phone's stage: rings, then the device, then the floating proof */}
        <div style={{position: 'absolute', left: 545, top: '50%', width: PHONE_W + 120, height: PHONE_W + 120, marginTop: -(PHONE_W + 120) / 2, transform: 'translateX(-50%)'}}>
          <OrbitRing size={ringR * 2} color="rgba(14,138,110,0.20)" dash={5} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 545,
            top: '50%',
            marginTop: -((PHONE_W / 412) * 915) / 2,
            transform: `translateX(-50%) translateY(${(1 - enterPhone) * 34 + Math.sin(frame / 30) * 3 * motion}px)`,
            opacity: Math.min(1, enterPhone * 1.15),
            zIndex: 10,
          }}
        >
          <Phone width={PHONE_W} rotateY={-4} rotateX={1.2} rotateZ={-0.6} glowStrength={0.7}>
            <DpCtx.Provider value={SCREEN_DP}>
              <StudyAIScreen variant={screen} />
            </DpCtx.Provider>
          </Phone>
        </div>

        <FloatCard x={38} y={150} w={272} frame={frame} delay={14} phase={0.2} motion={motion} rotate={-2.4}>
          <CardHead label={A.cmp_doc_state_ready.ar} tone={C.emeraldDeep} soft={C.emeraldSoft} icon="descriptionOutline" />
          <div style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: 20, color: C.ink, lineHeight: 1.35, textAlign: 'right'}} dir="rtl">
            {A.samp_doc_d2_title.ar}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 10}}>
            <div style={{flex: 1, height: 5, borderRadius: 999, background: C.paperSunken, overflow: 'hidden'}}>
              <div style={{width: `${40 + 38 * tween(frame, 20, 30, E.outQuart)}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.emerald}, ${C.emeraldLit})`}} />
            </div>
            <span style={{fontFamily: FONT.tajawal, fontSize: 12, fontWeight: 800, color: C.emeraldDeep}}>{A.home_mastery_percent.ar.replace('%1$s', '78')}</span>
          </div>
        </FloatCard>

        <FloatCard x={26} y={742} w={282} frame={frame} delay={24} phase={2.1} motion={motion} rotate={1.8}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Ico name="descriptionOutline" size={17} color={C.emeraldDeep} />
            <span style={{fontFamily: FONT.tajawal, fontSize: 13, fontWeight: 700, color: C.inkFaint}}>{A.quiz_page_reference.ar.replace('%1$s', '42')}</span>
          </div>
          <div style={{fontFamily: FONT.tajawal, fontWeight: 700, fontSize: 18, color: C.ink, marginTop: 6, lineHeight: 1.4, textAlign: 'right'}} dir="rtl">
            {A.samp_doc_d1_title.ar}
          </div>
          <div style={{display: 'flex', gap: 5, marginTop: 10}}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{flex: 1, height: 4, borderRadius: 999, background: i === 0 ? C.emerald : C.paperSunken}} />
            ))}
          </div>
        </FloatCard>

        <FloatCard x={1178} y={112} w={292} frame={frame} delay={30} phase={4.0} motion={motion} rotate={2.6}>
          <CardHead label={A.home_daily_goal_title.ar} tone={C.amber} soft={C.amberSoft} icon="bolt" />
          <div style={{fontFamily: FONT.tajawal, fontWeight: 800, fontSize: 34, color: C.ink, lineHeight: 1, textAlign: 'right'}} dir="rtl">
            {A.home_mastery_percent.ar.replace('%1$s', '60')}
          </div>
          <div style={{height: 7, borderRadius: 999, background: C.paperSunken, marginTop: 10, overflow: 'hidden'}}>
            <div style={{width: `${28 + 32 * tween(frame, 34, 32, E.outQuart)}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.amber}, #E8B356)`}} />
          </div>
          <div style={{fontFamily: FONT.tajawal, fontSize: 12, fontWeight: 500, color: C.inkFaint, marginTop: 7, textAlign: 'right'}} dir="rtl">
            {A.home_daily_goal_progress.ar.replace('%1$s', '3').replace('%2$s', '5')}
          </div>
        </FloatCard>

        {/* drifting pixels: dust in the light, not confetti */}
        {[0, 1, 2, 3, 4].map((i) => {
          const x = 220 + i * 132 + Math.sin(frame / 40 + i) * 16;
          const y = 150 + ((i * 173 + frame * 0.6 * motion) % 760);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: i % 2 ? 5 : 7,
                height: i % 2 ? 5 : 7,
                borderRadius: 999,
                background: i % 2 ? C.emerald : C.amber,
                opacity: 0.22 + 0.2 * pulse(frame, 60, i * 0.3),
                filter: 'blur(0.5px)',
              }}
            />
          );
        })}

        <div style={{position: 'absolute', left: 960, top: '50%', width: 860, transform: 'translateY(-50%)'}}>
          {copy}
        </div>

        {/* editorial scene numeral, barely there */}
        <div
          style={{
            position: 'absolute',
            right: 96,
            bottom: 40,
            fontFamily: FONT.tajawal,
            fontSize: 250,
            fontWeight: 800,
            lineHeight: 1,
            color: 'rgba(26,42,54,0.05)',
            letterSpacing: 0,
          }}
        >
          {screen === 'agent' ? '02' : '01'}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

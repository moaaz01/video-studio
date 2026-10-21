import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ar, Kicker} from '../components/Text';
import {Ground, Glow, CornerMarks, OrbitRing} from '../components/Surfaces';
import {Ico} from '../components/Ico';
import {C, FONT, LAYOUT, VIDEO, shadow} from '../theme';
import {clamp, entStyle, entrance, sp, tween, E} from '../lib/anim';
import {AppIcon} from '../components/Brand';
import {BRAND} from '../brand';
import AR from '../generated/studyai-ar.json';
import type {SceneProps} from '../film/types';

const A = AR.keys;

/** A document that drifts in the light behind the claim. */
const PaperCard: React.FC<{
  x: number;
  y: number;
  w: number;
  frame: number;
  delay: number;
  phase: number;
  rotate: number;
  title: string;
  tag: string;
  tone: string;
  soft: string;
  icon: string;
}> = ({x, y, w, frame, delay, phase, rotate, title, tag, tone, soft, icon}) => {
  const enter = sp(frame, VIDEO.fps, delay, {damping: 18, stiffness: 150});
  const o = clamp(enter);
  const bob = Math.sin(frame / 30 + phase) * 9;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + bob,
        width: w,
        padding: 16,
        boxSizing: 'border-box',
        borderRadius: 20,
        background: 'rgba(255,250,240,0.10)',
        border: '1px solid rgba(241,233,220,0.20)',
        boxShadow: '0 30px 70px -30px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        transform: `translateY(${(1 - o) * 30}px) rotate(${rotate + Math.sin(frame / 44 + phase) * 1.2}deg) scale(${0.95 + 0.05 * o})`,
        opacity: Math.min(1, o * 1.25),
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        <div style={{width: 36, height: 36, borderRadius: 11, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <Ico name={icon} size={20} color={tone} />
        </div>
        <span style={{fontFamily: FONT.tajawal, fontSize: 12, fontWeight: 700, color: 'rgba(241,233,220,0.55)'}}>{tag}</span>
      </div>
      <div style={{fontFamily: FONT.tajawal, fontSize: 18, fontWeight: 700, color: 'rgba(241,233,220,0.92)', marginTop: 10, textAlign: 'right', lineHeight: 1.4}} dir="rtl">
        {title}
      </div>
      <div style={{display: 'flex', gap: 6, marginTop: 10}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{height: 4, borderRadius: 999, flex: i === 0 ? 1.6 : 1, background: i === 0 ? 'rgba(54,196,160,0.55)' : 'rgba(241,233,220,0.14)'}} />
        ))}
      </div>
    </div>
  );
};

/**
 * `#kinetic` hook: the claim, alone, at display size. Words arrive as units —
 * never letters (Arabic joins), never more than one idea per beat. The paper
 * cards are the product's raw material floating in the same light.
 */
export const Hook: React.FC<SceneProps> = ({beat, vertical, motion = 1}) => {
  const frame = useCurrentFrame();
  const rule = tween(frame, 12, 34, E.outQuart);
  const ring = tween(frame, 4, 44, E.outQuart);

  return (
    <AbsoluteFill>
      <Ground tone="ink" variant="ink-aurora" grain={0.07} vignette={0.42}>
        <Glow x={vertical ? -180 : 1120} y={-260} r={820} color={C.emerald} opacity={0.22} />
        <Glow x={vertical ? 640 : -240} y={vertical ? 1180 : 660} r={680} color={C.amber} opacity={0.12} />
        <OrbitRing size={vertical ? 900 : 1180} color="rgba(241,233,220,0.10)" dash={4} />
      </Ground>
      <CornerMarks color="rgba(241,233,220,0.28)" inset={48} label="STUDYAI" />

      {/* the raw material of the product, drifting in the light */}
      <PaperCard
        x={vertical ? 36 : 96}
        y={vertical ? 300 : 250}
        w={vertical ? 250 : 300}
        frame={frame}
        delay={16}
        phase={0.4}
        rotate={-4.5}
        title={A.samp_doc_d1_title.ar}
        tag="PDF"
        tone={C.emeraldDeep}
        soft={C.emeraldSoft}
        icon="descriptionOutline"
      />
      <PaperCard
        x={vertical ? 792 : 1540}
        y={vertical ? 1180 : 640}
        w={vertical ? 252 : 300}
        frame={frame}
        delay={26}
        phase={2.3}
        rotate={5}
        title={A.samp_quick_action_quiz.ar}
        tag={A.quiz_page_reference.ar.replace('%1$s', '42')}
        tone={C.coral}
        soft={C.coralSoft}
        icon="quiz"
      />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          padding: vertical ? '0 88px' : `0 ${LAYOUT.marginX}px`,
        }}
      >
        <div style={{width: '100%', maxWidth: vertical ? 920 : 1240, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vertical ? 34 : 28}}>
          <div style={{...entStyle(entrance(frame, 0, {dist: 12, dur: 24}))}}>
            <Kicker text={beat.kicker ?? ''} color={C.emeraldLit} size={vertical ? 30 : 26} align="center" />
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: ring}}>
            <div style={{width: rule * (vertical ? 150 : 210), height: 3, background: C.emeraldLit, opacity: 0.9, borderRadius: 2}} />
            <div style={{width: 8, height: 8, borderRadius: 999, background: C.amber, transform: `scale(${0.6 + 0.4 * ring})`}} />
            <div style={{width: rule * (vertical ? 150 : 210), height: 3, background: C.emeraldLit, opacity: 0.9, borderRadius: 2}} />
          </div>

          <Ar
            text={beat.line1 ?? ''}
            size={vertical ? 104 : 122}
            weight={800}
            color={C.parchment}
            align="center"
            lh={1.2}
            delay={8}
            step={3}
            dur={34}
            emphasis={beat.emphasis}
            emphasisColor={C.emeraldLit}
            mode="words"
          />

          {beat.line2 ? (
            <div style={{...entStyle(entrance(frame, 26, {dist: 16, dur: 30}))}}>
              <Ar text={beat.line2} size={vertical ? 48 : 42} weight={500} color={C.parchmentSoft} align="center" lh={1.45} delay={26} />
            </div>
          ) : null}

          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: vertical ? 4 : 0, ...entStyle(entrance(frame, 40, {dist: 8, dur: 24}))}}>
            <span style={{width: 26, height: 1, background: 'rgba(241,233,220,0.28)'}} />
            <span style={{fontFamily: FONT.tajawal, fontSize: vertical ? 20 : 17, fontWeight: 700, letterSpacing: 3, color: 'rgba(241,233,220,0.42)'}}>
              STUDYAI
            </span>
            <span style={{width: 26, height: 1, background: 'rgba(241,233,220,0.28)'}} />
          </div>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          bottom: vertical ? 300 : 62,
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
        <span style={{width: 1, height: 18, background: 'rgba(241,233,220,0.22)'}} />
        <span style={{fontFamily: FONT.tajawal, fontSize: vertical ? 25 : 21, fontWeight: 500, color: 'rgba(241,233,220,0.55)'}}>
          {BRAND.nameLocal}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const HOOK_FRAMES = VIDEO.fps * 6;

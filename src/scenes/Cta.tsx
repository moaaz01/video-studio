import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ar} from '../components/Text';
import {Ground, Glow, CornerMarks, OrbitRing} from '../components/Surfaces';
import {AppIcon, ContactChip, DownloadBadge, Wordmark} from '../components/Brand';
import {C, FONT} from '../theme';
import {clamp, entStyle, entrance, pulse, sp} from '../lib/anim';
import {BRAND} from '../brand';
import type {SceneProps} from '../film/types';

/**
 * The end card. One action, three times at most: the handle, the contact, the small
 * print. Nothing else competes — this is the frame that gets screenshotted.
 */
export const Cta: React.FC<SceneProps> = ({beat, vertical, motion = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = entrance(frame, 0, {dist: 18, dur: 30});
  const iconPop = sp(frame, fps, 2, {damping: 15, stiffness: 150});
  const breath = 0.5 + 0.5 * pulse(frame, 90);
  const sparkle = (i: number) => 0.25 + 0.35 * pulse(frame, 80 + i * 11, i * 0.17);

  return (
    <AbsoluteFill>
      <Ground tone="emerald" variant="emerald-depth" grain={0.05} vignette={0.34}>
        <Glow x={vertical ? 120 : 1180} y={vertical ? -180 : -220} r={vertical ? 820 : 720} color="#3FE0B4" opacity={0.26} />
        <Glow x={vertical ? -220 : 260} y={vertical ? 1260 : 820} r={vertical ? 760 : 640} color="#0A3E36" opacity={0.45} />
        <OrbitRing size={vertical ? 780 : 660} color="rgba(255,255,255,0.12)" dash={5} />
      </Ground>
      <CornerMarks color="rgba(255,255,255,0.30)" inset={48} label="STUDYAI" />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: vertical ? 30 : 22,
          padding: vertical ? '0 84px' : '0 120px',
        }}
      >
        <div style={{...entStyle(a), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vertical ? 24 : 18}}>
          <div style={{position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div
              style={{
                position: 'absolute',
                width: (vertical ? 168 : 140) * 1.55,
                height: (vertical ? 168 : 140) * 1.55,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
                transform: `scale(${0.94 + 0.1 * breath})`,
                opacity: 0.55 + 0.35 * breath,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: (vertical ? 168 : 140) * 1.9,
                height: (vertical ? 168 : 140) * 1.9,
                borderRadius: 999,
                background: 'radial-gradient(circle, rgba(63,224,180,0.22), transparent 68%)',
                opacity: 0.5 + 0.4 * breath,
                filter: 'blur(8px)',
              }}
            />
            <div style={{transform: `scale(${0.86 + 0.14 * clamp(iconPop)})`, opacity: Math.min(1, iconPop * 1.4)}}>
              <AppIcon size={vertical ? 168 : 140} />
            </div>
          </div>
          <Wordmark size={vertical ? 136 : 122} color="#FFFFFF" delay={6} />
          <span
            style={{
              fontFamily: FONT.tajawal,
              fontWeight: 500,
              fontSize: vertical ? 42 : 36,
              color: 'rgba(255,255,255,0.78)',
              letterSpacing: 0,
            }}
          >
            {BRAND.nameLocal}
          </span>
        </div>

        <div style={{...entStyle(entrance(frame, 16, {dist: 14, dur: 28})), width: vertical ? 840 : 920}}>
          <Ar text={beat.line1 ?? BRAND.tagline} size={vertical ? 52 : 46} weight={700} color="#FFFFFF" align="center" lh={1.4} delay={16} />
        </div>

        <div style={{...entStyle(entrance(frame, 30, {dist: 20, dur: 30})), marginTop: vertical ? 8 : 4, position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              inset: -10,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              opacity: 0.4 + 0.3 * pulse(frame, 64, 0.25),
              pointerEvents: 'none',
            }}
          />
          <DownloadBadge width={vertical ? 840 : 720} delay={30} />
        </div>

        <div style={{display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center'}}>
          {BRAND.contacts.map((c, i) => (
            <ContactChip key={c.value} contact={c} delay={44 + i * 6} width={vertical ? 400 : 390} />
          ))}
        </div>

        {BRAND.footnote ? (
          <span
            style={{
              ...entStyle(entrance(frame, 56, {dist: 8, dur: 24})),
              fontFamily: FONT.tajawal,
              fontWeight: 500,
              fontSize: vertical ? 30 : 26,
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: 0,
            }}
          >
            {beat.line2 ?? BRAND.footnote}
          </span>
        ) : null}
      </AbsoluteFill>

      {/* the light off the end card: a few slow sparks, not confetti */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 160 + i * 300 + Math.sin(frame / 50 + i * 1.4) * 26;
        const y = 140 + ((i * 210 + frame * 0.5 * motion) % 800);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: i % 2 ? 6 : 9,
              height: i % 2 ? 6 : 9,
              borderRadius: 999,
              background: '#EAFFF6',
              opacity: sparkle(i),
              boxShadow: '0 0 16px rgba(234,255,246,0.8)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

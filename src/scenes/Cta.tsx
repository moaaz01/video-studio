import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Ar} from '../components/Text';
import {Ground, Glow} from '../components/Surfaces';
import {AppIcon, ContactChip, DownloadBadge, Stamp, Wordmark} from '../components/Brand';
import {C, FONT} from '../theme';
import {entStyle, entrance} from '../lib/anim';
import {BRAND} from '../brand';
import type {SceneProps} from '../film/types';

/**
 * The end card. One action, three times at most: the handle, the contact, the small
 * print. Nothing else competes — this is the frame that gets screenshotted.
 */
export const Cta: React.FC<SceneProps> = ({beat, vertical}) => {
  const frame = useCurrentFrame();
  const a = entrance(frame, 0, {dist: 18, dur: 30});

  return (
    <AbsoluteFill>
      <Ground tone="emerald" grain={0.05} vignette={0.34}>
        <Glow x={vertical ? 120 : 1180} y={vertical ? -180 : -220} r={vertical ? 820 : 700} color="#3FE0B4" opacity={0.22} />
        <Glow x={vertical ? -220 : 260} y={vertical ? 1260 : 820} r={vertical ? 760 : 620} color="#0A3E36" opacity={0.4} />
      </Ground>

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
          <AppIcon size={vertical ? 168 : 140} />
          <Wordmark size={vertical ? 132 : 118} color="#FFFFFF" delay={6} />
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

        <div style={{...entStyle(entrance(frame, 16, {dist: 14, dur: 28})), width: vertical ? 840 : 900}}>
          <Ar text={beat.line1 ?? BRAND.tagline} size={vertical ? 52 : 46} weight={700} color="#FFFFFF" align="center" lh={1.4} delay={16} />
        </div>

        <div style={{...entStyle(entrance(frame, 30, {dist: 20, dur: 30})), marginTop: vertical ? 8 : 4}}>
          <DownloadBadge width={vertical ? 840 : 700} delay={30} />
        </div>

        <div style={{display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center'}}>
          {BRAND.contacts.map((c, i) => (
            <ContactChip key={c.value} contact={c} delay={44 + i * 6} width={vertical ? 400 : 380} />
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

      <div style={{position: 'absolute', top: vertical ? 150 : 64, right: vertical ? 60 : 96}}>
        <Stamp text="مجانًا" color="rgba(255,255,255,0.55)" size={vertical ? 52 : 44} rotate={-8} delay={62} />
      </div>
    </AbsoluteFill>
  );
};

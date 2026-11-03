import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ground} from '../components/Surfaces';
import {Ar} from '../components/Text';
import {Puppet, type Expression, type Look, type Pose} from '../components/Puppet';
import {FONT, C} from '../theme';
import {entrance, entStyle, sp, SPRING} from '../lib/anim';
import {mouthAt, stripTashkeel, talkingAt, type WordTiming} from '../lib/speech';
import type {SceneProps} from '../film/types';

/**
 * Character: a presenter speaks the beat's line, the line lands in a bubble
 * word by word as it is spoken, and an optional card carries the proof.
 *
 * The mouth is driven by the compiled VO word timings, so a beat without voice
 * keeps the mouth at rest instead of miming words nobody hears. RTL layout: the
 * presenter stands on the right and points left into the copy (`side` flips it).
 */

type Card = {title?: string; rows?: string[]};
type Data = {
  words?: WordTiming[];
  character?: Look & {name?: string};
  gestures?: {at: number; pose: Pose}[];
  pose?: Pose;
  expression?: Expression;
  side?: 'right' | 'left';
  card?: Card;
  bubble?: boolean;
};

const PAPER = '#FFFFFF';

export const Character: React.FC<SceneProps> = ({beat, vertical, preRoll = 0}) => {
  const frame = useCurrentFrame() - preRoll;
  const {fps, width, height} = useVideoConfig();
  const d = (beat.data ?? {}) as Data;
  const words = d.words ?? [];
  const t = frame / fps;
  const side = d.side ?? 'right';
  const dark = beat.tone !== 'paper';
  const gestures = d.gestures ?? [{at: 0, pose: d.pose ?? 'present'}];
  const line = stripTashkeel(beat.line1 ?? '');
  const shown = words.length ? words.filter((w) => t >= w.start).map((w) => w.w).join(' ') : line;

  const enter = sp(frame, fps, 0, SPRING.soft);
  const puppetH = vertical ? height * 0.52 : height * 0.92;
  const unit = Math.min(width, height) / 1080;
  const bubbleIn = entrance(frame, 6, {dur: 22, dist: 18});
  const cardIn = entrance(frame, 18, {dur: 24, dist: 18});

  const stage: React.CSSProperties = vertical
    ? {left: 0, right: 0, bottom: -height * 0.02, display: 'flex', justifyContent: 'center'}
    : {bottom: -height * 0.04, [side === 'right' ? 'right' : 'left']: width * 0.06};
  const copy: React.CSSProperties = vertical
    ? {top: height * 0.1, left: width * 0.07, right: width * 0.07}
    : {top: height * 0.16, [side === 'right' ? 'left' : 'right']: width * 0.07, width: width * 0.5};

  return (
    <AbsoluteFill>
      <Ground tone={beat.tone === 'emerald' ? 'emerald' : dark ? 'ink' : 'paper'} />
      <div style={{position: 'absolute', ...copy, display: 'flex', flexDirection: 'column', gap: 28 * unit}} dir="rtl">
        {beat.kicker ? (
          <div style={{...entStyle(entrance(frame, 0, {dur: 18, dist: 10})), fontFamily: FONT.tajawal, fontWeight: 700,
            fontSize: 30 * unit, color: dark ? C.amber : C.emerald}}>
            {beat.kicker}
          </div>
        ) : null}
        {line && d.bubble !== false ? (
          <div style={{...entStyle(bubbleIn), position: 'relative', background: PAPER, borderRadius: 36 * unit,
            padding: `${34 * unit}px ${40 * unit}px`, boxShadow: '0 24px 60px rgba(10,20,30,0.18)'}}>
            <Ar text={shown || ' '} size={(vertical ? 58 : 54) * unit} weight={700} color={C.ink} lh={1.4} />
            {!vertical && (
              <div style={{position: 'absolute', top: 70 * unit, [side === 'right' ? 'right' : 'left']: -22 * unit,
                width: 0, height: 0, borderTop: `${18 * unit}px solid transparent`, borderBottom: `${18 * unit}px solid transparent`,
                [side === 'right' ? 'borderLeft' : 'borderRight']: `${26 * unit}px solid ${PAPER}`}} />
            )}
          </div>
        ) : null}
        {d.card?.rows?.length ? (
          <div style={{...entStyle(cardIn), background: dark ? 'rgba(255,255,255,0.08)' : C.paperRaised,
            border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : C.hairline}`, borderRadius: 28 * unit, padding: 30 * unit}}>
            {d.card.title ? <Ar text={d.card.title} size={34 * unit} weight={700} color={dark ? '#fff' : C.ink} /> : null}
            {d.card.rows.map((r, i) => {
              const rowIn = entrance(frame, 24 + i * 6, {dur: 18, dist: 10});
              return (
                <div key={r} style={{...entStyle(rowIn), display: 'flex', alignItems: 'center', gap: 16 * unit, marginTop: 16 * unit}}>
                  <div style={{width: 14 * unit, height: 14 * unit, borderRadius: 99, background: C.amber, flexShrink: 0}} />
                  <Ar text={r} size={32 * unit} color={dark ? 'rgba(255,255,255,0.86)' : C.inkSoft} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', ...stage, transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter}}>
        <Puppet
          frame={Math.max(0, frame)}
          fps={fps}
          height={puppetH}
          look={d.character}
          gestures={gestures}
          expression={d.expression ?? 'happy'}
          mouth={mouthAt(words, t)}
          talking={talkingAt(words, t)}
          pointTo={vertical ? 'left' : side === 'right' ? 'left' : 'right'}
          seed={beat.id.length}
        />
      </div>
    </AbsoluteFill>
  );
};

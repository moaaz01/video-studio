import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import timelineJson from '../generated/timeline.json';
import {Flash, LightLeak} from '../components/Overlays';
import {FilmGrade} from '../look/FilmGrade';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {Camera, CAMERA_BY_KIND} from '../look/Camera';
import {resolveLook} from '../look/looks';
import {C} from '../theme';
import {clamp, E} from '../lib/anim';
import type {Beat, Film, TransitionName} from './types';
import {Hook} from '../scenes/Hook';
import {Device} from '../scenes/Device';
import {Stat} from '../scenes/Stat';
import {Cta} from '../scenes/Cta';
import {Captions} from './Captions';
import {Soundtrack} from '../audio/Soundtrack';

const T = timelineJson as unknown as Film;

/** 180-degree shutter: a camera only blurs what moves, so this is opt-in per look. */
const Shutter: React.FC<{look: {motionBlur: number}; children: React.ReactNode}> = ({look, children}) =>
  look.motionBlur > 0 ? (
    <CameraMotionBlur shutterAngle={180} samples={look.motionBlur}>
      {children}
    </CameraMotionBlur>
  ) : (
    <>{children}</>
  );

export const SCENES: Record<Beat['kind'], React.FC<{beat: Beat; vertical: boolean; motion?: number}>> = {
  hook: Hook,
  device: Device,
  stat: Stat,
  cta: Cta,
};

/**
 * A cut is a hand-off, not a curtain.
 *
 * Each beat is pre-rolled by PREROLL frames so its own entrance has already begun
 * when its voice starts, then hands over across OVER frames: the outgoing scene
 * leaves as the incoming one arrives, both painting at full size, so the frame is
 * never empty and a viewer reads one continuous move instead of a dip to paper.
 * The incoming scene is painted above (later sibling), and before its bar line it
 * sits fully outside the frame — the overlap is only ever a real transition.
 */
const PREROLL = 8;
const OVER = 10;

type Xf = {tx: number; scale: number; skew: number; blur: number; opacity: number};

const IDENTITY: Xf = {tx: 0, scale: 1, skew: 0, blur: 0, opacity: 1};

/** Incoming move; p is 0 at the bar line and 1 when the new scene owns the frame. */
const enterXf = (name: TransitionName | undefined, p: number): Xf => {
  if (!name) return IDENTITY;
  const k = 1 - E.outExpo(clamp(p));
  switch (name) {
    case 'slide':
      return {tx: -100 * k, scale: 1, skew: 0, blur: 0, opacity: 1};
    case 'whip':
      return {tx: -108 * k, scale: 1.015, skew: 8 * k, blur: 9 * k, opacity: 1};
    case 'blur':
      return {tx: 0, scale: 1 + 0.05 * k, skew: 0, blur: 26 * k, opacity: Math.min(1, p * 2.2)};
    case 'flash':
    default:
      return {tx: 0, scale: 1 + 0.015 * k, skew: 0, blur: 0, opacity: Math.min(1, p * 2.6)};
  }
};

/** Outgoing move; q is 0 at the bar line and 1 when the old scene has left. */
const exitXf = (name: TransitionName | undefined, q: number): Xf => {
  if (!name) return IDENTITY;
  const k = E.inExpo(clamp(q));
  switch (name) {
    case 'slide':
      return {tx: 100 * k, scale: 1, skew: 0, blur: 0, opacity: 1};
    case 'whip':
      return {tx: 104 * k, scale: 1, skew: -7 * k, blur: 8 * k, opacity: 1};
    case 'blur':
      return {tx: 0, scale: 1 - 0.035 * k, skew: 0, blur: 20 * k, opacity: 1 - 0.55 * k};
    case 'flash':
    default:
      return {tx: 0, scale: 1 - 0.01 * k, skew: 0, blur: 0, opacity: 1 - 0.5 * k};
  }
};

const BeatShell: React.FC<{
  beat: Beat;
  index: number;
  count: number;
  transitions: TransitionName[];
  children: React.ReactNode;
}> = ({beat, index, count, transitions, children}) => {
  const local = useCurrentFrame();
  const enterName = index > 0 ? transitions[(index - 1) % transitions.length] : undefined;
  const exitName = index < count - 1 ? transitions[index % transitions.length] : undefined;
  const a = enterXf(enterName, clamp((local - PREROLL) / OVER));
  const b = exitXf(exitName, clamp((local - PREROLL - beat.dur) / OVER));

  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${a.tx + b.tx}%, 0, 0) scale(${a.scale * b.scale}) skewX(${a.skew + b.skew}deg)`,
        transformOrigin: '50% 50%',
        filter: a.blur + b.blur > 0.15 ? `blur(${a.blur + b.blur}px)` : undefined,
        opacity: a.opacity * b.opacity,
        willChange: 'transform, filter, opacity',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Light on the seam: a kiss of flash or a leak, never a solid wipe. */
const CutFX: React.FC<{name: TransitionName; index: number; tone: Beat['tone']}> = ({name, index, tone}) => {
  if (name === 'whip') {
    return (
      <>
        <LightLeak from={index % 2 === 0 ? 'right' : 'left'} color="rgba(255,235,196,0.5)" strength={1} />
        <Flash color="#FFF8EC" peak={0.2} />
      </>
    );
  }
  if (name === 'blur') {
    return <LightLeak from={index % 2 === 0 ? 'left' : 'right'} color="rgba(216,240,232,0.42)" strength={0.85} />;
  }
  if (name === 'flash') {
    return <Flash color={tone === 'paper' ? '#FFF7EA' : '#EFFFF8'} peak={0.42} />;
  }
  return <Flash color="#FFF9F0" peak={0.14} />;
};

const Body: React.FC<{vertical: boolean; lookName?: string; blur?: number; captions?: boolean}> = ({
  vertical,
  lookName,
  blur,
  captions,
}) => {
  const beats = T.beats;
  const style = T.style ?? {motion: 1, transitions: ['whip', 'slide', 'blur'] as TransitionName[]};
  const look = {
    ...resolveLook(lookName ?? style.look ?? T.look),
    ...(typeof blur === 'number' ? {motionBlur: blur} : {}),
  };
  const motion = Math.max(0.2, Math.min(1.5, style.motion ?? 1));
  const cuts = style.transitions?.length ? style.transitions : (['whip', 'slide', 'blur'] as TransitionName[]);
  // 9:16 reels ship with burned captions in the platform-safe band; wide and the
  // 4:5 / 1:1 teasers stay clean, where the strip would sit on the layout.
  // The canvas height comes from the composition, not the timeline: T.height is
  // the 16:9 design grid (1080) and is the same for every aspect.
  const {height: canvasH} = useVideoConfig();
  const showCaptions = captions ?? (vertical && canvasH >= 1900);
  return (
    <AbsoluteFill>
      <FilmGrade look={look}>
        <AbsoluteFill style={{background: C.inkBg}}>
          {beats.map((beat, i) => {
            const Scene = SCENES[beat.kind];
            const isLast = i === beats.length - 1;
            return (
              <Sequence
                key={beat.id}
                from={Math.max(0, beat.start - PREROLL)}
                durationInFrames={PREROLL + beat.dur + (isLast ? 0 : OVER)}
                name={`${beat.id} · ${beat.kind}`}
              >
                <BeatShell beat={beat} index={i} count={beats.length} transitions={cuts}>
                  <Shutter look={look}>
                    <Camera
                      duration={PREROLL + beat.dur + OVER}
                      mode={CAMERA_BY_KIND[beat.kind] ?? 'settle'}
                      strength={look.camera * motion}
                    >
                      <Scene beat={beat} vertical={vertical} motion={motion} />
                    </Camera>
                  </Shutter>
                </BeatShell>
              </Sequence>
            );
          })}

          {/* the light that helps the eye across each cut */}
          {beats.map((beat, i) =>
            i === beats.length - 1 ? null : (
              <Sequence key={`seam-${beat.id}`} from={beat.start - 7} durationInFrames={14} name={`seam · ${beat.id}`} layout="none">
                <CutFX name={cuts[i % cuts.length]} index={i} tone={beats[i + 1]?.tone ?? 'paper'} />
              </Sequence>
            ),
          )}
        </AbsoluteFill>
      </FilmGrade>
      {showCaptions ? <Captions vertical={vertical} /> : null}
      <Soundtrack />
    </AbsoluteFill>
  );
};

export const FilmWide: React.FC<{look?: string; blur?: number; captions?: boolean}> = ({look, blur, captions}) => (
  <Body vertical={false} lookName={look} blur={blur} captions={captions} />
);
export const FilmVertical: React.FC<{look?: string; blur?: number; captions?: boolean}> = ({look, blur, captions}) => (
  <Body vertical lookName={look} blur={blur} captions={captions} />
);

export const FILM = T;

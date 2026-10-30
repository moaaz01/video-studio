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
import {Explainer} from '../scenes/Explainer';
import {Kinetic} from '../scenes/Kinetic';
import {STORE_SCENES} from '../store/scenes';
import {Captions} from './Captions';
import {Soundtrack} from '../audio/Soundtrack';

const T = timelineJson as unknown as Film;

export type SceneProps = {beat: Beat; vertical: boolean; motion?: number; preRoll?: number};

/** 180-degree shutter: a camera only blurs what moves, so this is opt-in per look. */
const Shutter: React.FC<{look: {motionBlur: number}; children: React.ReactNode}> = ({look, children}) =>
  look.motionBlur > 0 ? (
    <CameraMotionBlur shutterAngle={180} samples={look.motionBlur}>
      {children}
    </CameraMotionBlur>
  ) : (
    <>{children}</>
  );

/**
 * Scene registry: the launch-trailer grammar of the studio's original demo, plus the
 * product-demo grammar of a live shop (`store/`). A film picks its beats from the
 * timeline; the compiler only validates that each `kind` exists here.
 */
const LEGACY_SCENES: Record<string, React.FC<SceneProps>> = {
  hook: Hook,
  device: Device,
  stat: Stat,
  cta: Cta,
  explainer: Explainer,
  kinetic: Kinetic,
};

export const SCENES: Record<string, React.FC<SceneProps>> = {...LEGACY_SCENES, ...STORE_SCENES};

/**
 * A cut is a hand-off, not a curtain.
 *
 * Each beat is pre-rolled by PREROLL frames so its own entrance has already begun
 * when its voice starts, then hands over across OVER frames: the outgoing scene
 * leaves as the incoming one arrives, both painting at full size, so the frame is
 * never empty and a viewer reads one continuous move instead of a dip to paper.
 * The incoming scene is painted above (later sibling), and before its bar line it
 * sits fully outside the frame — the overlap is only ever a real transition.
 *
 * The store film uses a shape vocabulary instead of translation: a collar of light
 * opens (flood), an iris opens from the object that was just tapped, or a gold
 * perforation line travels across the frame (maskline). A clip, not a wipe: the
 * outgoing frame stays alive underneath the whole time.
 */
const PREROLL = 8;
const OVER = 8;

type Xf = {tx: number; scale: number; skew: number; blur: number; opacity: number; clip?: string};

const IDENTITY: Xf = {tx: 0, scale: 1, skew: 0, blur: 0, opacity: 1};

const ORIGINS = ['50% 50%', '73% 56%', '27% 42%', '50% 62%'];
const originFor = (index: number) => ORIGINS[index % ORIGINS.length];

/** Incoming move; p is 0 at the bar line and 1 when the new scene owns the frame. */
const enterXf = (name: TransitionName | undefined, p: number, index: number): Xf => {
  if (!name) return IDENTITY;
  const k = 1 - E.outExpo(clamp(p));
  switch (name) {
    case 'slide':
      return {tx: -100 * k, scale: 1, skew: 0, blur: 0, opacity: 1};
    case 'whip':
      return {tx: -108 * k, scale: 1.015, skew: 8 * k, blur: 9 * k, opacity: 1};
    case 'blur':
      return {tx: 0, scale: 1 + 0.05 * k, skew: 0, blur: 26 * k, opacity: Math.min(1, p * 2.2)};
    case 'flood':
      return {tx: 0, scale: 1.02 - 0.02 * p, skew: 0, blur: 0, opacity: 1, clip: `circle(${clamp(p) * 92}% at ${originFor(index)})`};
    case 'iris':
      return {tx: 0, scale: 1, skew: 0, blur: 0, opacity: 1, clip: `circle(${clamp(p) * 78}% at 50% 50%)`};
    case 'maskline': {
      const edge = (1 - clamp(p)) * 150;
      return {
        tx: 0,
        scale: 1,
        skew: 0,
        blur: 0,
        opacity: 1,
        clip: `polygon(-10% ${edge}%, 110% ${edge - 34}%, 110% 120%, -10% 120%)`,
      };
    }
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
    case 'flood':
      return {tx: 0, scale: 1 + 0.07 * k, skew: 0, blur: 4 * k, opacity: 1 - 0.12 * k};
    case 'iris':
      return {tx: 0, scale: 1 - 0.05 * k, skew: 0, blur: 3 * k, opacity: 1 - 0.15 * k};
    case 'maskline':
      return {tx: 0, scale: 1 + 0.015 * k, skew: 0, blur: 2 * k, opacity: 1 - 0.08 * k};
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
  const a = enterXf(enterName, clamp((local - PREROLL) / OVER), index);
  const b = exitXf(exitName, clamp((local - PREROLL - beat.dur) / OVER));

  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${a.tx + b.tx}%, 0, 0) scale(${a.scale * b.scale}) skewX(${a.skew + b.skew}deg)`,
        transformOrigin: '50% 50%',
        filter: a.blur + b.blur > 0.15 ? `blur(${a.blur + b.blur}px)` : undefined,
        opacity: a.opacity * b.opacity,
        clipPath: a.clip,
        willChange: 'transform, filter, opacity, clip-path',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** A gold perforation line that travels with the maskline clip. */
const MaskLine: React.FC = () => {
  const f = useCurrentFrame();
  const p = clamp(f / 16);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: '-20%',
          top: `${p * 118 - 12}%`,
          width: '140%',
          height: 3,
          transform: `rotate(-9deg) translateY(${(1 - p) * 40}px)`,
          background: 'linear-gradient(90deg, transparent, rgba(242,169,59,0.85), rgba(255,246,230,0.95), rgba(242,169,59,0.85), transparent)',
          boxShadow: '0 0 26px rgba(242,169,59,0.7), 0 0 4px rgba(255,255,255,0.8)',
          opacity: Math.sin(Math.PI * p) * 1.1,
        }}
      />
    </AbsoluteFill>
  );
};

/** A collar of light that opens with the flood clip. */
const FloodLight: React.FC<{index: number}> = ({index}) => {
  const f = useCurrentFrame();
  const p = clamp(f / 16);
  const origin = originFor(index);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${origin}, rgba(242,169,59,0.34) 0%, rgba(15,124,128,0.20) 26%, transparent 62%)`,
          opacity: Math.sin(Math.PI * p) * 0.95,
        }}
      />
    </AbsoluteFill>
  );
};

/** An iris ring, drawn on the seam. */
const IrisRing: React.FC = () => {
  const f = useCurrentFrame();
  const p = clamp(f / 18);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '150vmax',
          height: '150vmax',
          marginLeft: '-75vmax',
          marginTop: '-75vmax',
          borderRadius: '50%',
          border: `2px solid rgba(242,169,59,${0.55 * (1 - p)})`,
          transform: `scale(${0.02 + E.outExpo(p) * 0.42})`,
          boxShadow: `0 0 40px rgba(242,169,59,${0.35 * (1 - p)})`,
        }}
      />
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
  if (name === 'flood') return <FloodLight index={index} />;
  if (name === 'iris') return <IrisRing />;
  if (name === 'maskline') return <MaskLine />;
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
  const {width: canvasW, height: canvasH} = useVideoConfig();
  const hasSpokenHeadline = beats.some((b) => b.kind === 'explainer');
  const showCaptions = captions ?? (vertical && canvasH >= 1900 && !hasSpokenHeadline);
  const isStoreFilm = beats.some((b) => b.kind in STORE_SCENES);
  return (
    <AbsoluteFill>
      <FilmGrade look={look}>
        <AbsoluteFill style={{background: isStoreFilm ? '#030A0F' : C.inkBg}}>
          {beats.map((beat, i) => {
            const Scene = SCENES[beat.kind];
            if (!Scene) return null;
            const isLast = i === beats.length - 1;
            // Kinetic type must not sit under the camera/beat transforms: Chromium
            // mis-shapes large Arabic in a transformed subtree. The scene owns its
            // own cuts and background moves; the global shell is bypassed.
            if (beat.kind === 'kinetic') {
              return (
                <Sequence
                  key={beat.id}
                  from={beat.start}
                  durationInFrames={beat.dur + (isLast ? 0 : OVER)}
                  name={`${beat.id} · ${beat.kind}`}
                >
                  <Scene beat={beat} vertical={vertical} motion={motion} preRoll={0} />
                </Sequence>
              );
            }
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
                      <Scene beat={beat} vertical={vertical} motion={motion} preRoll={PREROLL} />
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

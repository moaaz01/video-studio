import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import timelineJson from '../generated/timeline.json';
import {Wipe} from '../components/Overlays';
import {FilmGrade} from '../look/FilmGrade';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {Camera, CAMERA_BY_KIND} from '../look/Camera';
import {resolveLook} from '../look/looks';
import {C} from '../theme';
import type {Beat, Film} from './types';
import {Hook} from '../scenes/Hook';
import {Device} from '../scenes/Device';
import {Stat} from '../scenes/Stat';
import {Cta} from '../scenes/Cta';
import {Captions} from './Captions';

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

export const SCENES: Record<Beat['kind'], React.FC<{beat: Beat; vertical: boolean}>> = {
  hook: Hook,
  device: Device,
  stat: Stat,
  cta: Cta,
};

const WIPES = ['paper', 'ink', 'emerald'] as const;

/** The cut vocabulary: one opaque panel wipe, 12 frames, centred on the cut. */
const CUT_FRAMES = 12;

const Body: React.FC<{vertical: boolean; lookName?: string; blur?: number; captions?: boolean}> = ({
  vertical,
  lookName,
  blur,
  captions,
}) => {
  const beats = T.beats;
  const look = {...resolveLook(lookName ?? T.look), ...(typeof blur === 'number' ? {motionBlur: blur} : {})};
  // social masters ship with burned captions; the wide film stays cinematic
  const showCaptions = captions ?? vertical;
  return (
    <AbsoluteFill>
    <FilmGrade look={look}>
      <AbsoluteFill style={{background: C.inkBg}}>
        {beats.map((beat, i) => {
          const Scene = SCENES[beat.kind];
          const isLast = i === beats.length - 1;
          return (
            <Sequence key={beat.id} from={beat.start} durationInFrames={beat.dur} name={`${beat.id} · ${beat.kind}`}>
              <Shutter look={look}>
                <Camera duration={beat.dur} mode={CAMERA_BY_KIND[beat.kind] ?? 'settle'} strength={look.camera}>
                  <Scene beat={beat} vertical={vertical} />
                </Camera>
              </Shutter>
              {!isLast ? (
                <Sequence from={beat.dur - CUT_FRAMES / 2} durationInFrames={CUT_FRAMES} name="wipe">
                  <Wipe variant={WIPES[(i + 1) % WIPES.length]} half={CUT_FRAMES / 2} skew={7} softness={34} />
                </Sequence>
              ) : null}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </FilmGrade>
    {showCaptions ? <Captions vertical={vertical} /> : null}
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

import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import timelineJson from '../generated/timeline.json';
import {Wipe} from '../components/Overlays';
import {C} from '../theme';
import type {Beat, Film} from './types';
import {Hook} from '../scenes/Hook';
import {Device} from '../scenes/Device';
import {Stat} from '../scenes/Stat';
import {Cta} from '../scenes/Cta';

const T = timelineJson as unknown as Film;

const SCENES: Record<Beat['kind'], React.FC<{beat: Beat; vertical: boolean}>> = {
  hook: Hook,
  device: Device,
  stat: Stat,
  cta: Cta,
};

const WIPES = ['paper', 'ink', 'emerald'] as const;

/** The cut vocabulary: one opaque panel wipe, 12 frames, centred on the cut. */
const CUT_FRAMES = 12;

const Body: React.FC<{vertical: boolean}> = ({vertical}) => {
  const beats = T.beats;
  return (
    <AbsoluteFill style={{background: C.inkBg}}>
      {beats.map((beat, i) => {
        const Scene = SCENES[beat.kind];
        const isLast = i === beats.length - 1;
        return (
          <Sequence key={beat.id} from={beat.start} durationInFrames={beat.dur} name={`${beat.id} · ${beat.kind}`}>
            <Scene beat={beat} vertical={vertical} />
            {!isLast ? (
              <Sequence from={beat.dur - CUT_FRAMES / 2} durationInFrames={CUT_FRAMES} name="wipe">
                <Wipe variant={WIPES[(i + 1) % WIPES.length]} half={CUT_FRAMES / 2} skew={7} softness={34} />
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const FilmWide: React.FC = () => <Body vertical={false} />;
export const FilmVertical: React.FC = () => <Body vertical />;

export const FILM = T;

import React, {useMemo} from 'react';
import {Html5Audio, Sequence, staticFile} from 'remotion';
import timeline from '../generated/timeline.json';

type Vo = {id: string; at: number; dur: number; wav: string};
type Sfx = {at: number; name: string; gain: number};

const T = timeline as unknown as {
  fps: number;
  total: number;
  vo: Vo[];
  sfx: Sfx[];
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Music sits under the voice, not behind it. The bed is pre-levelled to a
 * constant -19 dBFS RMS (script/level_score.py), so the static gain here is the
 * whole balance: 0.375 puts the bed ~9 dB under speech, and the trapezoid duck
 * (-9 dB more) opens a lane for every line without the music vanishing.
 */
const duckAt = (t: number): number => {
  let k = 0;
  for (const v of T.vo) {
    const a = v.at - 0.16;
    const b = v.at + v.dur + 0.30;
    if (t < a - 0.26 || t > b + 0.34) continue;
    const inRamp = clamp01((t - (a - 0.26)) / 0.26);
    const outRamp = clamp01((b + 0.34 - t) / 0.34);
    k = Math.max(k, Math.min(inRamp, outRamp, 1));
  }
  return k;
};

const musicVolume = (frame: number): number => {
  const t = frame / T.fps;
  const fadeIn = clamp01(t / 1.6);
  const fadeOut = clamp01((T.total + 0.4 - t) / 1.1);
  const base = 0.375 * (1 - 0.50 * duckAt(t));
  return base * fadeIn * fadeOut;
};

/** Delivered foley is peak-normalised to -3 dBFS, so one scalar per cue is enough. */
const SFX_TRIM = 0.56;

/** Every picture cut gets an edge: the film's pulse is the edit, not the music. */
const CUTS: Array<{at: number; big?: boolean}> = [
  {at: 7.0},
  {at: 12.5, big: true},
  {at: 21.0},
  {at: 32.5},
  {at: 44.0, big: true},
  {at: 51.5},
  {at: 62.5, big: true},
  {at: 69.5},
  {at: 76.0},
  {at: 84.0},
  {at: 95.0},
  {at: 100.5, big: true},
  {at: 106.5, big: true},
];

/** Cuts that the foley already dresses keep their own accent — no doubling. */
const cutAccents = (existing: Sfx[]): Sfx[] => {
  const busy = existing.filter((s) => /whoosh|impact|reverse_hit|sub_drop|riser/.test(s.name));
  const out: Sfx[] = [];
  for (const c of CUTS) {
    if (busy.some((b) => Math.abs(b.at - c.at) < 0.45)) continue;
    out.push({at: Math.max(0, c.at - 0.10), name: 'whoosh_rtl', gain: c.big ? 0.92 : 0.62});
    if (c.big) out.push({at: c.at, name: 'haptic_thud', gain: 0.5});
  }
  return out;
};

export const Soundtrack: React.FC = () => {
  const fps = T.fps;
  const voCues = useMemo(
    () =>
      T.vo.map((v) => ({
        ...v,
        from: Math.round(v.at * fps),
        frames: Math.max(1, Math.round(v.dur * fps) + 12),
      })),
    [fps],
  );
  const sfxCues = useMemo(
    () =>
      [...T.sfx, ...cutAccents(T.sfx)].map((s) => ({
        ...s,
        from: Math.max(0, Math.round(s.at * fps)),
      })),
    [fps],
  );

  return (
    <>
      <Html5Audio src={staticFile('audio/score/music.wav')} volume={musicVolume} />

      {voCues.map((v) => (
        <Sequence key={`vo-${v.id}`} from={v.from} durationInFrames={v.frames} layout="none">
          <Html5Audio src={staticFile(v.wav)} volume={1.18} />
        </Sequence>
      ))}

      {sfxCues.map((s, i) => (
        <Sequence key={`sfx-${i}-${s.name}`} from={s.from} durationInFrames={90} layout="none">
          <Html5Audio src={staticFile(`audio/sfx/${s.name}.wav`)} volume={s.gain * SFX_TRIM} />
        </Sequence>
      ))}
    </>
  );
};

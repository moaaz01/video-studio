import React from 'react';
import {Html5Audio, Sequence, staticFile} from 'remotion';
import timeline from '../generated/timeline.json';
import voManifest from '../generated/vo.json';

/**
 * The film's sound, derived from the compiled timeline - never from a second
 * hand-maintained list.
 *
 * Three layers, in the order a viewer should notice them:
 *   1. the voice, placed on the beat it belongs to (measured, from vo.json),
 *   2. original foley on every beat cut (the edit is the pulse),
 *   3. a composed bed at a measured -19 dBFS RMS, ducked under each line.
 *
 * Every gain here is a scalar because every source is pre-levelled:
 * `scripts/make_bed.py` normalises the bed (peak <= -3 dBFS, no clipping) and
 * `scripts/voice.py` returns normalised speech. Nothing is time-animated beyond
 * the frame, so a still and the matching video frame are identical.
 */

type Beat = {id: string; kind: string; start: number; dur: number; frames: number};
type VoLine = {id: string; wav: string; dur: number};

const T = timeline as unknown as {
  fps: number;
  bpm: number;
  frames: number;
  beats: Beat[];
};
const VO = voManifest as unknown as VoLine[];

const FPS = T.fps;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** music bed gain: -9 dB under speech, ducked a further -6 dB while a line plays */
const BED_GAIN = 0.375;
const DUCK = 0.5;
const DUCK_RAMP = 0.26;

type Cue = {from: number; dur: number; wav: string; at: number};

const voCues: Cue[] = VO.map((line) => {
  const beat = T.beats.find((candidate) => line.id.startsWith(`${candidate.id}-`));
  const at = beat ? beat.start / FPS : 0;
  return {
    from: Math.round(at * FPS),
    dur: Math.max(1, Math.round(line.dur * FPS) + 12),
    wav: line.wav,
    at,
  };
});

const duckAt = (seconds: number): number => {
  let k = 0;
  for (const cue of voCues) {
    const a = cue.at - 0.16;
    const b = cue.at + cue.dur / FPS + 0.3;
    if (seconds < a - DUCK_RAMP || seconds > b + DUCK_RAMP) continue;
    const inRamp = clamp01((seconds - (a - DUCK_RAMP)) / DUCK_RAMP);
    const outRamp = clamp01((b + DUCK_RAMP - seconds) / DUCK_RAMP);
    k = Math.max(k, Math.min(inRamp, outRamp, 1));
  }
  return k;
};

const musicVolume = (frame: number): number => {
  const t = frame / FPS;
  const total = T.frames / FPS;
  const fadeIn = clamp01(t / 1.2);
  const fadeOut = clamp01((total - t) / 1.4);
  return BED_GAIN * (1 - DUCK * duckAt(t)) * fadeIn * fadeOut;
};

/** Delivered foley is peak-normalised, so one scalar per cue is the whole mix. */
const SFX_TRIM = 0.56;

type Accent = {at: number; name: string; gain: number};

/** Every picture cut gets an edge; the stat and the end card get a body hit. */
const accents: Accent[] = T.beats.flatMap((beat, index) => {
  const seconds = beat.start / FPS;
  const cues: Accent[] = [];
  if (index > 0) {
    cues.push({at: Math.max(0, seconds - 0.06), name: 'whoosh_rtl', gain: 0.62});
  }
  if (beat.kind === 'stat') {
    cues.push({at: seconds, name: 'stamp_thud', gain: 0.5});
  }
  if (beat.kind === 'cta') {
    cues.push({at: seconds, name: 'ui_chirp', gain: 0.45});
  }
  return cues;
});

export const Soundtrack: React.FC = () => {
  return (
    <>
      <Html5Audio src={staticFile('audio/score/music.wav')} volume={musicVolume} />

      {voCues.map((cue) => (
        <Sequence key={`vo-${cue.wav}`} from={cue.from} durationInFrames={cue.dur} layout="none">
          <Html5Audio src={staticFile(cue.wav)} volume={1.18} />
        </Sequence>
      ))}

      {accents.map((accent, index) => (
        <Sequence
          key={`sfx-${index}-${accent.name}`}
          from={Math.max(0, Math.round(accent.at * FPS))}
          durationInFrames={90}
          layout="none"
        >
          <Html5Audio src={staticFile(`audio/sfx/${accent.name}.wav`)} volume={accent.gain * SFX_TRIM} />
        </Sequence>
      ))}
    </>
  );
};

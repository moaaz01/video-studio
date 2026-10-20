/** The compiled timeline: the only thing the composition reads. */

export type BeatKind = 'hook' | 'device' | 'stat' | 'cta';
export type Tone = 'ink' | 'paper' | 'emerald';

export type Stat = {from: number; to: number; suffix: string; label: string};

export type Beat = {
  id: string;
  kind: BeatKind;
  /** frames */
  start: number;
  end: number;
  dur: number;
  tone: Tone;
  kicker?: string;
  line1?: string;
  line2?: string;
  stat?: Stat;
  /** VO lines for this beat, in order — audio is placed by the mix, not here. */
  vo?: string[];
};

export type Film = {
  fps: number;
  width: number;
  height: number;
  frames: number;
  bpm: number;
  beats: Beat[];
};

export type SceneProps = {beat: Beat; vertical: boolean};

/** The compiled timeline: the only thing the composition reads. */

export type BeatKind = 'hook' | 'device' | 'stat' | 'cta';
export type Tone = 'ink' | 'paper' | 'emerald';

export type Stat = {from: number; to: number; suffix: string; label: string};

/** One foley cue inside a beat; `at` is beat-local frames. */
export type SfxCue = {at: number; name: string; gain?: number};

export type BackgroundVariant = 'paper-glow' | 'ink-aurora' | 'emerald-depth';
export type TransitionName = 'whip' | 'slide' | 'blur' | 'flash';

/**
 * The template layer's output: which look, how much motion, which background
 * family, which cut vocabulary, which foley. Every field has a safe default, so
 * a film.json that says nothing still compiles.
 */
export type StylePlan = {
  template?: string;
  look?: string;
  motion?: number;
  background?: BackgroundVariant;
  transitions?: TransitionName[];
  sfx?: {intro?: string; cut?: string; accent?: string};
};

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
  /** which real app screen the phone shows, if the beat has a phone */
  screen?: 'home' | 'agent';
  /** words in line1 painted in the accent colour */
  emphasis?: string[];
  /** beat-local foley, e.g. a whoosh as a card lands */
  sfx?: SfxCue[];
  /** VO lines for this beat, in order — audio is placed by the mix, not here. */
  vo?: string[];
};

export type Film = {
  fps: number;
  width: number;
  height: number;
  frames: number;
  bpm: number;
  /** named grade from src/look/looks.ts; absent = default */
  look?: string;
  /** compiled from film.json `style` by scripts/make_timeline.py */
  style?: StylePlan;
  beats: Beat[];
};

export type SceneProps = {
  beat: Beat;
  vertical: boolean;
  /** style.motion — scenes multiply decorative float/bob by this */
  motion?: number;
  style?: StylePlan;
};

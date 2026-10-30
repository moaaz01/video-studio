/** The compiled timeline: the only thing the composition reads. */

export type BeatKind =
  | 'hook'
  | 'device'
  | 'stat'
  | 'cta'
  /** product-demo grammar: a live shop is shown, not described */
  | 'open'
  | 'store'
  | 'admin'
  | 'security'
  | 'close'
  /** the brand atelier: real swatches + card styles, live preview */
  | 'design'
  /** the guided setup wizard: identity -> launch */
  | 'setup'
  /** multi-source sourcing, margin, automatic repricing */
  | 'sources'
  /** contact-first end card with the two real handles */
  | 'finale'
  /** voice-led explainer: one sentence per beat, one card that proves it */
  | 'explainer'
  /** beat-grid kinetic type: shots on the music, grounds flipping */
  | 'kinetic';
export type Tone = 'ink' | 'paper' | 'emerald';

export type Stat = {from: number; to: number; suffix: string; label: string};

/** One foley cue inside a beat; `at` is beat-local frames. */
export type SfxCue = {at: number; name: string; gain?: number};

export type BackgroundVariant =
  | 'paper-glow'
  | 'ink-aurora'
  | 'emerald-depth'
  | 'souk-night'
  | 'vault-night'
  | 'atelier'
  | 'cobalt';
export type TransitionName = 'whip' | 'slide' | 'blur' | 'flash' | 'flood' | 'iris' | 'maskline';

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
  /**
   * Scene copy that is not a headline (chat, product, KPI, guard slabs, CTA card).
   * Passed through by the compiler untouched; a scene may only render strings that
   * exist in the product's own tables or are explicitly marked as sample data.
   */
  data?: Record<string, unknown>;
};

export type Film = {
  fps: number;
  format?: 'launch' | 'explainer' | 'kinetic';
  width: number;
  height: number;
  frames: number;
  bpm: number;
  /** kinetic palette: bg / paper / accent / hot / ink */
  palette?: Record<string, string>;
  /** optional external bed: {file, offset, gain, stopBeat} */
  music?: {file?: string; offset?: number; gain?: number; stopBeat?: number};
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
  /** frames the scene is pre-rolled before its beat; word/beat timing must subtract it */
  preRoll?: number;
};

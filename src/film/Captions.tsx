import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import captionsJson from '../generated/captions.json';
import {FONT} from '../theme';

/**
 * Burned Arabic captions, frame-timed by `scripts/captions.py`.
 *
 * The active cue is chosen from `frame` alone and the fade is arithmetic, so the
 * component is a pure function of the frame: a still is pixel-identical to the
 * matching video frame. No `backdrop-filter`, no randomness, no timers.
 *
 * Mount it at the film root — not inside a beat's <Sequence> (that frame is
 * local) and outside <FilmGrade> (the grade would tint the white type and the
 * grain/vignette overlays would sit on top of the plate).
 */
type Cue = {start: number; duration: number; lines: string[]};
type CaptionsData = {wide: Cue[]; vertical: Cue[]};

const DATA = captionsJson as unknown as CaptionsData;

/** Font sizes from references/arabic-type.md: one film, set once. */
const SIZE = {wide: 44, vertical: 38} as const;
/** Bottom inset as a fraction of height; wide clears the bottom brand row, 9:16 clears platform chrome. */
const PLATE = {
  wide: {bottom: 0.11, maxWidth: 0.8},
  vertical: {bottom: 0.175, maxWidth: 0.84},
} as const;
const FADE_FRAMES = 3;
const SCRIM = 'rgba(12,10,8,0.55)';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const Captions: React.FC<{vertical?: boolean}> = ({vertical = false}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const cues = vertical ? DATA.vertical : DATA.wide;
  const cue = cues.find((candidate) => frame >= candidate.start && frame < candidate.start + candidate.duration);
  if (!cue) {
    return null;
  }

  const local = frame - cue.start;
  const fade = Math.min(FADE_FRAMES, Math.max(1, Math.round(fps / 10))); // 3 frames at 30 fps
  const opacity = Math.min(clamp01(local / fade), clamp01((cue.duration - local) / fade));
  const plate = vertical ? PLATE.vertical : PLATE.wide;

  return (
    <AbsoluteFill
      style={{alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none', mixBlendMode: 'normal'}}
    >
      <div
        dir="rtl"
        lang="ar"
        style={{
          marginBottom: Math.round(height * plate.bottom),
          maxWidth: Math.round(width * plate.maxWidth),
          padding: vertical ? '18px 30px' : '14px 30px',
          borderRadius: 16,
          background: SCRIM,
          opacity,
          mixBlendMode: 'normal',
          color: '#FFFFFF',
          fontFamily: FONT.tajawal,
          fontWeight: 700,
          fontSize: vertical ? SIZE.vertical : SIZE.wide,
          lineHeight: 1.35,
          letterSpacing: 0,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          textShadow: '0 2px 10px rgba(0,0,0,0.45)',
        }}
      >
        {cue.lines.join('\n')}
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ground} from '../components/Surfaces';
import {Ar} from '../components/Text';
import {FONT, C} from '../theme';
import {E, entrance, entStyle} from '../lib/anim';
import {toAr} from '../lib/rtl';
import type {SceneProps} from '../film/types';

/**
 * Tutorial: a real screen, a camera that knows where to look.
 *
 * The beat shows one screenshot or screen recording (`data.src`, under public/)
 * inside a browser, phone or bare frame. Each step names a point on that screen
 * (0–1 of its width/height); the camera eases its zoom onto the point, the cursor
 * travels there and arrives exactly at `at`, a click ripples, and a callout reads
 * the step in Arabic. `box` spotlights a region by dimming the rest. Nothing on the
 * screen is redrawn: if the UI is wrong, the capture is wrong.
 */

type Step = {at: number; x: number; y: number; zoom?: number; label?: string; click?: boolean; box?: [number, number, number, number]};
type Data = {
  src?: string;
  /** width / height of the capture; default 16:10 desktop */
  aspect?: number;
  frame?: 'browser' | 'phone' | 'none';
  url?: string;
  steps?: Step[];
  stepLabel?: string;
};

const MOVE = 0.55; // seconds the camera and cursor take to reach a step
const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

type Cam = {x: number; y: number; z: number};

const camAt = (steps: Step[], t: number): Cam => {
  let cam: Cam = {x: 0.5, y: 0.5, z: 1};
  for (const s of steps) {
    const target = {x: s.x, y: s.y, z: s.zoom ?? 1.8};
    const k = interpolate(t, [s.at - MOVE, s.at], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
    cam = {x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k, z: cam.z + (target.z - cam.z) * k};
  }
  return cam;
};

const Cursor: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))'}}>
    <path d="M4 2 L4 19 L8.5 14.8 L11.4 21.4 L14.3 20.1 L11.5 13.6 L17.6 13.6 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

export const Tutorial: React.FC<SceneProps> = ({beat, vertical, preRoll = 0}) => {
  const frame = useCurrentFrame() - preRoll;
  const {fps, width, height} = useVideoConfig();
  const d = (beat.data ?? {}) as Data;
  const steps = [...(d.steps ?? [])].sort((a, b) => a.at - b.at);
  const t = frame / fps;
  const unit = Math.min(width, height) / 1080;
  const dark = beat.tone !== 'paper';
  const kind = d.frame ?? 'browser';
  const aspect = d.aspect ?? (kind === 'phone' ? 9 / 19.5 : 16 / 10);

  // the screen box, in canvas px
  const chrome = kind === 'browser' ? 44 * unit : 0;
  const maxW = kind === 'phone' ? (vertical ? width * 0.7 : width * 0.3) : vertical ? width * 0.92 : width * 0.74;
  const maxH = (vertical ? height * 0.6 : height * 0.72) - chrome;
  const sw = Math.min(maxW, maxH * aspect);
  const sh = sw / aspect;
  const sx = (width - sw) / 2;
  const sy = (vertical ? height * 0.24 : height * 0.18) + chrome;

  const cam = camAt(steps, t);
  // translate so the focus point sits in the centre, never showing past an edge
  const ox = Math.min(0, Math.max(sw - sw * cam.z, sw / 2 - cam.x * sw * cam.z));
  const oy = Math.min(0, Math.max(sh - sh * cam.z, sh / 2 - cam.y * sh * cam.z));
  const toScreen = (x: number, y: number) => ({x: ox + x * sw * cam.z, y: oy + y * sh * cam.z});

  // cursor: rests low-centre, then travels to each step and arrives on time
  let cur = {x: 0.62, y: 0.86};
  let active = -1;
  steps.forEach((s, i) => {
    const k = interpolate(t, [s.at - MOVE, s.at], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.outQuart});
    cur = {x: cur.x + (s.x - cur.x) * k, y: cur.y + (s.y - cur.y) * k};
    if (t >= s.at) active = i;
  });
  const cp = toScreen(cur.x, cur.y);
  const step = active >= 0 ? steps[active] : null;
  const since = step ? t - step.at : 0;
  const ripple = step && step.click !== false ? interpolate(since, [0, 0.45], [0, 1], {extrapolateRight: 'clamp'}) : 1;
  const press = step && step.click !== false ? 1 - 0.18 * Math.sin(Math.min(1, since / 0.18) * Math.PI) : 1;
  const sp = step ? toScreen(step.x, step.y) : null;
  const calloutIn = entrance(frame, step ? Math.round((step.at + 0.1) * fps) : 0, {dur: 14, dist: 12});
  const titleIn = entrance(frame, 0, {dur: 20, dist: 14});
  const screenIn = entrance(frame, 2, {dur: 24, dist: 30, from: 0.94});
  const src = d.src ?? '';

  return (
    <AbsoluteFill>
      <Ground tone={beat.tone === 'emerald' ? 'emerald' : dark ? 'ink' : 'paper'} />
      <div dir="rtl" style={{...entStyle(titleIn), position: 'absolute', top: vertical ? height * 0.08 : height * 0.05,
        left: width * 0.07, right: width * 0.07, display: 'flex', alignItems: 'baseline', gap: 24 * unit}}>
        {steps.length > 1 && active >= 0 ? (
          <div style={{fontFamily: FONT.tajawal, fontWeight: 800, fontSize: 30 * unit, color: '#fff', background: C.emerald,
            borderRadius: 99, padding: `${6 * unit}px ${22 * unit}px`, flexShrink: 0}}>
            {`${d.stepLabel ?? 'الخطوة'} ${toAr(active + 1)} / ${toAr(steps.length)}`}
          </div>
        ) : null}
        {beat.line1 ? <Ar text={beat.line1} size={(vertical ? 54 : 50) * unit} weight={800} color={dark ? '#fff' : C.ink} /> : null}
      </div>

      <div style={{...entStyle(screenIn), position: 'absolute', left: sx, top: sy - chrome, width: sw, height: sh + chrome,
        borderRadius: (kind === 'phone' ? 54 : 18) * unit, overflow: 'hidden', background: '#0B0D10',
        border: kind === 'phone' ? `${10 * unit}px solid #0B0D10` : undefined,
        boxShadow: '0 40px 90px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)'}}>
        {kind === 'browser' && (
          <div style={{height: chrome, background: '#ECEEF1', display: 'flex', alignItems: 'center', gap: 10 * unit, padding: `0 ${18 * unit}px`}}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 13 * unit, height: 13 * unit, borderRadius: 99, background: c}} />)}
            {d.url ? (
              <div style={{marginInline: 'auto', background: '#fff', borderRadius: 8 * unit, padding: `${4 * unit}px ${40 * unit}px`,
                fontFamily: FONT.tajawal, fontSize: 18 * unit, color: '#59606A'}}>{d.url}</div>
            ) : null}
          </div>
        )}
        <div style={{position: 'relative', width: sw, height: sh, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: ox, top: oy, width: sw * cam.z, height: sh * cam.z}}>
            {src ? (
              isVideo(src) ? (
                <OffthreadVideo src={staticFile(src)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : (
                <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              )
            ) : null}
          </div>
          {step?.box && (() => {
            const [bx, by, bw, bh] = step.box;
            const a = toScreen(bx, by);
            const k = interpolate(since, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'});
            return (
              <div style={{position: 'absolute', left: a.x, top: a.y, width: bw * sw * cam.z, height: bh * sh * cam.z,
                borderRadius: 14 * unit, border: `${3 * unit}px solid ${C.amber}`,
                boxShadow: `0 0 0 ${4000}px rgba(8,10,14,${0.5 * k})`, opacity: k}} />
            );
          })()}
          {step && step.click !== false && ripple < 1 && sp ? (
            <div style={{position: 'absolute', left: sp.x, top: sp.y, width: 90 * unit, height: 90 * unit, borderRadius: 99,
              border: `${4 * unit}px solid ${C.amber}`, transform: `translate(-50%,-50%) scale(${0.3 + ripple})`, opacity: 1 - ripple}} />
          ) : null}
          {steps.length ? (
            <div style={{position: 'absolute', left: cp.x - 6 * unit, top: cp.y - 4 * unit, transform: `scale(${press})`, transformOrigin: 'top left'}}>
              <Cursor size={46 * unit} />
            </div>
          ) : null}
        </div>
      </div>

      {step?.label && sp ? (
        <div dir="rtl" style={{...entStyle(calloutIn), position: 'absolute',
          left: Math.min(width - 520 * unit, Math.max(24 * unit, sx + sp.x - 250 * unit)),
          top: Math.min(height - 180 * unit, sy + sp.y + 60 * unit),
          width: 500 * unit, background: C.ink, color: '#fff', borderRadius: 22 * unit, padding: `${20 * unit}px ${26 * unit}px`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.3)'}}>
          <Ar text={step.label} size={34 * unit} weight={700} color="#fff" lh={1.4} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

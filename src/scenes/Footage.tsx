import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ar} from '../components/Text';
import {FONT, C} from '../theme';
import {E, tween} from '../lib/anim';
import {captionPages, stripTashkeel, type WordTiming} from '../lib/speech';
import type {SceneProps} from '../film/types';

/**
 * Footage: a real recording, trimmed by the EDL, dressed by the edit.
 *
 * `data.src` plays from `in` to `out` seconds (from `footage.py silence`); the
 * scene is pre-rolled, so the clip starts that many frames earlier but stays muted
 * until its own beat begins and fades out under the hand-off, which keeps jump cuts
 * clean. On top: punch-ins (`zoom`), b-roll inserts, a lower third and word-by-word
 * captions from the transcript (active word in the accent). Stills get a slow push.
 */

type Zoom = {at: number; scale?: number; dur?: number};
type Broll = {src: string; at: number; dur: number};
type Data = {
  src?: string;
  in?: number;
  out?: number;
  fit?: 'cover' | 'contain';
  words?: WordTiming[];
  captions?: boolean;
  zoom?: Zoom[];
  broll?: Broll[];
  lowerThird?: {title: string; sub?: string; at?: number; dur?: number};
};

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

const Media: React.FC<{src: string; fit: 'cover' | 'contain'; trimBefore?: number; volume?: (f: number) => number; muted?: boolean}> = ({
  src, fit, trimBefore = 0, volume, muted,
}) =>
  isVideo(src) ? (
    <OffthreadVideo src={staticFile(src)} trimBefore={trimBefore} volume={volume} muted={muted}
      style={{width: '100%', height: '100%', objectFit: fit}} />
  ) : (
    <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: fit}} />
  );

export const Footage: React.FC<SceneProps> = ({beat, vertical, preRoll = 0}) => {
  const raw = useCurrentFrame();
  const f = raw - preRoll;
  const {fps, width, height} = useVideoConfig();
  const d = (beat.data ?? {}) as Data;
  const t = f / fps;
  const unit = Math.min(width, height) / 1080;
  const src = d.src ?? '';
  const fit = d.fit ?? 'cover';
  const startF = Math.max(0, Math.round((d.in ?? 0) * fps) - preRoll);
  // silent through the pre-roll, full through the beat, out under the hand-off
  const volume = (vf: number) =>
    interpolate(vf, [preRoll - 1, preRoll, preRoll + beat.dur - 2, preRoll + beat.dur + 4], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

  const zoom = (d.zoom ?? []).reduce((z, p) => {
    const k = interpolate(t, [p.at, p.at + (p.dur ?? 0.25)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.outExpo});
    return z + ((p.scale ?? 1.12) - z) * k;
  }, isVideo(src) ? 1 : 1 + 0.06 * (f / Math.max(1, beat.dur)));

  const words = (d.words ?? []).map((w) => ({...w, w: stripTashkeel(w.w)}));
  const pages = captionPages(words, vertical ? 3 : 5);
  const page = pages.find((p) => t >= p[0].start - 0.05 && t <= p[p.length - 1].end + 0.25);
  const lt = d.lowerThird;
  const ltK = lt ? tween(f, Math.round((lt.at ?? 0.4) * fps), 18) * (1 - tween(f, Math.round(((lt.at ?? 0.4) + (lt.dur ?? 3.5)) * fps), 14)) : 0;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {src ? (
        <AbsoluteFill style={{transform: `scale(${zoom})`}}>
          <Media src={src} fit={fit} trimBefore={startF} volume={volume} />
        </AbsoluteFill>
      ) : null}
      {(d.broll ?? []).map((b, i) => (
        <Sequence key={i} from={preRoll + Math.round(b.at * fps)} durationInFrames={Math.max(1, Math.round(b.dur * fps))} layout="none">
          <AbsoluteFill>
            <Media src={b.src} fit="cover" muted />
          </AbsoluteFill>
        </Sequence>
      ))}
      {lt && ltK > 0.01 ? (
        <div dir="rtl" style={{position: 'absolute', right: 70 * unit, opacity: ltK,
          // vertical: under the Reels top chrome, clear of the caption band; wide: above it
          ...(vertical ? {top: height * 0.15} : {bottom: height * 0.22}),
          translate: `${(1 - ltK) * 50}px 0`, background: 'rgba(12,14,18,0.78)', borderRadius: 18 * unit,
          padding: `${16 * unit}px ${28 * unit}px`, borderRight: `${8 * unit}px solid ${C.amber}`}}>
          <Ar text={lt.title} size={40 * unit} weight={800} color="#fff" />
          {lt.sub ? <Ar text={lt.sub} size={28 * unit} color="rgba(255,255,255,0.78)" /> : null}
        </div>
      ) : null}
      {d.captions !== false && page ? (
        <div dir="rtl" style={{position: 'absolute', left: width * 0.08, right: width * 0.08,
          top: vertical ? height * 0.64 : undefined, bottom: vertical ? undefined : height * 0.08,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${16 * unit}px`}}>
          {page.map((w, i) => {
            const on = t >= w.start && t < w.end + 0.05;
            return (
              <span key={i} style={{fontFamily: FONT.tajawal, fontWeight: 900, fontSize: (vertical ? 72 : 58) * unit, lineHeight: 1.35,
                color: on ? C.amber : '#fff', letterSpacing: 0, scale: on ? '1.06' : '1',
                textShadow: '0 4px 18px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)'}}>
                {w.w}
              </span>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

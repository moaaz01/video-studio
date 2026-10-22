import React from "react";
import {AbsoluteFill, useCurrentFrame} from "remotion";
import {noise2D} from "@remotion/noise";

/**
 * The camera: one move per beat, never two. Everything is a pure function of the
 * frame, and the handheld component is Perlin noise (not Math.random) so a still
 * and the matching video frame are pixel-identical.
 */
export type CameraMode = "push-in" | "settle" | "drift" | "still";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A shutter can only blur motion that exists. The accent is a deliberate fast
 * displacement in the first frames of a beat: the camera settles into place, so
 * a 180-degree shutter has something to smear.
 */
const ACCENT_FRAMES = 7;

export const Camera: React.FC<{
  children: React.ReactNode;
  duration: number;
  mode?: CameraMode;
  strength?: number;
  accent?: boolean;
}> = ({children, duration, mode = "settle", strength = 1, accent = true}) => {
  const frame = useCurrentFrame();
  const p = duration <= 1 ? 0 : Math.min(1, Math.max(0, frame / (duration - 1)));
  const eased = easeOut(p);
  const s = strength;

  let scale = 1;
  let x = 0;
  let y = 0;

  if (accent) {
    const a = Math.max(0, 1 - frame / ACCENT_FRAMES);
    const kick = a * a; // decays fast: the smear lives in 3-4 frames
    scale += 0.055 * kick * s;
    x += 7 * kick * s;
  }

  if (mode === "push-in") scale = 1 + 0.045 * eased * s;
  if (mode === "settle") scale = 1 + 0.03 * (1 - eased) * s;
  if (mode === "drift") {
    x = (eased - 0.5) * 14 * s;
    y = (eased - 0.5) * -6 * s;
    scale = 1 + 0.012 * eased * s;
  }

  // handheld: sub-pixel breathing, identical for a given frame
  x += noise2D("cam-x", frame * 0.015, 0) * 2.4 * s;
  y += noise2D("cam-y", frame * 0.015, 1) * 1.8 * s;
  const rot = noise2D("cam-r", frame * 0.01, 2) * 0.12 * s;

  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)}) rotate(${rot.toFixed(4)}deg)`,
        transformOrigin: "50% 50%",
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const CAMERA_BY_KIND: Record<string, CameraMode> = {
  hook: "push-in",
  device: "settle",
  stat: "drift",
  cta: "push-in",
  open: "push-in",
  store: "push-in",
  design: "drift",
  admin: "push-in",
  security: "settle",
  close: "push-in",
  finale: "push-in",
};

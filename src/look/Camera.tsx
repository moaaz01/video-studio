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

export const Camera: React.FC<{
  children: React.ReactNode;
  duration: number;
  mode?: CameraMode;
  strength?: number;
}> = ({children, duration, mode = "settle", strength = 1}) => {
  const frame = useCurrentFrame();
  const p = duration <= 1 ? 0 : Math.min(1, Math.max(0, frame / (duration - 1)));
  const eased = easeOut(p);
  const s = strength;

  let scale = 1;
  let x = 0;
  let y = 0;

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
};

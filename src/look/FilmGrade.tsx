import React from "react";
import {AbsoluteFill, useCurrentFrame} from "remotion";
import type {Look} from "./looks";

/**
 * A 220px grain tile: fractal noise, desaturated, tiled. Rasterised once by
 * Chromium and reused, so the cost is a background-position change per frame.
 */
const GRAIN_TILE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/></filter>" +
      "<rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>",
  );

export const FilmGrade: React.FC<{look: Look; children: React.ReactNode}> = ({look, children}) => {
  const frame = useCurrentFrame();
  const g = look.grade;
  const barH = `${look.letterbox * 100}%`;

  return (
    <AbsoluteFill style={{background: "#000"}}>
      <AbsoluteFill
        style={{
          filter: `brightness(${g.brightness}) contrast(${g.contrast}) saturate(${g.saturate}) sepia(${g.sepia}) hue-rotate(${g.hue}deg)`,
        }}
      >
        {children}
      </AbsoluteFill>

      {look.bloom > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(120% 85% at 50% -12%, rgba(255,238,208,${0.12 * look.bloom}), rgba(255,238,208,0) 64%)`,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {look.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(118% 92% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,${0.6 * look.vignette}) 100%)`,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {look.grain > 0 ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url("${GRAIN_TILE}")`,
            backgroundSize: "220px 220px",
            backgroundPosition: `${(frame * 37) % 220}px ${(frame * 61) % 220}px`,
            opacity: look.grain,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {look.letterbox > 0 ? (
        <>
          <div style={{position: "absolute", left: 0, right: 0, top: 0, height: barH, background: "#000"}} />
          <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: barH, background: "#000"}} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

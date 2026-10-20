import React from "react";
import {AbsoluteFill, useCurrentFrame} from "remotion";
import type {Look} from "./looks";
import {gradeFilterId, gradeFor, tableValues} from "./grade";

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

export const FilmGrade: React.FC<{look: Look; children: React.ReactNode; overlays?: boolean}> = ({
  look,
  children,
  overlays = true,
}) => {
  const frame = useCurrentFrame();
  const grade = gradeFor(look.name);
  const id = gradeFilterId(look.name);
  const barH = `${look.letterbox * 100}%`;

  return (
    <AbsoluteFill style={{background: "#000"}}>
      {/* the grade itself: three transfer curves and one saturation matrix */}
      <svg aria-hidden style={{position: "absolute", width: 0, height: 0}}>
        <defs>
          <filter id={id} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tableValues(grade.curves.r)} />
              <feFuncG type="table" tableValues={tableValues(grade.curves.g)} />
              <feFuncB type="table" tableValues={tableValues(grade.curves.b)} />
            </feComponentTransfer>
            <feColorMatrix type="saturate" values={String(grade.saturate)} />
          </filter>
        </defs>
      </svg>

      <AbsoluteFill style={{filter: `url(#${id})`}}>{children}</AbsoluteFill>

      {overlays && look.bloom > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(120% 85% at 50% -12%, rgba(255,238,208,${0.12 * look.bloom}), rgba(255,238,208,0) 64%)`,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {overlays && look.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(118% 92% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,${0.6 * look.vignette}) 100%)`,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {overlays && look.grain > 0 ? (
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

      {overlays && look.letterbox > 0 ? (
        <>
          <div style={{position: "absolute", left: 0, right: 0, top: 0, height: barH, background: "#000"}} />
          <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: barH, background: "#000"}} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

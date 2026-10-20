import React from "react";
import {AbsoluteFill, Sequence} from "remotion";
import {FILM, SCENES} from "./Film";
import {C, FONT} from "../theme";

/**
 * A storyboard sheet rendered by the engine itself, not by an image library:
 * every panel is the real scene at its real local frame, so Arabic shaping,
 * fonts and spacing are exactly what the film will show. One still proves the
 * whole film's look and reads as a deliverable the client can annotate.
 */
const STILL_FRAME = 45; // the frame this composition is rendered at
const COLS = 3;
const CELL_W = 640;

export const Storyboard: React.FC = () => {
  const beats = FILM.beats.slice(0, 9);
  const rows = Math.max(1, Math.ceil(beats.length / COLS));
  const cellH = 1080 / rows;
  const scale = (CELL_W - 24) / 1920;

  return (
    <AbsoluteFill style={{background: C.inkBg}}>
      {beats.map((b, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const local = Math.max(1, Math.min(b.dur - 3, 40));
        const from = STILL_FRAME - local;
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: col * CELL_W + 10,
              top: row * cellH + 8,
              width: CELL_W - 20,
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: ((CELL_W - 20) * 9) / 16,
                overflow: "hidden",
                borderRadius: 10,
                border: "1px solid rgba(241,233,220,0.16)",
                background: "#000",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: 1920,
                  height: 1080,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <Sequence from={from} durationInFrames={local + 1} name={`panel-${b.id}`}>
                  {React.createElement(SCENES[b.kind], {beat: b, vertical: false})}
                </Sequence>
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 8,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13,
                  color: C.parchment,
                  background: "rgba(0,0,0,0.5)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {b.id} / {b.kind} / {(b.dur / FILM.fps).toFixed(1)}s
              </div>
            </div>
            <div
              dir="rtl"
              lang="ar"
              style={{
                fontFamily: FONT.tajawal,
                fontSize: 14,
                lineHeight: 1.55,
                color: C.parchmentSoft,
                marginTop: 5,
                maxHeight: 40,
                overflow: "hidden",
              }}
            >
              {(b.vo ?? []).join(" ")}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FilmGrade} from '../look/FilmGrade';
import {LOOKS} from '../look/looks';

/**
 * A grade probe: sixteen neutral steps plus the three palette anchors.
 *
 * Render it, sample the patches, and compare against src/generated/grade.json.
 * If the filter and the generator ever disagree, this is where it shows — the
 * film's look is then a bug, not a style.
 */
const STEPS = 16;

export const GradeLab: React.FC = () => (
  <FilmGrade look={LOOKS['cinema-warm']} overlays={false}>
    <AbsoluteFill style={{flexDirection: 'row'}}>
      {new Array(STEPS).fill(true).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: `rgb(${Math.round((i / (STEPS - 1)) * 255)}, ${Math.round((i / (STEPS - 1)) * 255)}, ${Math.round((i / (STEPS - 1)) * 255)})`,
          }}
        />
      ))}
    </AbsoluteFill>
  </FilmGrade>
);

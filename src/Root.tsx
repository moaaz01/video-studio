import React from 'react';
import {Composition} from 'remotion';
import './fonts';
import {FilmVertical, FilmWide, FILM} from './film/Film';
import {Storyboard} from './film/Storyboard';
import {GradeLab} from './lab/GradeLab';
import {StoreDev} from './store/DevScreens';

const VERTICAL = {width: 1080, height: 1920} as const;

/**
 * Two masters, one film: the same timeline re-composed for each aspect.
 * Register anything else you need (stills, a single-scene comp for iterating)
 * next to these — but keep the ids stable, the render scripts use them.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Studio16x9"
      component={FilmWide}
      durationInFrames={FILM.frames}
      fps={FILM.fps}
      width={FILM.width}
      height={FILM.height}
    />
    <Composition
      id="Studio9x16"
      component={FilmVertical}
      durationInFrames={FILM.frames}
      fps={FILM.fps}
      width={VERTICAL.width}
      height={VERTICAL.height}
      defaultProps={{captions: false}}
    />
    <Composition
      id="Storyboard"
      component={Storyboard}
      durationInFrames={60}
      fps={FILM.fps}
      width={1920}
      height={1080}
    />
    <Composition
      id="Portrait4x5"
      component={FilmVertical}
      durationInFrames={FILM.frames}
      fps={FILM.fps}
      width={1080}
      height={1350}
    />
    <Composition
      id="Square1x1"
      component={FilmVertical}
      durationInFrames={FILM.frames}
      fps={FILM.fps}
      width={1080}
      height={1080}
    />
    <Composition
      id="GradeLab"
      component={GradeLab}
      durationInFrames={2}
      fps={FILM.fps}
      width={1920}
      height={1080}
    />
    {/* Dev stills for the store kit; never a master. 824×1830 = one screen at 2×. */}
    <Composition
      id="StoreDev"
      component={StoreDev}
      durationInFrames={120}
      fps={FILM.fps}
      width={824}
      height={1830}
      defaultProps={{screen: 'home', t: 40, dp: 2, frame: true}}
    />
  </>
);

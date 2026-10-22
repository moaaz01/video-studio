/**
 * The phone as a physical object, not a screenshot in a rectangle.
 *
 * Titanium frame with a key + rim light, real bezel, camera island, side buttons,
 * a glass reflection that travels over the screen, and a cast shadow. The screen
 * content is the store canvas at `412 × 915` logical px scaled by `dp`.
 *
 * Everything here is a pure function of the props; the scene owns the pose.
 */
import React from 'react';
import {S} from './tokens';

export type PhonePose = {
  x?: number; // px, centre of the device
  y?: number;
  w?: number; // device width in px (frame included)
  rot?: number; // deg in plane
  rx?: number; // 3D tilt, deg
  ry?: number;
  r?: number; // corner radius scale
};

export const SCREEN_RATIO = 915 / 412;
/** Device height / width, derived from a real bezel — a 21:9-class handset. */
export const PHONE_RATIO = (412 / 435) * SCREEN_RATIO + (1 - 412 / 435);

/** Screen width as a share of the device width (real bezel: 435 vs 412). */
export const SCREEN_SHARE = 412 / 435;

export const PhonePro: React.FC<{
  width: number; // device width in px
  children: React.ReactNode;
  glow?: number; // 0..1 ambient teal light
  gold?: number; // 0..1 saffron rim
  reflection?: number; // 0..1 travelling sheen
  shadow?: boolean;
  pose?: PhonePose;
  style?: React.CSSProperties;
}> = ({width, children, glow = 0.6, gold = 0.15, reflection = 0.35, shadow = true, pose, style}) => {
  const bezel = (width * (1 - SCREEN_SHARE)) / 2;
  const screenW = width * SCREEN_SHARE;
  const screenH = screenW * SCREEN_RATIO;
  const h = screenH + bezel * 2;
  const radius = width * 0.115;

  return (
    <div
      style={{
        position: 'absolute',
        left: (pose?.x ?? 0) - width / 2,
        top: (pose?.y ?? 0) - h / 2,
        width,
        height: h,
        transform: `perspective(${width * 2.4}px) rotateX(${pose?.rx ?? 0}deg) rotateY(${pose?.ry ?? 0}deg) rotateZ(${pose?.rot ?? 0}deg)`,
        transformStyle: 'preserve-3d',
        zIndex: 2,
        ...style,
      }}
    >
      {/* cast shadow on the stage */}
      {shadow && (
        <div
          style={{
            position: 'absolute',
            left: width * 0.02,
            right: width * 0.02,
            bottom: -width * 0.09,
            height: width * 0.16,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(0,0,0,0.62), rgba(0,0,0,0.28) 55%, transparent 100%)',
            filter: `blur(${width * 0.03}px)`,
            transform: 'translateZ(-1px)',
          }}
        />
      )}

      {/* ambient light the product throws at the stage */}
      <div
        style={{
          position: 'absolute',
          inset: -width * 0.16,
          borderRadius: radius * 1.6,
          background: `radial-gradient(closest-side, rgba(42,165,169,${0.34 * glow}), rgba(15,124,128,${0.16 * glow}) 55%, transparent 100%)`,
          filter: `blur(${width * 0.08}px)`,
          transform: 'translateZ(-2px)',
        }}
      />

      {/* titanium band */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background:
            'linear-gradient(150deg, #9AA6AC 0%, #4A565E 14%, #1B2228 38%, #2C353C 52%, #0E1418 62%, #3E4A52 78%, #8C989E 92%, #2A3238 100%)',
          boxShadow: `0 ${width * 0.02}px ${width * 0.05}px rgba(0,0,0,0.5), inset 0 0 0 ${Math.max(1, width * 0.002)}px rgba(255,255,255,0.28)`,
          padding: Math.max(2, width * 0.003),
        }}
      >
        {/* inner black seal */}
        <div
          style={{
            position: 'absolute',
            inset: Math.max(2, width * 0.003),
            borderRadius: radius * 0.96,
            background: '#06090C',
          }}
        />
      </div>

      {/* rim light: teal on the left, saffron on the right — the room's two sources */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: `linear-gradient(115deg, rgba(180,245,240,${0.30 * glow}) 0%, transparent 18%, transparent 82%, rgba(255,214,150,${0.34 * gold}) 100%)`,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />

      {/* side buttons */}
      {[0.62, 0.72, 0.82].map((t, i) => (
        <div
          key={`r${i}`}
          style={{
            position: 'absolute',
            right: -Math.max(1.5, width * 0.006),
            top: h * t,
            width: Math.max(2, width * 0.008),
            height: h * (i === 0 ? 0.055 : 0.04),
            borderRadius: 2,
            background: 'linear-gradient(180deg,#6C7A82,#232B31)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: -Math.max(1.5, width * 0.006),
          top: h * 0.68,
          width: Math.max(2, width * 0.008),
          height: h * 0.075,
          borderRadius: 2,
          background: 'linear-gradient(180deg,#6C7A82,#232B31)',
        }}
      />

      {/* the screen */}
      <div
        style={{
          position: 'absolute',
          left: bezel,
          top: bezel,
          width: screenW,
          height: screenH,
          borderRadius: radius * 0.9,
          overflow: 'hidden',
          background: S.bg,
          isolation: 'isolate',
        }}
      >
        {children}

        {/* camera island */}
        <div
          style={{
            position: 'absolute',
            top: width * 0.028,
            left: '50%',
            width: width * 0.26,
            height: width * 0.075,
            marginLeft: -width * 0.13,
            borderRadius: 999,
            background: '#05080A',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: width * 0.035,
          }}
        >
          <div
            style={{
              width: width * 0.03,
              height: width * 0.03,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #1B2B33 0%, #05080A 60%)',
              boxShadow: 'inset 0 0 0 1px rgba(120,200,200,0.18)',
            }}
          />
        </div>

        {/* travelling glass reflection */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(118deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 18%, transparent 34%, transparent 66%, rgba(255,255,255,0.07) 82%, rgba(255,255,255,0.16) 100%)',
            opacity: reflection,
            mixBlendMode: 'screen',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -screenH * 0.35,
            left: -screenW * 0.6,
            width: screenW * 0.5,
            height: screenH * 1.7,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)',
            transform: `rotate(18deg) translateX(${(reflection - 0.35) * screenW * 1.6}px)`,
            filter: `blur(${screenW * 0.02}px)`,
            pointerEvents: 'none',
            mixBlendMode: 'screen',
            opacity: 0.55,
          }}
        />

        {/* screen edge falloff so the glass reads as glass */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: radius * 0.9,
            boxShadow: `inset 0 0 ${screenW * 0.05}px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.10)`,
          }}
        />
      </div>
    </div>
  );
};

import React, {createContext, useContext} from 'react';
import {APP_H_DP, APP_W_DP, C, PHONE} from '../theme';

export const DpCtx = createContext(1.0534);
/** Convert the app's dp to on-screen px inside a phone. */
export const useDp = () => useContext(DpCtx);

/** False in the vertical cut, where the OS bar would double the platform's own. */
export const StatusCtx = createContext(true);

export const Phone: React.FC<{
  /** on-screen width in px of the whole device (frame included) */
  width?: number;
  children?: React.ReactNode;
  rotateY?: number;
  rotateX?: number;
  rotateZ?: number;
  translateY?: number;
  scale?: number;
  /** screen background behind the app content */
  screen?: string;
  glowColor?: string;
  glowStrength?: number;
  style?: React.CSSProperties;
  /** dims the screen, for when a headline must win */
  screenDim?: number;
}> = ({
  width = PHONE.width,
  children,
  rotateY = 0,
  rotateX = 0,
  rotateZ = 0,
  translateY = 0,
  scale = 1,
  screen = C.paper,
  glowColor = '#0E8A6E',
  glowStrength = 0.5,
  screenDim = 0,
  style,
}) => {
  const dp = width / APP_W_DP;
  const h = APP_H_DP * dp;
  const bezel = Math.max(6, Math.round(PHONE.bezel * dp));

  return (
    <div
      style={{
        position: 'relative',
        width,
        height: h,
        transform: `perspective(2400px) translate3d(0,${translateY}px,0) rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {/* cast shadow on the ground */}
      <div
        style={{
          position: 'absolute',
          left: '6%',
          right: '6%',
          bottom: -34,
          height: 64,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(17,78,71,${0.34 * glowStrength}) 0%, rgba(17,78,71,0) 72%)`,
          filter: 'blur(14px)',
        }}
      />
      {/* screen bloom — the phone lights the room */}
      <div
        style={{
          position: 'absolute',
          inset: -width * 0.16,
          borderRadius: width,
          background: `radial-gradient(circle at 50% 46%, ${glowColor}${Math.round(
            glowStrength * 46,
          )
            .toString(16)
            .padStart(2, '0')} 0%, transparent 62%)`,
          filter: 'blur(30px)',
        }}
      />

      {/* titanium frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: PHONE.frameRadius * dp * 1.0,
          background:
            'linear-gradient(122deg,#4A4E57 0%,#23262C 18%,#15171B 42%,#2C3038 58%,#101216 78%,#3B3F48 100%)',
          boxShadow:
            '0 44px 96px -34px rgba(10,42,36,0.55), 0 14px 32px -12px rgba(10,42,36,0.34), inset 0 0 0 1px rgba(255,255,255,0.10)',
          padding: bezel,
          boxSizing: 'border-box',
        }}
      >
        {/* side keys */}
        <div
          style={{
            position: 'absolute',
            insetInlineEnd: -2.5,
            top: h * 0.2,
            width: 3.5,
            height: h * 0.075,
            borderRadius: 3,
            background: 'linear-gradient(180deg,#565B66,#1E2126)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            insetInlineStart: -2.5,
            top: h * 0.19,
            width: 3.5,
            height: h * 0.11,
            borderRadius: 3,
            background: 'linear-gradient(180deg,#4E535D,#1A1D22)',
          }}
        />

        {/* screen */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: PHONE.screenRadius * dp,
            overflow: 'hidden',
            background: screen,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.55)',
          }}
        >
          {/* screen gloss — a single soft diagonal sheen reads as glass */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(118deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 16%, rgba(255,255,255,0) 38%)',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          />
          {screenDim > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `rgba(26,42,54,${screenDim})`,
                zIndex: 39,
                pointerEvents: 'none',
              }}
            />
          )}

          <DpCtx.Provider value={dp}>
            <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>{children}</div>
          </DpCtx.Provider>

          {/* punch-hole camera */}
          <div
            style={{
              position: 'absolute',
              top: 11 * dp,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 9 * dp,
              height: 9 * dp,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 34% 30%, #1B1F27 0%, #05070A 62%)',
              boxShadow: 'inset 0 0 0 0.8px rgba(255,255,255,0.12)',
              zIndex: 41,
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Android gesture bar. */
export const HomeIndicator: React.FC<{color?: string; opacity?: number}> = ({
  color = C.ink,
  opacity = 0.24,
}) => {
  const dp = useDp();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 7 * dp,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 118 * dp,
          height: 3.5 * dp,
          borderRadius: 3 * dp,
          background: color,
          opacity,
        }}
      />
    </div>
  );
};

/** Transparent status bar: app content shows through, icons are dark on paper. */
export const StatusBar: React.FC<{time?: string; dark?: boolean; top?: number}> = ({
  time = '9:41',
  dark = false,
  top = 13,
}) => {
  const dp = useDp();
  const show = useContext(StatusCtx);
  const fg = dark ? C.parchment : C.ink;
  const h = 22 * dp;
  if (!show) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: top * dp,
        left: 0,
        right: 0,
        height: h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: 22 * dp,
        zIndex: 25,
        pointerEvents: 'none',
        direction: 'ltr',
      }}
    >
      {/* RTL system: clock sits at the inline-start = the right edge */}
      <span
        style={{
          fontFamily: 'Tajawal',
          fontSize: 13 * dp,
          fontWeight: 700,
          color: fg,
          opacity: 0.9,
          letterSpacing: 0,
          direction: 'ltr',
          order: 2,
        }}
      >
        {time}
      </span>
      <span style={{display: 'flex', alignItems: 'center', gap: 5 * dp, order: 1}}>
        {/* signal */}
        <span style={{display: 'flex', alignItems: 'flex-end', gap: 1.6 * dp}}>
          {[3.2, 5.2, 7.2, 9.2].map((hh, i) => (
            <span
              key={i}
              style={{
                width: 2.6 * dp,
                height: hh * dp,
                borderRadius: 0.8 * dp,
                background: fg,
                opacity: i === 3 ? 0.42 : 0.88,
              }}
            />
          ))}
        </span>
        {/* wifi */}
        <svg width={15 * dp} height={11 * dp} viewBox="0 0 15 11" style={{opacity: 0.9}}>
          <path
            d="M7.5 10.2 5.1 7.5A3.6 3.6 0 0 1 9.9 7.5ZM7.5 3.1c1.9 0 3.7.7 5 2L14 3.4A9.1 9.1 0 0 0 1 3.4l1.5 1.7a7.1 7.1 0 0 1 5-2Z"
            fill={fg}
          />
        </svg>
        {/* battery */}
        <span style={{display: 'flex', alignItems: 'center', gap: 1.4 * dp}}>
          <span
            style={{
              position: 'relative',
              width: 21 * dp,
              height: 10.4 * dp,
              borderRadius: 3 * dp,
              border: `1px solid ${fg}`,
              opacity: 0.55,
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 1.6 * dp,
                right: 5.4 * dp,
                borderRadius: 1.4 * dp,
                background: fg,
                opacity: 1,
              }}
            />
          </span>
          <span
            style={{
              width: 1.6 * dp,
              height: 4 * dp,
              borderRadius: 1 * dp,
              background: fg,
              opacity: 0.4,
            }}
          />
        </span>
      </span>
    </div>
  );
};

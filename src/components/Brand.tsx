import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {entStyle, entrance, sp, tween, E} from '../lib/anim';
import {C, FONT, R, shadow} from '../theme';
import {BRAND, type Contact} from '../brand';
import {Ico} from './Ico';

/** The mark. Uses the real icon when one is provided, else a monogram tile. */
export const AppIcon: React.FC<{size: number; radius?: number}> = ({size, radius}) => {
  const r = radius ?? size * 0.235;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: 'hidden',
        flexShrink: 0,
        background: BRAND.icon
          ? C.paperRaised
          : `linear-gradient(145deg, ${C.parchment}, ${C.parchmentSoft})`,
        boxShadow: `0 ${size * 0.06}px ${size * 0.18}px -${size * 0.06}px rgba(10,107,86,0.45), inset 0 0 0 1px rgba(26,42,54,0.10)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {BRAND.icon ? (
        <Img src={staticFile(BRAND.icon)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      ) : (
        <span
          style={{
            fontFamily: FONT.tajawal,
            fontWeight: 800,
            fontSize: size * 0.52,
            lineHeight: 1,
            color: BRAND.accentDeep,
            letterSpacing: 0,
          }}
        >
          {BRAND.monogram}
        </span>
      )}
    </div>
  );
};

export const Wordmark: React.FC<{size: number; color?: string; delay?: number}> = ({
  size,
  color = C.ink,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const e = entrance(frame, delay, {dist: 14, dur: 28});
  return (
    <span
      style={{
        fontFamily: FONT.tajawal,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.05,
        color,
        letterSpacing: 0,
        ...entStyle(e),
      }}
    >
      {BRAND.name}
    </span>
  );
};

/** Rubber stamp: rotated, hairline border, letterpress feel. */
export const Stamp: React.FC<{text: string; size?: number; color?: string; rotate?: number; delay?: number}> = ({
  text,
  size = 44,
  color = C.emerald,
  rotate = -9,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const t = sp(frame, 30, delay, {damping: 16, stiffness: 140});
  return (
    <div
      dir="rtl"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${size * 0.28}px ${size * 0.55}px`,
        border: `${Math.max(2, size * 0.055)}px solid ${color}`,
        borderRadius: size * 0.2,
        transform: `rotate(${rotate}deg) scale(${0.9 + 0.1 * t})`,
        opacity: Math.min(1, t * 1.4),
        color,
        fontFamily: FONT.tajawal,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: 0,
        lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
};

/** The action. The handle is the largest type because the handle is the CTA. */
export const DownloadBadge: React.FC<{
  label?: string;
  value?: string;
  sub?: string;
  delay?: number;
  width?: number;
  tone?: 'ink' | 'light';
}> = ({label = BRAND.action.label, value = BRAND.action.value, sub = BRAND.action.sub, delay = 0, width = 620, tone = 'ink'}) => {
  const frame = useCurrentFrame();
  const e = entrance(frame, delay, {dist: 20, dur: 30});
  const dark = tone === 'ink';
  return (
    <div
      dir="rtl"
      style={{
        width,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '20px 26px',
        borderRadius: R.lg,
        background: dark ? '#0B0E10' : C.paperRaised,
        border: dark ? '1px solid rgba(255,255,255,0.10)' : `1px solid ${C.hairline}`,
        boxShadow: shadow.float,
        ...entStyle(e),
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 999,
          flexShrink: 0,
          background: 'linear-gradient(150deg,#37AEE2,#1E96C8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name="send" size={32} color="#fff" />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0}}>
        <span
          style={{
            fontFamily: FONT.tajawal,
            fontWeight: 500,
            fontSize: 26,
            lineHeight: 1.25,
            letterSpacing: 0,
            color: dark ? 'rgba(255,255,255,0.62)' : C.inkSoft,
          }}
        >
          {label}
        </span>
        <span
          dir="ltr"
          style={{
            fontFamily: FONT.tajawal,
            fontWeight: 800,
            fontSize: 40,
            lineHeight: 1.1,
            letterSpacing: 0,
            color: dark ? '#FFFFFF' : C.ink,
            textAlign: 'right',
            unicodeBidi: 'isolate',
          }}
        >
          {value}
        </span>
        {sub ? (
          <span
            style={{
              fontFamily: FONT.tajawal,
              fontWeight: 500,
              fontSize: 20,
              lineHeight: 1.3,
              letterSpacing: 0,
              color: dark ? 'rgba(255,255,255,0.5)' : C.inkFaint,
            }}
          >
            {sub}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const WhatsAppMark: React.FC<{size: number; opacity?: number}> = ({size, opacity = 0.9}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{display: 'block', flexShrink: 0, opacity}} fill="#FFFFFF">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.97 1.16-.2.2-.4.22-.69.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01c-1.76 0-3.49-.47-5.02-1.37l-.36-.22-3.73.98 1-3.65-.24-.37A9.86 9.86 0 0 1 2.18 11.9C2.18 6.45 6.61 2.02 12.06 2.02c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.23-6.17-3.48-8.41" />
  </svg>
);

const CONTACT_ICON: Record<Contact['kind'], string> = {
  telegram: 'send',
  whatsapp: 'chatBubble',
  web: 'language',
};

export const ContactChip: React.FC<{contact: Contact; delay?: number; width?: number}> = ({contact, delay = 0, width}) => {
  const frame = useCurrentFrame();
  const e = entrance(frame, delay, {dist: 12, dur: 26});
  return (
    <div
      dir="rtl"
      style={{
        width,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 18px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.22)',
        background: 'rgba(255,255,255,0.08)',
        ...entStyle(e),
      }}
    >
      {contact.kind === 'whatsapp' ? (
        <WhatsAppMark size={26} opacity={0.92} />
      ) : (
        <Ico name={CONTACT_ICON[contact.kind]} size={26} color="#FFFFFF" opacity={0.9} />
      )}
      <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
        <span
          style={{
            fontFamily: FONT.tajawal,
            fontWeight: 500,
            fontSize: 18,
            lineHeight: 1.2,
            letterSpacing: 0,
            color: 'rgba(255,255,255,0.66)',
          }}
        >
          {contact.label}
        </span>
        <span
          dir={/[\u0600-\u06FF]/.test(contact.value) ? 'rtl' : 'ltr'}
          style={{
            fontFamily: FONT.tajawal,
            fontWeight: 700,
            fontSize: 24,
            lineHeight: 1.2,
            letterSpacing: 0,
            color: '#FFFFFF',
            unicodeBidi: 'isolate',
            textAlign: 'right',
          }}
        >
          {contact.value}
        </span>
      </div>
    </div>
  );
};

/** Decorative tape strip: paper texture on a corner. */
export const Tape: React.FC<{width?: number; rotate?: number; style?: React.CSSProperties}> = ({width = 220, rotate = -6, style}) => {
  const frame = useCurrentFrame();
  const t = tween(frame, 0, 30, E.outQuart);
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height: width * 0.28,
        background: 'rgba(241,233,220,0.72)',
        boxShadow: '0 2px 6px rgba(26,42,54,0.18)',
        transform: `rotate(${rotate}deg) scaleX(${t})`,
        ...style,
      }}
    />
  );
};

export const BrandPlate: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>{children}</AbsoluteFill>
);

/**
 * The store film's UI kit — the primitives every screen is built from.
 *
 * These are reconstructed from the real Mini App's own kit (`webapp/src/lib/ui/*`,
 * `storefront/components/*`) and use only tokens transcribed in `src/store/tokens.ts`.
 * Everything is in the app's *logical* pixels (412 × 915); `AppCanvas` scales the whole
 * canvas by `dp` so a screen is authored once and rendered at any size.
 *
 * Animation contract: screens receive `t` (frames since their shot began) and are pure
 * functions of it. Primitives are static; timing lives in the screen.
 */
import React from 'react';
import {S, R, F, SH, GLASS, APP} from './tokens';
import {HOME} from './demo';
import {E, tween} from '../lib/anim';

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────────── */

export type ScreenProps = {dp: number; t: number};

export type IconName =
  | 'home'
  | 'orders'
  | 'wallet'
  | 'user'
  | 'search'
  | 'bell'
  | 'back'
  | 'forward'
  | 'check'
  | 'copy'
  | 'lock'
  | 'shield'
  | 'send'
  | 'bag'
  | 'grid'
  | 'spark'
  | 'close'
  | 'dots'
  | 'plus'
  | 'phone'
  | 'telegram'
  | 'history'
  | 'gift'
  | 'users'
  | 'star'
  | 'down'
  | 'refresh'
  | 'coupon'
  | 'chart'
  | 'coin'
  | 'alert'
  | 'eye'
  | 'bolt';

const PATHS: Record<IconName, string> = {
  home: 'M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z',
  orders: 'M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z M9 8h6 M9 12h6',
  wallet: 'M4 7.5h16v12H4z M4 7.5 16.5 4v3.5 M16 13.5h2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16.2 16.2 21 21',
  bell: 'M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 6 2 6.5H4.5c.5-.5 2-2.5 2-6.5z M10 19.5a2 2 0 0 0 4 0',
  back: 'M15 5.5 8.5 12l6.5 6.5',
  forward: 'M9 5.5 15.5 12 9 18.5',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  copy: 'M8 8h11v11H8z M5 16V5h11',
  lock: 'M6 10.5h12V20H6z M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
  shield: 'M12 3.5 20 6.5v6c0 4.8-3.4 7.7-8 8.5-4.6-.8-8-3.7-8-8.5v-6z',
  send: 'M4 11.5 21 4l-7 17-3-7z M11 14l10-10',
  bag: 'M5.5 8h13l1 12.5h-15z M9 8V6.5a3 3 0 0 1 6 0V8',
  grid: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z',
  spark: 'M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5 9.6 14.4 3.5 12l6.1-2.4z',
  close: 'M6 6l12 12 M18 6 6 18',
  dots: 'M5 12h.01 M12 12h.01 M19 12h.01',
  plus: 'M12 5v14 M5 12h14',
  phone: 'M7 3.5h10v17H7z M10.5 18h3',
  telegram: 'M21 4 3 11l5.5 2L11 20l3-5.5L21 4z',
  history: 'M12 4a8 8 0 1 1-7.5 5.2 M4 4v4h4 M12 8v5l3.5 2',
  gift: 'M4 9h16v11H4z M4 9V6.5h16V9 M12 6.5V20 M8.5 6.5c-2 0-2.5-3 0-3s3.5 3 3.5 3 M15.5 6.5c2 0 2.5-3 0-3s-3.5 3-3.5 3',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c1-3 3.4-4.5 6.5-4.5s5.5 1.5 6.5 4.5 M17 4.5a3.5 3.5 0 0 1 0 7 M18 15.5c2 .6 3.3 2.1 3.9 4.5',
  star: 'M12 3.5 14.6 9l5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.9 1-5.9L3.5 9.8 9.4 9z',
  down: 'M12 4v12 M6.5 11 12 17l5.5-6',
  refresh: 'M20 5v5h-5 M4 19v-5h5 M19.5 10a7.5 7.5 0 0 0-13-4L4 8 M4.5 14a7.5 7.5 0 0 0 13 4l2.5-2',
  coupon: 'M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z M12 7v14',
  chart: 'M4 20V4 M4 20h16 M8 16v-4 M12.5 16V8 M17 16v-6',
  coin: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M14.5 8.5h-3.5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9.5 M12 6.5v2 M12 16.5v2',
  alert: 'M12 3.5 21 20H3z M12 9.5v5 M12 17.5h.01',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bolt: 'M13.5 3 5 13.5h5.5L9.5 21 19 10h-5.7z',
};

export const Icon: React.FC<{
  name: IconName;
  size?: number;
  color?: string;
  sw?: number;
  style?: React.CSSProperties;
}> = ({name, size = 22, color = 'currentColor', sw = 1.9, style}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{flex: 'none', ...style}}
  >
    <path d={PATHS[name]} />
  </svg>
);

/** Latin-isolated numbers — the app never renders Arabic-Indic digits in values. */
export const Num: React.FC<{
  v: number | string;
  size?: number;
  family?: 'display' | 'text';
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({v, size = 16, family = 'display', weight = 600, color = S.ink, style}) => (
  <span
    dir="ltr"
    style={{
      fontFamily: family === 'display' ? F.display : F.text,
      fontSize: size,
      fontWeight: weight,
      color,
      fontVariantNumeric: 'tabular-nums',
      unicodeBidi: 'isolate',
      ...style,
    }}
  >
    {v}
  </span>
);

/** Money: Reem Kufi with a smaller currency symbol, like the app's `Price.svelte`. */
export const Price: React.FC<{value: string; size?: number; color?: string; weight?: number; style?: React.CSSProperties}> = ({
  value,
  size = 20,
  color = S.ink,
  weight = 600,
  style,
}) => {
  const m = value.match(/^([^\d\u0660-\u0669]+)\s*(.*)$/);
  if (!m) {
    return <Num v={value} size={size} color={color} weight={weight} style={style} />;
  }
  return (
    <span dir="ltr" style={{display: 'inline-flex', alignItems: 'baseline', gap: 5, unicodeBidi: 'isolate', color, ...style}}>
      <span style={{fontFamily: F.display, fontSize: size * 0.55, fontWeight: 600}}>{m[1]}</span>
      <span style={{fontFamily: F.display, fontSize: size, fontWeight: weight, fontVariantNumeric: 'tabular-nums'}}>{m[2]}</span>
    </span>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Surfaces
 * ──────────────────────────────────────────────────────────────────────────── */

export const Card: React.FC<{
  children: React.ReactNode;
  pad?: number;
  radius?: number;
  bg?: string;
  shadow?: string;
  border?: boolean;
  style?: React.CSSProperties;
}> = ({children, pad = 16, radius = R.md, bg = S.solid1, shadow = SH.e1, border = true, style}) => (
  <div
    style={{
      background: bg,
      borderRadius: radius,
      boxShadow: border ? `${shadow}, inset 0 0 0 1px ${S.border}` : shadow,
      padding: pad,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Row: React.FC<{
  children: React.ReactNode;
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  style?: React.CSSProperties;
}> = ({children, gap = 10, align = 'center', justify = 'flex-start', style}) => (
  <div dir="rtl" style={{display: 'flex', alignItems: align, justifyContent: justify, gap, ...style}}>
    {children}
  </div>
);

export const Divider: React.FC<{color?: string; dashed?: boolean; style?: React.CSSProperties}> = ({
  color = S.border,
  dashed = false,
  style,
}) => (
  <div
    style={{
      height: 1,
      width: '100%',
      background: dashed
        ? `repeating-linear-gradient(to right, ${color} 0 6px, transparent 6px 12px)`
        : color,
      ...style,
    }}
  />
);

export const SectionTitle: React.FC<{children: React.ReactNode; action?: React.ReactNode; style?: React.CSSProperties}> = ({
  children,
  action,
  style,
}) => (
  <Row justify="space-between" style={{marginBottom: 10, ...style}}>
    <span style={{fontFamily: F.text, fontSize: 15.5, fontWeight: 600, color: S.ink}}>{children}</span>
    {action}
  </Row>
);

export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: 'soft' | 'brand' | 'gold' | 'outline';
  active?: boolean;
  size?: number;
  style?: React.CSSProperties;
}> = ({children, tone = 'soft', active = false, size = 12.5, style}) => {
  const map = {
    soft: {bg: S.sunken, fg: S.muted, border: 'transparent'},
    brand: {bg: S.brandSoft, fg: S.brandText, border: 'transparent'},
    gold: {bg: S.saffronSoft, fg: S.saffronText, border: 'transparent'},
    outline: {bg: 'transparent', fg: S.muted, border: S.borderStrong},
  }[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: active ? S.brand : map.bg,
        color: active ? S.onBrand : map.fg,
        border: `1px solid ${active ? S.brand : map.border}`,
        borderRadius: R.pill,
        padding: '5px 11px',
        fontFamily: F.text,
        fontSize: size,
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const Btn: React.FC<{
  children: React.ReactNode;
  tone?: 'brand' | 'gold' | 'ghost' | 'white';
  size?: 'md' | 'lg';
  full?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({children, tone = 'brand', size = 'md', full = false, icon, style}) => {
  const map = {
    brand: {
      background: `linear-gradient(180deg, ${S.brandDark} 0%, ${S.brand} 100%)`,
      color: S.onBrand,
      boxShadow: `0 10px 20px -10px ${S.brand}, inset 0 1px 0 rgba(255,255,255,0.22)`,
    },
    gold: {
      background: `linear-gradient(180deg, #F7B95A 0%, ${S.saffron} 100%)`,
      color: S.saffronInk,
      boxShadow: `0 10px 22px -10px rgba(242,169,59,0.9), inset 0 1px 0 rgba(255,255,255,0.35)`,
    },
    ghost: {background: S.sunken, color: S.ink, boxShadow: 'none'},
    white: {background: S.solid1, color: S.ink, boxShadow: SH.e1},
  }[tone];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: size === 'lg' ? 54 : 44,
        paddingInline: size === 'lg' ? 22 : 18,
        borderRadius: size === 'lg' ? 16 : 14,
        fontFamily: F.text,
        fontSize: size === 'lg' ? 17 : 15,
        fontWeight: 600,
        lineHeight: 1.2,
        width: full ? '100%' : undefined,
        ...map,
        ...style,
      }}
    >
      {icon}
      {children}
    </div>
  );
};

export const StatusPill: React.FC<{tone: 'brand' | 'success' | 'warning' | 'danger'; label: string}> = ({tone, label}) => {
  const c = {brand: {bg: S.brandSoft, fg: S.brandText}, success: {bg: 'rgba(30,158,106,0.12)', fg: S.success}, warning: {bg: S.saffronSoft, fg: S.saffronText}, danger: {bg: 'rgba(217,72,59,0.10)', fg: S.danger}}[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: c.bg,
        color: c.fg,
        borderRadius: R.pill,
        padding: '4px 9px',
        fontSize: 11.5,
        fontWeight: 600,
        fontFamily: F.text,
        lineHeight: 1.45,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{width: 5, height: 5, borderRadius: 3, background: c.fg}} />
      {label}
    </span>
  );
};

export const ListRow: React.FC<{
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  divider?: boolean;
  style?: React.CSSProperties;
}> = ({icon, iconBg = S.brandSoft, title, sub, right, rightSub, divider = false, style}) => (
  <div style={style}>
    <Row gap={12} style={{paddingBlock: 11}}>
      {icon && (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: iconBg,
            color: S.brandText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          {icon}
        </div>
      )}
      <div style={{flex: 1, minWidth: 0, textAlign: 'start'}}>
        <div
          style={{
            fontFamily: F.text,
            fontSize: 13.5,
            fontWeight: 600,
            color: S.ink,
            lineHeight: 1.45,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {sub && (
          <div style={{fontFamily: F.text, fontSize: 11.5, color: S.muted, lineHeight: 1.5, marginTop: 2}}>{sub}</div>
        )}
      </div>
      <div style={{textAlign: 'end', flex: 'none'}}>
        {right}
        {rightSub && <div style={{fontSize: 10.5, color: S.faint, marginTop: 2}}>{rightSub}</div>}
      </div>
    </Row>
    {divider && <Divider />}
  </div>
);

export const Avatar: React.FC<{name: string; size?: number; ring?: boolean}> = ({name, size = 42, ring = false}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: `linear-gradient(145deg, ${S.brandDark}, ${S.brand} 55%, #0A5B5E)`,
      color: S.onBrand,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.display,
      fontSize: size * 0.42,
      fontWeight: 600,
      flex: 'none',
      boxShadow: ring ? `inset 0 0 0 2px ${S.solid1}, ${SH.e1}` : SH.e1,
    }}
  >
    {name.trim().charAt(0)}
  </div>
);

/** The product's own mark: the ticket/coupon glyph from the app favicon. */
export const StoreLogo: React.FC<{size?: number; style?: React.CSSProperties}> = ({size = 44, style}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(150deg, ${S.brandDark} 0%, ${S.brand} 52%, #0A6064 100%)`,
      boxShadow: `0 8px 18px -8px ${S.brand}, inset 0 1px 0 rgba(255,255,255,0.25)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
      ...style,
    }}
  >
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64" fill="none">
      <rect x="10" y="14" width="44" height="36" rx="7" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M32 15v34" stroke="#FFFFFF" strokeWidth="3.5" strokeDasharray="3 5" strokeLinecap="round" />
      <circle cx="10" cy="32" r="4.5" fill={S.brand} />
      <circle cx="54" cy="32" r="4.5" fill={S.brand} />
    </svg>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────────
 * Data display
 * ──────────────────────────────────────────────────────────────────────────── */

export const Sparkline: React.FC<{
  points: number[];
  w?: number;
  h?: number;
  color?: string;
  progress?: number;
  stroke?: number;
  fill?: boolean;
  id?: string;
}> = ({points, w = 320, h = 92, color = S.brand, progress = 1, stroke = 2.6, fill = true, id = 'spark'}) => {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const pad = 6;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(2)} ${h} L${coords[0][0].toFixed(2)} ${h} Z`;
  const total = coords.slice(1).reduce((sum, [x, y], i) => {
    const [px, py] = coords[i];
    return sum + Math.hypot(x - px, y - py);
  }, 0);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display: 'block'}}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id}-g)`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={total}
        strokeDashoffset={total * (1 - Math.max(0, Math.min(1, progress)))}
      />
      {progress > 0.7 && (
        <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={3.6} fill={S.solid1} stroke={color} strokeWidth={2.4} />
      )}
    </svg>
  );
};

export const Progress: React.FC<{value: number; h?: number; color?: string; track?: string; style?: React.CSSProperties}> = ({
  value,
  h = 8,
  color = S.brand,
  track = S.sunken,
  style,
}) => (
  <div style={{height: h, borderRadius: h, background: track, overflow: 'hidden', ...style}}>
    <div
      style={{
        width: `${Math.max(0, Math.min(1, value)) * 100}%`,
        height: '100%',
        borderRadius: h,
        background: `linear-gradient(90deg, ${color}, ${color === S.brand ? S.brandDark : color})`,
        boxShadow: `0 0 12px ${color}55`,
      }}
    />
  </div>
);

export const PinDots: React.FC<{count?: number; filled: number; size?: number; gap?: number; color?: string}> = ({
  count = 6,
  filled,
  size = 12,
  gap = 14,
  color = S.brand,
}) => (
  <div dir="ltr" style={{display: 'flex', gap, justifyContent: 'center', alignItems: 'center'}}>
    {Array.from({length: count}).map((_, i) => (
      <div
        key={i}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          border: `1.5px solid ${i < filled ? color : S.borderStrong}`,
          background: i < filled ? color : 'transparent',
          boxShadow: i < filled ? `0 0 10px ${color}66` : 'none',
        }}
      />
    ))}
  </div>
);

/**
 * A voucher / receipt ticket — the app's `Voucher.svelte` shape: 20 radius, solid-1
 * body with a 5 % brand wash on top, 6-on/12-off dashed perforation, two 11 px side
 * notches masked out. `notch` must be the colour behind the ticket.
 */
export const Ticket: React.FC<{
  children: React.ReactNode;
  notch?: string;
  body?: string;
  radius?: number;
  style?: React.CSSProperties;
  selected?: boolean;
}> = ({children, notch = S.bg, body = S.solid1, radius = R.md, style, selected = false}) => (
  <div
    style={{
      position: 'relative',
      background: body,
      borderRadius: radius,
      boxShadow: `0 0 0 1px ${selected ? S.brand : S.border}, 0 8px 18px -12px rgba(20,26,38,0.35)`,
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: -11,
        top: '50%',
        marginTop: -11,
        width: 22,
        height: 22,
        borderRadius: 11,
        background: notch,
        boxShadow: `inset -1px 0 0 ${selected ? S.brand : S.border}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: -11,
        top: '50%',
        marginTop: -11,
        width: 22,
        height: 22,
        borderRadius: 11,
        background: notch,
        boxShadow: `inset 1px 0 0 ${selected ? S.brand : S.border}`,
      }}
    />
    {children}
  </div>
);

/** The vertical 6/12 dashed perforation the voucher uses to split amount from stub. */
export const Perforation: React.FC<{color?: string; height?: number; style?: React.CSSProperties}> = ({
  color = S.borderStrong,
  height = 64,
  style,
}) => (
  <div
    style={{
      width: 2,
      height,
      backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0 6px, transparent 6px 12px)`,
      ...style,
    }}
  />
);

/* ────────────────────────────────────────────────────────────────────────────
 * Chrome: the canvas, OS bar, Telegram mini-app header, tab bar
 * ──────────────────────────────────────────────────────────────────────────── */

export const StatusBar: React.FC<{time?: string; dark?: boolean}> = ({time = '9:41', dark = false}) => {
  const c = dark ? '#FFFFFF' : S.ink;
  return (
    <div
      dir="ltr"
      style={{
        height: 30,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: '0 22px 4px',
        fontFamily: F.text,
        fontSize: 12,
        fontWeight: 600,
        color: c,
      }}
    >
      <span style={{letterSpacing: 0.2}}>{time}</span>
      <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4.2} y={8 - i * 2.3} width="2.8" height={3 + i * 2.3} rx="0.9" fill={c} />
          ))}
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 10.2 10.6 6.9a4.4 4.4 0 0 0-6.2 0L7.5 10.2Z" fill={c} />
          <path d="M12.4 4.6a7 7 0 0 0-9.8 0" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M14.2 2.4a9.5 9.5 0 0 0-13.4 0" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
          <rect x="0.6" y="0.6" width="20" height="9.8" rx="2.6" stroke={c} strokeOpacity="0.5" strokeWidth="1.1" />
          <rect x="2" y="2" width="15" height="7" rx="1.6" fill={c} />
          <path d="M22.4 4v3c.9-.4 1.3-2.6 0-3Z" fill={c} fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
};

/** Telegram's mini-app chrome: close at the start, title centred, menu at the end. */
export const MiniAppBar: React.FC<{
  title?: string;
  sub?: string;
  dark?: boolean;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({title = 'المتجر', sub, dark = false, right, style}) => (
  <div
    dir="ltr"
    style={{
      height: 46,
      paddingInline: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: dark ? 'rgba(10,16,22,0.72)' : S.glass2,
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      boxShadow: `inset 0 -1px 0 ${dark ? 'rgba(255,255,255,0.08)' : S.border}`,
      ...style,
    }}
  >
    <Icon name="close" size={17} color={dark ? 'rgba(255,255,255,0.75)' : S.muted} sw={2} />
    <div style={{flex: 1, textAlign: 'center', minWidth: 0}}>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 15,
          fontWeight: 600,
          color: dark ? '#FFFFFF' : S.ink,
          lineHeight: 1.35,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
      {sub && <div style={{fontFamily: F.text, fontSize: 10.5, color: dark ? 'rgba(255,255,255,0.55)' : S.muted, lineHeight: 1.3}}>{sub}</div>}
    </div>
    <div style={{color: dark ? 'rgba(255,255,255,0.75)' : S.muted, display: 'flex', alignItems: 'center'}}>
      {right ?? <Icon name="dots" size={19} sw={2.4} />}
    </div>
  </div>
);

const TAB_ICONS: IconName[] = ['home', 'orders', 'wallet', 'user'];

export const TabBar: React.FC<{active?: number; labels?: readonly string[]; dark?: boolean; style?: React.CSSProperties}> = ({
  active = 0,
  labels = HOME.tabs,
  dark = false,
  style,
}) => (
  <div
    dir="rtl"
    style={{
      height: 74,
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: 8,
      background: dark ? 'rgba(10,16,22,0.82)' : S.glass3,
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      boxShadow: `inset 0 1px 0 ${dark ? 'rgba(255,255,255,0.08)' : S.border}`,
      ...style,
    }}
  >
    {labels.map((label, i) => {
      const on = i === active;
      return (
        <div key={label} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
          <div
            style={{
              width: 56,
              height: 30,
              borderRadius: R.pill,
              background: on ? S.brand : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: on ? S.onBrand : dark ? 'rgba(255,255,255,0.55)' : S.faint,
              boxShadow: on ? `0 6px 14px -8px ${S.brand}` : 'none',
            }}
          >
            <Icon name={TAB_ICONS[i] ?? 'home'} size={22} sw={on ? 2.2 : 1.9} />
          </div>
          <span
            style={{
              fontFamily: F.text,
              fontSize: 10.5,
              fontWeight: on ? 600 : 500,
              color: on ? (dark ? '#FFFFFF' : S.ink) : dark ? 'rgba(255,255,255,0.5)' : S.faint,
            }}
          >
            {label}
          </span>
        </div>
      );
    })}
    <div
      style={{
        position: 'absolute',
        bottom: 7,
        left: '50%',
        width: 132,
        height: 4.5,
        marginLeft: -66,
        borderRadius: 3,
        background: dark ? 'rgba(255,255,255,0.35)' : 'rgba(20,26,38,0.22)',
      }}
    />
  </div>
);

/**
 * The app canvas: logical 412 × 915, scaled by `dp`, RTL Arabic, with the wash the
 * app paints behind its glass surfaces.
 */
export const AppCanvas: React.FC<{
  dp: number;
  children: React.ReactNode;
  title?: string;
  sub?: string;
  chrome?: boolean;
  tabs?: boolean;
  activeTab?: number;
  dark?: boolean;
  bg?: string;
  style?: React.CSSProperties;
  contentPad?: number;
}> = ({
  dp,
  children,
  title = 'المتجر',
  sub,
  chrome = true,
  tabs = false,
  activeTab = 0,
  dark = false,
  bg,
  style,
  contentPad = 0,
}) => (
  <div
    style={{
      width: APP.w * dp,
      height: APP.h * dp,
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}
  >
    <div
      dir="rtl"
      lang="ar"
      style={{
        width: APP.w,
        height: APP.h,
        transform: `scale(${dp})`,
        transformOrigin: '0 0',
        position: 'relative',
        overflow: 'hidden',
        background: bg ?? S.bg,
        fontFamily: F.text,
        color: S.ink,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dark
            ? `radial-gradient(120% 70% at 100% 0%, rgba(42,165,169,0.20), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(242,169,59,0.10), transparent 60%)`
            : `radial-gradient(120% 66% at 100% 0%, rgba(15,124,128,0.13), transparent 58%), radial-gradient(90% 55% at 0% 100%, rgba(242,169,59,0.10), transparent 62%)`,
        }}
      />
      {chrome && <StatusBar dark={dark} />}
      {chrome && <MiniAppBar title={title} sub={sub} dark={dark} />}
      <div
        style={{
          position: 'absolute',
          top: chrome ? 30 + 46 : 0,
          bottom: tabs ? 74 : 0,
          left: 0,
          right: 0,
          overflow: 'hidden',
          padding: contentPad,
        }}
      >
        {children}
      </div>
      {tabs && (
        <div style={{position: 'absolute', bottom: 0, left: 0, right: 0}}>
          <TabBar active={activeTab} dark={dark} />
        </div>
      )}
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────────
 * Small helpers
 * ──────────────────────────────────────────────────────────────────────────── */

export const Glass: React.FC<{children: React.ReactNode; pad?: number; radius?: number; style?: React.CSSProperties}> = ({
  children,
  pad = 14,
  radius = R.md,
  style,
}) => (
  <div
    style={{
      background: S.glass2,
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      borderRadius: radius,
      padding: pad,
      boxShadow: `0 0 0 1px ${S.border}, ${SH.e1}`,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A floating action / icon button with the app's e1 elevation. */
export const IconBtn: React.FC<{name: IconName; size?: number; tone?: 'white' | 'brand' | 'soft'}> = ({name, size = 38, tone = 'white'}) => {
  const map = {
    white: {bg: S.glass3, fg: S.ink, border: true},
    brand: {bg: S.brand, fg: S.onBrand, border: false},
    soft: {bg: S.sunken, fg: S.muted, border: false},
  }[tone];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: map.bg,
        color: map.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: map.border ? `0 0 0 1px ${S.border}, ${SH.e1}` : 'none',
        backdropFilter: GLASS,
        WebkitBackdropFilter: GLASS,
        flex: 'none',
      }}
    >
      <Icon name={name} size={size * 0.5} color={map.fg} />
    </div>
  );
};

/** KPI tile used by the owner dashboard: label, big value, hint, icon. */
export const KpiTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: IconName;
  tone?: 'plain' | 'brand' | 'gold';
  style?: React.CSSProperties;
}> = ({label, value, hint, icon = 'chart', tone = 'plain', style}) => {
  const map = {
    plain: {bg: S.solid1, accent: S.brandText, chip: S.brandSoft},
    brand: {bg: S.brandSoft, accent: S.brandText, chip: S.glass3},
    gold: {bg: S.saffronSoft, accent: S.saffronText, chip: S.glass3},
  }[tone];
  return (
    <div
      style={{
        background: map.bg,
        borderRadius: R.md,
        padding: 13,
        boxShadow: `inset 0 0 0 1px ${S.border}`,
        ...style,
      }}
    >
      <Row justify="space-between" align="flex-start" style={{marginBottom: 8}}>
        <span style={{fontFamily: F.text, fontSize: 11.5, color: S.muted, fontWeight: 500, lineHeight: 1.4}}>{label}</span>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 9,
            background: map.chip,
            color: map.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={15} color={map.accent} />
        </div>
      </Row>
      <div style={{fontFamily: F.display, fontSize: 25, fontWeight: 600, color: map.accent, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums'}}>
        {value}
      </div>
      {hint && <div style={{fontFamily: F.text, fontSize: 10.5, color: S.faint, marginTop: 4, lineHeight: 1.4}}>{hint}</div>}
    </div>
  );
};

/** Success check that draws itself, used after payment. */
export const DrawCheck: React.FC<{size?: number; color?: string; progress: number; stroke?: number}> = ({
  size = 64,
  color = S.success,
  progress,
  stroke = 4,
}) => {
  const len = 46;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="28" stroke={color} strokeOpacity="0.18" strokeWidth={stroke} />
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 28}
        strokeDashoffset={2 * Math.PI * 28 * (1 - Math.min(1, progress * 1.35))}
        transform="rotate(-90 32 32)"
      />
      <path
        d="M20 33.5 28.5 42 45 24"
        stroke={color}
        strokeWidth={stroke + 0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - Math.max(0, Math.min(1, (progress - 0.35) / 0.65)))}
      />
    </svg>
  );
};

/** The toast the app shows after a successful order (`CheckoutSheet.svelte`). */
export const Toast: React.FC<{text: string; tone?: 'success' | 'brand'}> = ({text, tone = 'success'}) => (
  <div
    dir="rtl"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      background: S.glass3,
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      borderRadius: R.pill,
      padding: '10px 16px 10px 12px',
      boxShadow: `0 0 0 1px ${S.border}, ${SH.e2}`,
    }}
  >
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        background: tone === 'success' ? S.success : S.brand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <Icon name="check" size={13} color="#FFFFFF" sw={3} />
    </div>
    <span style={{fontFamily: F.text, fontSize: 12.5, fontWeight: 600, color: S.ink, lineHeight: 1.4}}>{text}</span>
  </div>
);

/** Re-export the shared easing so screens need one import for timing + kit. */
export {E, tween};

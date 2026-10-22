/**
 * Store film — the owner's side of the shop.
 *
 *   ▪ AdminHome      «أهلاً ليث» — the 24-hour pulse, quick actions, the calm line
 *   ▪ AdminOrders    «الطلبات» — a manual order opens, is executed, completes
 *   ▪ BroadcastSheet «راسل عملائك» — audience, send, delivery progress
 *   ▪ StatsScreen    «الإحصائيات» — self-drawing curve, money, VIP levels
 *   ▪ SecurityScreen «الأمان» — PIN pad filling, four guards, the audit tail
 *
 * Provenance / honesty
 *  - Every string is the app's own, from `../demo` (which traces to
 *    `admin/screens/{home,orders,stats,settings}/*`, `admin/sections.ts`,
 *    `lib/orders/admin.ts`, `lib/orders/status.ts`). The search placeholder and
 *    the status filters come from `admin/screens/orders/OrdersList.svelte`
 *    verbatim; the tab counts come from the same sample data the KPIs use
 *    (3 waiting, 1 processing). No invented copy, no invented numbers.
 *  - Tokens (colours, radii, fonts, glass, shadows) come from `../tokens`,
 *    transcribed from `webapp/src/styles/tokens.css` + `fonts.css`. The type
 *    scale follows the app's `--fs` steps (11 / 12 / 13 / 15 / 17 / 20 / 24 /
 *    30 / 36), the surfaces follow the `inset hairline + warm shadow` recipe of
 *    `webapp/src/lib/ui/*.svelte`.
 *  - Two composition choices, both so one shot can hold one argument:
 *    the film's app shell gets a bottom bar built from `ADMIN.tabs` (the real
 *    admin panel navigates from a drawer on phones), and `SecurityScreen` puts
 *    the PIN pad over the guard slabs and the audit tail at once (the app shows
 *    the pad in a sheet). Same copy either way.
 *  - `SAFE_TOP` (36 dp) is reserved above the admin bar: the status bar is the
 *    device's, drawn by the scene over this canvas, so the screen leaves it room.
 *
 * Rules kept: 412 × 915 dp canvas, every value × `dp` (the scene either scales
 * the box or passes `dp`), Latin numerals only (through `Num`), Reem Kufi for
 * display with its air (line-height ≥ 1.5), motion is a pure function of `t`
 * (frames since the shot starts) — no hooks, no timers, no randomness.
 */
import React from 'react';
import {E, clamp, countUp, pulse, tween} from '../../lib/anim';
import {ADMIN, ORDER_STATUS, SECURITY, STORE} from '../demo';
import {APP, F, GLASS, R, S, SH} from '../tokens';

type Shot = {dp: number; t: number};

/** Loaded faces (see src/fonts.ts). Arabic never gets negative tracking or uppercase. */
const FAM = {
  display: `'${F.display}', 'Tajawal', serif`,
  text: `'${F.text}', 'Tajawal', sans-serif`,
} as const;

/** Latin numerals in an RTL flow: isolated, LTR, tabular. */
const Num: React.FC<{
  v: string | number;
  dp: number;
  size: number;
  font?: 'display' | 'text';
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({v, dp, size, font = 'text', weight = 600, color = S.ink, style}) => (
  <span
    dir="ltr"
    style={{
      display: 'inline-block',
      unicodeBidi: 'isolate',
      fontFamily: font === 'display' ? FAM.display : FAM.text,
      fontSize: size * dp,
      fontWeight: font === 'display' ? (weight === 600 ? 700 : weight) : weight,
      color,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      ...style,
    }}
  >
    {v}
  </span>
);

/** `$3,420`, `1,248` — the app's own grouping, computed without ICU. */
const commas = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Mixed Arabic/Latin copy (e.g. «ببجي · 660 UC») keeps each run's own direction. */
const MIXED: React.CSSProperties = {unicodeBidi: 'plaintext'};
const Mixed: React.FC<{text: string}> = ({text}) => (
  <>
    {text.split(/(\s+)/).map((tok, i) =>
      /[A-Za-z0-9]/.test(tok) ? (
        <bdi key={i} dir="ltr" style={{unicodeBidi: 'isolate'}}>
          {tok}
        </bdi>
      ) : (
        <React.Fragment key={i}>{tok}</React.Fragment>
      ),
    )}
  </>
);

/* ── line icons ─────────────────────────────────────────────────────────────
 * One family with `screens/extras.tsx`: 24 grid, 1.7 stroke, round caps. The
 * shared glyphs are the same paths, so the two files read as one product.
 */
type GlyphName =
  | 'home'
  | 'orders'
  | 'menu'
  | 'inbox'
  | 'wallet'
  | 'coin'
  | 'star'
  | 'chart'
  | 'megaphone'
  | 'plane'
  | 'person'
  | 'more'
  | 'check'
  | 'checkCircle'
  | 'chevron'
  | 'lock'
  | 'shield'
  | 'clock'
  | 'backspace'
  | 'back'
  | 'trend'
  | 'search'
  | 'filter';

const P: Record<GlyphName, React.ReactNode> = {
  home: (
    <>
      <path d="M4.4 10.7 12 4.3l7.6 6.4v8.1a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6z" />
      <path d="M9.7 20.4v-5.6h4.6v5.6" />
    </>
  ),
  orders: (
    <>
      <path d="M5 7.2h14" />
      <path d="M5 12h14" />
      <path d="M5 16.8h9" />
    </>
  ),
  menu: (
    <>
      <path d="M4.6 7.2h14.8" />
      <path d="M4.6 12h14.8" />
      <path d="M4.6 16.8h14.8" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.6 13.1 6.4 5.9a2 2 0 0 1 1.9-1.3h7.4a2 2 0 0 1 1.9 1.3l2.8 7.2v4.6a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2z" />
      <path d="M3.7 13.2h4l1.3 2.2h6l1.3-2.2h4" />
    </>
  ),
  wallet: (
    <>
      <path d="M4.2 8.9A2.3 2.3 0 0 1 6.5 6.6h11a2.3 2.3 0 0 1 2.3 2.3v8.3a2.3 2.3 0 0 1-2.3 2.3h-11a2.3 2.3 0 0 1-2.3-2.3z" />
      <path d="M15.4 12.1h4.4v3.3h-4.4a1.65 1.65 0 0 1 0-3.3z" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5v9" />
      <path d="M14.4 9.5c0-1-1-1.6-2.4-1.6s-2.4.6-2.4 1.5 1 1.4 2.4 1.6 2.5.7 2.5 1.7-1.1 1.6-2.5 1.6-2.4-.6-2.4-1.6" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.85z" />,
  chart: (
    <>
      <path d="M4 19.4V4.6" />
      <path d="M4 19.4h16" />
      <path d="M8.3 19.4v-5.2" />
      <path d="M12.3 19.4v-8.9" />
      <path d="M16.3 19.4v-3.4" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4.4 10.1v3.8l3.3.9 8.5 3.5V5.7L7.7 9.2z" />
      <path d="M18.1 8.4a3.7 3.7 0 0 1 0 7.2" />
      <path d="M7.6 14.5v3.7a1.7 1.7 0 0 0 3.4 0v-2.7" />
    </>
  ),
  plane: (
    <>
      <path d="M20.6 3.4 3.5 9.9l6.3 2.3 2.3 6.3z" />
      <path d="M20.6 3.4 12 15.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.2" r="3.55" />
      <path d="M4.9 20.2c0-3.6 3.15-5.9 7.1-5.9s7.1 2.3 7.1 5.9" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.4" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M5.4 12.5 9.9 17 18.6 7.2" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M8.5 12.2 11 14.7l4.6-5" />
    </>
  ),
  chevron: <path d="M14.2 5.8 8 12l6.2 6.2" />,
  lock: (
    <>
      <rect x="5.3" y="10.4" width="13.4" height="9.5" rx="2.7" />
      <path d="M8.7 10.4V8.1a3.3 3.3 0 0 1 6.6 0v2.3" />
      <path d="M12 14.2v2.1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.4l7.1 2.7v5.3c0 4.2-2.8 7.1-7.1 8.7-4.3-1.6-7.1-4.5-7.1-8.7V6.1z" />
      <path d="M8.9 11.9 11 14l4-4.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
  backspace: (
    <>
      <path d="M9.3 5.8h9.2a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H9.3l-5-6.2z" />
      <path d="M12.5 9.8l4.2 4.4" />
      <path d="M16.7 9.8l-4.2 4.4" />
    </>
  ),
  back: (
    <>
      <path d="M19.2 12H4.9" />
      <path d="M11.1 5.4 4.7 12l6.4 6.6" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16.6l5.2-5.2 3.3 3.3L20 7.4" />
      <path d="M15.4 7.4H20v4.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  filter: (
    <>
      <path d="M4.4 6.6h15.2" />
      <path d="M7.2 12h9.6" />
      <path d="M10.2 17.4h3.6" />
    </>
  ),
};

const Glyph: React.FC<{
  name: GlyphName;
  dp: number;
  size: number;
  color?: string;
  sw?: number;
  style?: React.CSSProperties;
}> = ({name, dp, size, color = 'currentColor', sw = 1.7, style}) => (
  <svg
    viewBox="0 0 24 24"
    width={size * dp}
    height={size * dp}
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{display: 'block', flexShrink: 0, ...style}}
  >
    {P[name]}
  </svg>
);

/** Soft brand bloom behind the glass — the app's own light, not a lens flare. */
const Bloom: React.FC<{dp: number; x: number; y: number; r: number; color: string; alpha?: number}> = ({
  dp,
  x,
  y,
  r,
  color,
  alpha = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: (x - r / 2) * dp,
      top: (y - r / 2) * dp,
      width: r * dp,
      height: r * dp,
      borderRadius: '50%',
      background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 68%)`,
      opacity: alpha,
      pointerEvents: 'none',
    }}
  />
);

/** Room for the device's own status bar (drawn by the scene over this canvas). */
const SAFE_TOP = 36;

/** The 412 × 915 canvas. */
const Frame: React.FC<{dp: number; children: React.ReactNode; bg?: string}> = ({dp, children, bg = S.bg}) => (
  <div
    dir="rtl"
    lang="ar"
    style={{
      position: 'relative',
      width: APP.w * dp,
      height: APP.h * dp,
      overflow: 'hidden',
      background: bg,
      color: S.ink,
      fontFamily: FAM.text,
      letterSpacing: 0,
      WebkitFontSmoothing: 'antialiased',
    }}
  >
    {children}
  </div>
);

/* ── the app's surface recipes, kept in one place ───────────────────────────── */

const cardStyle = (dp: number, level: 1 | 2 | 3 = 2, radius: number = R.md): React.CSSProperties => ({
  borderRadius: radius * dp,
  background: level === 1 ? S.glass1 : level === 2 ? S.glass2 : S.glass3,
  backdropFilter: 'blur(14px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
  border: `1px solid ${S.border}`,
  boxShadow: level === 1 ? SH.e1 : SH.e2,
});

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'money';

const TONE: Record<Tone, {bg: string; fg: string}> = {
  brand: {bg: 'rgba(15,124,128,0.12)', fg: S.brandText},
  success: {bg: 'rgba(30,158,106,0.12)', fg: S.success},
  warning: {bg: 'rgba(154,132,0,0.14)', fg: S.warning},
  danger: {bg: 'rgba(217,72,59,0.12)', fg: S.danger},
  neutral: {bg: S.sunken, fg: S.muted},
  money: {bg: S.saffronSoft, fg: S.saffronText},
};

const Chip: React.FC<{
  dp: number;
  label: React.ReactNode;
  tone?: Tone;
  height?: number;
  size?: number;
}> = ({dp, label, tone = 'neutral', height = 21, size = 11}) => (
  <span
    style={{
      height: height * dp,
      paddingInline: 8 * dp,
      borderRadius: R.pill,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4 * dp,
      background: TONE[tone].bg,
      color: TONE[tone].fg,
      fontSize: size * dp,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

/** A section head in the app's grammar (`h2.sec`): label, hairline, glyph. */
const SectHead: React.FC<{dp: number; label: string; glyph?: GlyphName; marginTop?: number; children?: React.ReactNode}> = ({
  dp,
  label,
  glyph,
  marginTop = 14,
  children,
}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 7 * dp, marginTop: marginTop * dp}}>
    <span style={{fontSize: 13.6 * dp, fontWeight: 600, color: S.ink, lineHeight: 1.35}}>{label}</span>
    <span style={{flex: 1, height: 1 * dp, background: S.border}} />
    {children}
    {glyph ? <Glyph name={glyph} dp={dp} size={14} color={S.faint} sw={1.8} /> : null}
  </div>
);

/* ── the admin shell ───────────────────────────────────────────────────────── */

const TopBar: React.FC<{dp: number; section: string; back?: boolean}> = ({dp, section, back = false}) => (
  <div
    style={{
      position: 'relative',
      zIndex: 4,
      height: (SAFE_TOP + 54) * dp,
      paddingTop: SAFE_TOP * dp,
      flexShrink: 0,
      paddingInline: 14 * dp,
      display: 'flex',
      alignItems: 'center',
      gap: 10 * dp,
      background: S.glass2,
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      boxShadow: `0 1px 0 ${S.border}`,
    }}
  >
    <span
      style={{
        width: 34 * dp,
        height: 34 * dp,
        borderRadius: 11 * dp,
        background: S.glass3,
        border: `1px solid ${S.border}`,
        boxShadow: SH.e1,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <Glyph name={back ? 'back' : 'menu'} dp={dp} size={17} color={S.ink} sw={1.8} />
    </span>
    <span style={{display: 'flex', flexDirection: 'column', gap: 1 * dp, minWidth: 0}}>
      <span style={{fontSize: 10.4 * dp, color: S.muted, lineHeight: 1.2}}>{back ? 'الإعدادات' : STORE.name}</span>
      <span style={{fontFamily: FAM.display, fontSize: 15 * dp, fontWeight: 700, lineHeight: 1.35, color: S.ink}}>
        {section}
      </span>
    </span>
    <span style={{flex: 1}} />
    <Glyph name="lock" dp={dp} size={15} color="rgba(20,26,38,0.26)" sw={1.75} />
  </div>
);

const ADMIN_TABS: Array<{label: string; icon: GlyphName}> = [
  {label: ADMIN.tabs[0], icon: 'home'},
  {label: ADMIN.tabs[1], icon: 'orders'},
  {label: ADMIN.tabs[2], icon: 'inbox'},
  {label: ADMIN.tabs[3], icon: 'more'},
];

const TabBar: React.FC<{dp: number; active: number}> = ({dp, active}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: (64 + 14) * dp,
      paddingBottom: 14 * dp,
      display: 'flex',
      alignItems: 'center',
      background: 'rgba(255,255,255,0.87)',
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      boxShadow: `0 -1px 0 ${S.border}`,
    }}
  >
    {ADMIN_TABS.map((tab, i) => {
      const on = i === active;
      return (
        <div
          key={tab.label}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3.5 * dp,
            color: on ? S.brand : S.faint,
          }}
        >
          <Glyph name={tab.icon} dp={dp} size={21} color={on ? S.brand : S.faint} sw={on ? 1.95 : 1.7} />
          <span style={{fontSize: 10.4 * dp, fontWeight: on ? 600 : 500, lineHeight: 1}}>{tab.label}</span>
          <span
            style={{
              width: (on ? 14 : 0) * dp,
              height: 2.5 * dp,
              borderRadius: 2 * dp,
              background: S.brand,
            }}
          />
        </div>
      );
    })}
  </div>
);

/** Page head: the app's h1 + one-line subtitle. */
const PageHead: React.FC<{dp: number; title: string; sub: string; t: number}> = ({dp, title, sub, t}) => {
  const a = tween(t, 0, 16, E.outExpo);
  return (
    <div style={{opacity: a, transform: `translateY(${(1 - a) * 10 * dp}px)`}}>
      <h1
        style={{
          margin: 0,
          fontFamily: FAM.display,
          fontSize: 25 * dp,
          fontWeight: 700,
          lineHeight: 1.6,
          color: S.ink,
          /* Reem Kufi sets a very tight word space; a hair of it keeps «أهلاً ليث»
             from reading as one word. Word space only — never letter tracking. */
          wordSpacing: '0.06em',
        }}
      >
        {title}
      </h1>
      <p style={{margin: `${-4 * dp}px 0 0`, fontSize: 12.6 * dp, color: S.muted, lineHeight: 1.4}}>{sub}</p>
    </div>
  );
};

/** The page body: from below the bar to above the tab bar. */
const Body: React.FC<{dp: number; children: React.ReactNode; bottom?: number; gap?: number}> = ({
  dp,
  children,
  bottom = 88,
  gap = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      top: (SAFE_TOP + 54) * dp,
      display: 'flex',
      flexDirection: 'column',
      gap: gap * dp,
      padding: `${14 * dp}px ${16 * dp}px ${bottom * dp}px`,
    }}
  >
    {children}
  </div>
);

/* ═════════════════════════════════════════════════════════════════════════ */
/* 1. AdminHome — «أهلاً ليث»                                              */
/* ═════════════════════════════════════════════════════════════════════════ */

const KPI_META: Array<{icon: GlyphName; money: boolean; saffron: boolean; waiting: boolean}> = [
  {icon: 'orders', money: false, saffron: false, waiting: false},
  {icon: 'coin', money: true, saffron: true, waiting: false},
  {icon: 'chart', money: true, saffron: true, waiting: false},
  {icon: 'clock', money: false, saffron: false, waiting: true},
];
const KPI_VALUES = [128, 3420, 1180, 3];
const ACTION_ICONS: GlyphName[] = ['inbox', 'wallet', 'megaphone', 'plane'];

export const AdminHome: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;

  return (
    <Frame dp={dp}>
      <Bloom dp={dp} x={APP.w * 0.88} y={150} r={420} color="rgba(15,124,128,0.13)" />
      <Bloom dp={dp} x={APP.w * 0.08} y={820} r={380} color="rgba(242,169,59,0.11)" />
      <TopBar dp={dp} section="الرئيسية" />

      <Body dp={dp}>
        <PageHead dp={dp} t={t} title={ADMIN.hello} sub={ADMIN.subtitle} />

        {/* «آخر 24 ساعة» */}
        <SectHead dp={dp} label={ADMIN.dayLabel} glyph="clock" marginTop={12} />

        {/* 2 × 2 pulse */}
        <div style={{marginTop: u(10), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: u(9)}}>
          {ADMIN.kpis.map((kpi, i) => {
            const meta = KPI_META[i];
            const e = tween(t, 6 + i * 3, 18, E.outExpo);
            const value = countUp(t, 5, 30, KPI_VALUES[i]);
            return (
              <div key={kpi.label} style={{...cardStyle(dp, 3, R.md), padding: u(14), opacity: e}}>
                <div style={{display: 'flex', alignItems: 'center', gap: u(7)}}>
                  <span
                    style={{
                      width: u(30),
                      height: u(30),
                      borderRadius: u(10),
                      background: meta.waiting ? 'rgba(242,169,59,0.20)' : S.brandSoft,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Glyph
                      name={meta.icon}
                      dp={dp}
                      size={16}
                      color={meta.waiting ? S.saffronText : S.brandText}
                      sw={1.85}
                    />
                  </span>
                  <span style={{fontSize: u(11.8), color: S.muted, fontWeight: 500}}>{kpi.label}</span>
                </div>
                {/* the app's Stat: figure first, the currency as a small unit after it
                    (inline-end, i.e. to the left of the digits, so it reads `$3,420`) */}
                <div style={{marginTop: u(9), display: 'flex', alignItems: 'flex-start'}}>
                  <Num
                    v={meta.money ? commas(value) : value}
                    dp={dp}
                    size={26}
                    font="display"
                    weight={700}
                    color={meta.saffron ? S.saffron : S.ink}
                  />
                  {meta.money ? (
                    <span
                      style={{
                        fontSize: u(12),
                        fontWeight: 500,
                        color: S.saffronText,
                        lineHeight: 1.2,
                        marginTop: u(3),
                      }}
                    >
                      $
                    </span>
                  ) : null}
                </div>
                <div style={{marginTop: u(5), fontSize: u(10.6), color: S.faint, lineHeight: 1.3}}>{kpi.hint}</div>
              </div>
            );
          })}
        </div>

        {/* «إجراءات سريعة» */}
        <SectHead dp={dp} label={ADMIN.quickTitle} glyph="trend" marginTop={14} />
        <div style={{marginTop: u(9), display: 'flex', flexDirection: 'column', gap: u(9)}}>
          {ADMIN.actions.map((a, i) => {
            const e = tween(t, 20 + i * 3, 18, E.outExpo);
            return (
              <div
                key={a.label}
                style={{
                  ...cardStyle(dp, 3, R.sm),
                  paddingInline: u(12),
                  height: u(63),
                  display: 'flex',
                  alignItems: 'center',
                  gap: u(10),
                  opacity: e,
                }}
              >
                <span
                  style={{
                    width: u(34),
                    height: u(34),
                    borderRadius: u(11),
                    background: S.brandSoft,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Glyph name={ACTION_ICONS[i]} dp={dp} size={17} color={S.brandText} sw={1.85} />
                </span>
                <span style={{display: 'flex', flexDirection: 'column', gap: u(2), minWidth: 0, flex: 1}}>
                  <span style={{fontSize: u(14.4), fontWeight: 600, color: S.ink, lineHeight: 1.25}}>{a.label}</span>
                  <span style={{fontSize: u(11), color: S.muted, lineHeight: 1.25}}>{a.hint}</span>
                </span>
                <Glyph name="chevron" dp={dp} size={15} color="rgba(20,26,38,0.20)" sw={1.8} />
              </div>
            );
          })}
        </div>

        {/* the calm line: the app's quiet reassurance, not a banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: u(8),
            marginTop: u(16),
            opacity: tween(t, 34, 18, E.outExpo),
          }}
        >
          <Glyph name="checkCircle" dp={dp} size={16} color={S.success} sw={1.9} />
          <span style={{fontSize: u(12.2), fontWeight: 500, color: S.muted, lineHeight: 1.45}}>{ADMIN.calm}</span>
        </div>
      </Body>

      <TabBar dp={dp} active={0} />
    </Frame>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */
/* 2. AdminOrders — the queue                                            */
/* ═════════════════════════════════════════════════════════════════════════ */

/** `OrdersList.svelte` — the filters and the search placeholder, verbatim. */
const ORDER_TABS: Array<{label: string; count?: number}> = [
  {label: 'الكل'},
  {label: 'بانتظارك', count: 3},
  {label: 'قيد التنفيذ', count: 1},
  {label: 'مكتملة'},
  {label: 'مرفوضة'},
];
const SEARCH_PLACEHOLDER = 'رقم الطلب أو اسم العميل أو @username';

export const AdminOrders: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;
  /* the last order waits for the owner: it opens, is tapped, completes.
     the status flip and the button's check are one event (53) — a button that
     turns green while the row still reads «بانتظارك» is a continuity lie — and
     once the row has settled the action bar closes (64), as a list row would. */
  const open = tween(t, 30, 10, E.outExpo);
  const pressIn = tween(t, 45, 4, E.inOut);
  const pressOut = tween(t, 49, 7, E.outExpo);
  const pressed = Math.max(0, pressIn - Math.min(pressIn, pressOut));
  const tick = tween(t, 53, 8, E.outExpo);
  const done = tween(t, 53, 8, E.outExpo);
  const close = tween(t, 64, 10, E.inOut);

  return (
    <Frame dp={dp}>
      <Bloom dp={dp} x={APP.w * 0.9} y={140} r={400} color="rgba(15,124,128,0.12)" />
      <Bloom dp={dp} x={APP.w * 0.06} y={800} r={340} color="rgba(242,169,59,0.09)" />
      <TopBar dp={dp} section={ADMIN.ordersTitle} />

      <Body dp={dp}>
        <PageHead dp={dp} t={t} title={ADMIN.ordersTitle} sub={ADMIN.ordersSub} />

        {/* search — «بحث في الطلبات» */}
        <div
          style={{
            ...cardStyle(dp, 1, R.pill),
            marginTop: u(10),
            height: u(38),
            paddingInline: u(12),
            display: 'flex',
            alignItems: 'center',
            gap: u(8),
            boxShadow: 'none',
          }}
        >
          <Glyph name="search" dp={dp} size={15} color={S.faint} sw={1.85} />
          <span style={{fontSize: u(12.2), color: S.faint, ...MIXED}}>
            <Mixed text={SEARCH_PLACEHOLDER} />
          </span>
        </div>

        {/* status filters with their counts */}
        <div style={{display: 'flex', gap: u(6), marginTop: u(10)}}>
          {ORDER_TABS.map((tab, i) => {
            const on = i === 0;
            return (
              <span
                key={tab.label}
                style={{
                  height: u(30),
                  paddingInline: u(10),
                  borderRadius: u(R.pill),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: u(5),
                  fontSize: u(11.8),
                  fontWeight: on ? 600 : 500,
                  color: on ? S.bg : S.muted,
                  background: on ? S.ink : 'transparent',
                  boxShadow: on ? 'none' : `inset 0 0 0 1px ${S.border}`,
                  flexShrink: 0,
                }}
              >
                {tab.label}
                {tab.count ? (
                  <span
                    style={{
                      minWidth: u(16),
                      height: u(16),
                      paddingInline: u(4),
                      borderRadius: u(R.pill),
                      background: on ? 'rgba(255,255,255,0.18)' : S.sunken,
                      color: on ? S.bg : S.muted,
                      fontSize: u(9.6),
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Num v={tab.count} dp={dp} size={9.6} weight={700} color={on ? S.bg : S.muted} />
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>

        <div style={{marginTop: u(12), display: 'flex', flexDirection: 'column', gap: u(8)}}>
          {ADMIN.orders.map((o, i) => {
            const e = tween(t, 5 + i * 3, 18, E.outExpo);
            const status = ORDER_STATUS[o.status];
            const waiting = o.status === 'manual';
            const openH = waiting ? open * u(50) * (1 - close) : 0;
            const flipped = waiting ? done : 0;
            return (
              <div
                key={o.id}
                style={{
                  ...cardStyle(dp, 3, R.md),
                  opacity: e,
                  boxShadow: waiting && flipped < 0.5 ? `0 0 0 1px rgba(154,132,0,0.26), ${SH.e1}` : SH.e1,
                  overflow: 'hidden',
                }}
              >
                <div style={{padding: `${u(13)}px ${u(14)}px`}}>
                  {/* #1047 · the status */}
                  <div style={{display: 'flex', alignItems: 'center', gap: u(8)}}>
                    <Num v={o.id} dp={dp} size={11.8} weight={600} color={S.muted} />
                    {waiting ? (
                      <span style={{position: 'relative', display: 'inline-flex'}}>
                        <span style={{display: 'inline-flex', opacity: 1 - flipped}}>
                          <Chip dp={dp} tone={status.tone as Tone} label={status.label} />
                        </span>
                        <span
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'inline-flex',
                            opacity: flipped,
                            transform: `scale(${0.94 + 0.06 * flipped})`,
                          }}
                        >
                          <Chip
                            dp={dp}
                            tone={ORDER_STATUS.completed.tone as Tone}
                            label={ORDER_STATUS.completed.label}
                          />
                        </span>
                      </span>
                    ) : (
                      <Chip dp={dp} tone={status.tone as Tone} label={status.label} />
                    )}
                  </div>

                  {/* the item · what it was sold for */}
                  <div style={{marginTop: u(7), display: 'flex', alignItems: 'center', gap: u(8)}}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: u(15.2),
                        fontWeight: 600,
                        color: S.ink,
                        lineHeight: 1.35,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        ...MIXED,
                      }}
                    >
                      <Mixed text={o.name} />
                    </span>
                    <Num v={o.amount} dp={dp} size={15.4} weight={600} color={S.ink} />
                  </div>

                  <div style={{marginTop: u(6), display: 'flex', alignItems: 'center', gap: u(4)}}>
                    <Glyph name="clock" dp={dp} size={11.5} color={S.faint} sw={1.8} />
                    <Num v={o.when} dp={dp} size={10.8} weight={500} color={S.faint} />
                  </div>
                </div>

                {waiting ? (
                  <div
                    style={{
                      height: openH,
                      opacity: open,
                      overflow: 'hidden',
                      borderTop: `1px solid ${S.border}`,
                      background: 'rgba(20,26,38,0.028)',
                      boxSizing: 'border-box',
                      padding: u(7),
                    }}
                  >
                    <span
                      style={{
                        height: u(36),
                        width: '100%',
                        borderRadius: u(12),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: u(7),
                        background: tick > 0.5 ? S.success : S.brand,
                        color: S.onBrand,
                        fontSize: u(13.2),
                        fontWeight: 600,
                        transform: `scale(${1 - 0.035 * pressed})`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 ${7 * dp}px ${16 * dp}px -${9 * dp}px ${
                          tick > 0.5 ? S.success : S.brand
                        }`,
                      }}
                    >
                      <Glyph name={tick > 0.35 ? 'check' : 'orders'} dp={dp} size={15} color={S.onBrand} sw={2} />
                      تنفيذ
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* «عرض المزيد» — the app's secondary button */}
        <div
          style={{
            marginTop: u(14),
            display: 'flex',
            justifyContent: 'center',
            opacity: tween(t, 18, 16, E.outExpo),
          }}
        >
          <span
            style={{
              height: u(38),
              paddingInline: u(20),
              borderRadius: u(12),
              display: 'inline-flex',
              alignItems: 'center',
              gap: u(6),
              background: S.glass2,
              boxShadow: `inset 0 0 0 1px ${S.borderStrong}, ${SH.e1}`,
              fontSize: u(12.8),
              fontWeight: 600,
              color: S.brandText,
            }}
          >
            عرض المزيد
          </span>
        </div>
      </Body>

      <TabBar dp={dp} active={1} />
    </Frame>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */
/* 3. BroadcastSheet — «راسل عملائك» over the owner's home                 */
/* ═════════════════════════════════════════════════════════════════════════ */

export const BroadcastSheet: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;
  const B = ADMIN.broadcast;

  const rise = tween(t, 0, 18, E.outExpo);
  const dim = tween(t, 0, 18, E.outExpo);
  const pressIn = tween(t, 16, 4, E.inOut);
  const pressOut = tween(t, 20, 9, E.outExpo);
  const pressed = Math.max(0, pressIn - Math.min(pressIn, pressOut));
  const running = tween(t, 21, 46, E.outExpo);
  const pct = running * 0.64;
  const sent = Math.min(798, Math.floor(pct * 1248));
  const statusIn = tween(t, 27, 12, E.outExpo);
  const gone = tween(t, 21, 10, E.inOut);

  return (
    <Frame dp={dp}>
      {/* the owner's home, dimmed behind the sheet — the real screen, not a stand-in */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'blur(1.8px)',
          opacity: 0.62,
          transform: `scale(${1 - 0.012 * dim})`,
        }}
      >
        <AdminHome dp={dp} t={t} />
      </div>
      <div style={{position: 'absolute', inset: 0, background: `rgba(6,23,31,${0.34 * dim})`}} />

      {/* the sheet */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          transform: `translateY(${(1 - rise) * u(60)}px)`,
          opacity: rise,
          borderTopLeftRadius: u(R.lg),
          borderTopRightRadius: u(R.lg),
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: GLASS,
          WebkitBackdropFilter: GLASS,
          border: `1px solid ${S.border}`,
          borderBottom: 'none',
          boxShadow: SH.e3,
          padding: `${u(8)}px ${u(16)}px ${u(22)}px`,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'center', paddingBottom: u(11)}}>
          <span style={{width: u(36), height: u(4), borderRadius: u(2), background: 'rgba(20,26,38,0.16)'}} />
        </div>

        <div style={{display: 'flex', alignItems: 'flex-start', gap: u(10)}}>
          <div style={{flex: 1, minWidth: 0}}>
            <div
              style={{
                fontFamily: FAM.display,
                fontSize: u(19),
                fontWeight: 700,
                lineHeight: 1.5,
                color: S.ink,
                wordSpacing: '0.06em',
              }}
            >
              {B.title}
            </div>
            <div style={{fontSize: u(11.6), color: S.muted, lineHeight: 1.45, marginTop: u(1)}}>{B.sub}</div>
          </div>
          <span
            style={{
              width: u(32),
              height: u(32),
              borderRadius: u(11),
              background: S.brandSoft,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Glyph name="megaphone" dp={dp} size={17} color={S.brandText} sw={1.8} />
          </span>
        </div>

        {/* «لمن تُرسل؟» */}
        <div style={{marginTop: u(12), fontSize: u(10.4), color: S.muted, fontWeight: 500}}>لمن تُرسل؟</div>
        <div
          style={{
            ...cardStyle(dp, 1, R.sm),
            marginTop: u(5),
            height: u(52),
            paddingInline: u(11),
            display: 'flex',
            alignItems: 'center',
            gap: u(9),
          }}
        >
          <span
            style={{
              width: u(30),
              height: u(30),
              borderRadius: u(10),
              background: S.brandSoft,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Glyph name="person" dp={dp} size={16} color={S.brandText} sw={1.8} />
          </span>
          <span style={{fontSize: u(13.6), fontWeight: 600, color: S.ink}}>{B.audience}</span>
          <span style={{flex: 1}} />
          <Chip
            dp={dp}
            tone="neutral"
            height={24}
            label={<Num v={B.estimate} dp={dp} size={11} weight={600} color={S.muted} />}
          />
        </div>

        {/* the message as it reaches the customer */}
        <div
          style={{
            marginTop: u(9),
            borderRadius: `${u(R.sm)}px ${u(R.sm)}px ${u(4)}px ${u(R.sm)}px`,
            background: S.glass2,
            border: `1px solid ${S.border}`,
            padding: `${u(9)}px ${u(11)}px`,
            fontSize: u(11.2),
            lineHeight: 1.6,
            color: S.ink,
          }}
        >
          {STORE.welcome}
        </div>

        <div style={{position: 'relative', marginTop: u(12)}}>
          {/* the CTA, pressed once, then swallowed by the progress */}
          <div
            style={{
              height: u(46),
              borderRadius: u(14),
              background: `linear-gradient(150deg, ${S.brand} 0%, ${S.brandText} 100%)`,
              color: S.onBrand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: u(7),
              transform: `scale(${0.96 + 0.04 * rise - 0.03 * pressed})`,
              opacity: 1 - gone,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 ${8 * dp}px ${20 * dp}px -${10 * dp}px rgba(15,124,128,0.6)`,
            }}
          >
            <Glyph name="plane" dp={dp} size={15} color={S.onBrand} sw={1.9} />
            <span style={{fontSize: u(13.4), fontWeight: 600}}>أرسل الآن</span>
          </div>

          {/* live delivery */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              opacity: running > 0 ? 1 : 0,
              transform: `translateY(${(1 - tween(t, 21, 14, E.outExpo)) * u(8)}px)`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'flex-end', gap: u(6)}}>
              <Num v={commas(sent)} dp={dp} size={28} font="display" weight={700} color={S.brandText} />
              <span style={{fontSize: u(10.8), color: S.muted, marginBottom: u(3)}}>من 1,248 مستلم</span>
              <span style={{flex: 1}} />
              <span style={{opacity: statusIn, marginBottom: u(2)}}>
                <Chip
                  dp={dp}
                  tone="brand"
                  height={22}
                  label={
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: u(4)}}>
                      <span
                        style={{
                          width: u(5),
                          height: u(5),
                          borderRadius: u(3),
                          background: S.brand,
                          opacity: 0.4 + 0.6 * pulse(t, 24),
                        }}
                      />
                      {B.status}
                    </span>
                  }
                />
              </span>
            </div>

            {/* one bar: what went out, of what the audience is */}
            <div
              style={{
                marginTop: u(8),
                height: u(10),
                borderRadius: u(R.pill),
                background: S.sunken,
                boxShadow: `inset 0 0 0 1px ${S.border}`,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: `${pct * 100}%`,
                  background: `linear-gradient(270deg, ${S.brand}, #17A0A4 92%)`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(100deg, transparent 32%, rgba(255,255,255,0.5) 50%, transparent 68%)',
                  backgroundSize: '220% 100%',
                  backgroundPosition: `${120 - ((t * 6) % 240)}% 0`,
                }}
              />
            </div>

            <div style={{marginTop: u(7), display: 'flex', alignItems: 'center', gap: u(5), opacity: statusIn}}>
              <Glyph name="shield" dp={dp} size={12.5} color={S.brandText} sw={1.8} />
              <span style={{fontSize: u(10.4), color: S.faint}}>{B.limits}</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */
/* 4. StatsScreen — the curve, the money, the VIP levels                   */
/* ═════════════════════════════════════════════════════════════════════════ */

/** Catmull-Rom → cubic Bézier: the smoothing the app's charts use. */
const linePath = (pts: Array<[number, number]>): string => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
};

const VIP_TONES: Tone[] = ['neutral', 'money', 'brand'];
/** `Pulse.svelte` — the range presets over the report. */
const RANGES = ['اليوم', '7 أيام', '30 يوماً'];

export const StatsScreen: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;
  const points = ADMIN.stats.points;
  const W = 344;
  const H = 210;
  const pad = 8;
  const max = Math.max(...points);
  const pts = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = pad + (1 - v / max) * (H - pad * 2);
    return [x, y] as [number, number];
  });
  const d = linePath(pts);
  const draw = tween(t, 8, 36, E.outExpo);
  const last = pts[pts.length - 1];
  const riser = tween(t, 4, 20, E.outExpo);
  const sales = countUp(t, 5, 28, 3420);
  const profit = countUp(t, 11, 28, 1180);

  return (
    <Frame dp={dp}>
      <Bloom dp={dp} x={APP.w * 0.9} y={140} r={420} color="rgba(242,169,59,0.10)" />
      <Bloom dp={dp} x={APP.w * 0.06} y={840} r={380} color="rgba(15,124,128,0.12)" />
      <TopBar dp={dp} section={ADMIN.stats.title} />

      <Body dp={dp} bottom={84}>
        <PageHead dp={dp} t={t} title={ADMIN.stats.title} sub={ADMIN.stats.sub} />

        {/* the range */}
        <div style={{display: 'flex', gap: u(6), marginTop: u(8)}}>
          {RANGES.map((label, i) => {
            const on = i === 2;
            return (
              <span
                key={label}
                style={{
                  height: u(28),
                  paddingInline: u(10),
                  borderRadius: u(R.pill),
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: u(11.4),
                  fontWeight: on ? 600 : 500,
                  color: on ? S.bg : S.muted,
                  background: on ? S.ink : S.glass2,
                  boxShadow: on ? 'none' : `inset 0 0 0 1px ${S.border}`,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>

        {/* the period's money */}
        <div style={{marginTop: u(11), opacity: riser, transform: `translateY(${(1 - riser) * u(10)}px)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: u(5)}}>
            <Glyph name="trend" dp={dp} size={13} color={S.brandText} sw={1.9} />
            <span style={{fontSize: u(11.4), color: S.muted, fontWeight: 500}}>{ADMIN.stats.salesLabel}</span>
          </div>
          <div style={{display: 'flex', alignItems: 'flex-start', marginTop: u(2)}}>
            <Num v={commas(sales)} dp={dp} size={34} font="display" weight={700} color={S.saffron} />
            <span style={{fontSize: u(14), fontWeight: 500, color: S.saffronText, lineHeight: 1.2, marginTop: u(4)}}>$</span>
          </div>
          <div style={{marginTop: u(1), fontSize: u(10.6), color: S.faint}}>{ADMIN.stats.compare}</div>
        </div>

        {/* self-drawing curve */}
        <div style={{...cardStyle(dp, 1, R.md), marginTop: u(9), padding: u(12)}}>
          <svg width={u(W)} height={u(H)} viewBox={`0 0 ${W} ${H}`} style={{display: 'block', overflow: 'visible'}}>
            <defs>
              <linearGradient id="owner-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={S.brand} stopOpacity={0.22} />
                <stop offset="100%" stopColor={S.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            {[0.3, 0.6, 0.9].map((g) => (
              <line
                key={g}
                x1={pad}
                x2={W - pad}
                y1={pad + g * (H - pad * 2)}
                y2={pad + g * (H - pad * 2)}
                stroke="rgba(20,26,38,0.055)"
                strokeWidth={1}
              />
            ))}
            <path d={`${d} L ${W - pad} ${H - pad} L ${pad} ${H - pad} Z`} fill="url(#owner-wash)" opacity={draw} />
            <path
              d={d}
              fill="none"
              stroke={S.brand}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={`${draw} 1`}
            />
            <circle cx={last[0]} cy={last[1]} r={4.6} fill={S.brand} opacity={draw > 0.97 ? 1 : 0} />
            <circle cx={last[0]} cy={last[1]} r={2} fill={S.solid1} opacity={draw > 0.97 ? 1 : 0} />
          </svg>
        </div>

        {/* profit */}
        <div
          style={{
            ...cardStyle(dp, 3, R.sm),
            marginTop: u(9),
            padding: `${u(9)}px ${u(11)}px`,
            display: 'flex',
            alignItems: 'center',
            gap: u(9),
            opacity: tween(t, 16, 16, E.outExpo),
          }}
        >
          <span
            style={{
              width: u(30),
              height: u(30),
              borderRadius: u(10),
              background: S.saffronSoft,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Glyph name="coin" dp={dp} size={16} color={S.saffronText} sw={1.9} />
          </span>
          <span style={{display: 'flex', flexDirection: 'column', gap: u(1)}}>
            <span style={{fontSize: u(11.8), color: S.muted, fontWeight: 500}}>{ADMIN.stats.profitLabel}</span>
            <span style={{fontSize: u(10), color: S.faint}}>بعد تكلفة المصدر</span>
          </span>
          <span style={{flex: 1}} />
          <div style={{display: 'flex', alignItems: 'flex-start'}}>
            <Num v={commas(profit)} dp={dp} size={19} font="display" weight={700} color={S.saffron} />
            <span style={{fontSize: u(10), fontWeight: 500, color: S.saffronText, lineHeight: 1.2, marginTop: u(2)}}>$</span>
          </div>
        </div>

        {/* VIP levels */}
        <SectHead dp={dp} label={ADMIN.vipTitle} glyph="star" marginTop={12} />
        <div style={{marginTop: u(8), display: 'flex', flexDirection: 'column', gap: u(6)}}>
          {ADMIN.vip.map((vip, i) => {
            const e = tween(t, 20 + i * 3, 16, E.outExpo);
            const tone = VIP_TONES[i];
            return (
              <div
                key={vip.name}
                style={{
                  ...cardStyle(dp, 3, R.sm),
                  height: u(46),
                  paddingInline: u(10),
                  display: 'flex',
                  alignItems: 'center',
                  gap: u(8),
                  opacity: e,
                }}
              >
                <Chip
                  dp={dp}
                  tone={tone}
                  height={22}
                  label={
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: u(3)}}>
                      <Glyph name="star" dp={dp} size={10.5} color={TONE[tone].fg} sw={1.9} />
                      <Num v={vip.pct} dp={dp} size={10.6} weight={600} color={TONE[tone].fg} />
                    </span>
                  }
                />
                <span style={{fontSize: u(13.4), fontWeight: 600, color: S.ink}}>{vip.name}</span>
                <span style={{flex: 1}} />
                <Num v={commas(vip.members)} dp={dp} size={11.2} weight={600} color={S.muted} />
                <span style={{fontSize: u(10.6), color: S.muted}}>عضواً</span>
              </div>
            );
          })}
        </div>
      </Body>

      <TabBar dp={dp} active={3} />
    </Frame>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */
/* 5. SecurityScreen — the PIN pad, the guards, the audit tail             */
/* ═════════════════════════════════════════════════════════════════════════ */

const GUARD_META: Array<{glyph: GlyphName; live: boolean}> = [
  {glyph: 'plane', live: true},
  {glyph: 'lock', live: false},
  {glyph: 'shield', live: false},
  {glyph: 'orders', live: false},
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const SecurityScreen: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;
  const filled = clamp(Math.floor((t - 10) / 4) + 1, 0, 6);
  const dotPop = clamp((t - 10) / 4 - (filled - 1), 0, 1);

  return (
    <Frame dp={dp}>
      <Bloom dp={dp} x={APP.w * 0.88} y={160} r={420} color="rgba(15,124,128,0.12)" />
      <Bloom dp={dp} x={APP.w * 0.1} y={860} r={380} color="rgba(242,169,59,0.08)" />
      <TopBar dp={dp} section={SECURITY.title} back />

      <Body dp={dp} bottom={20}>
        <PageHead dp={dp} t={t} title={SECURITY.title} sub={SECURITY.sub} />

        {/* the pad */}
        <div style={{...cardStyle(dp, 3, R.md), marginTop: u(10), padding: u(12)}}>
          <div style={{display: 'flex', alignItems: 'center', gap: u(8)}}>
            <span
              style={{
                width: u(30),
                height: u(30),
                borderRadius: u(10),
                background: S.brandSoft,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Glyph name="shield" dp={dp} size={16} color={S.brandText} sw={1.8} />
            </span>
            <span style={{display: 'flex', flexDirection: 'column', gap: u(0.5)}}>
              <span style={{fontSize: u(13.4), fontWeight: 600, color: S.ink, lineHeight: 1.2}}>{SECURITY.pinLabel}</span>
              <span style={{fontSize: u(10.2), color: S.muted, lineHeight: 1.2}}>{SECURITY.pinHint}</span>
            </span>
          </div>

          {/* six dots, one per digit */}
          <div style={{display: 'flex', justifyContent: 'center', gap: u(11), marginTop: u(10)}} dir="ltr">
            {Array.from({length: 6}, (_, i) => {
              const on = i < filled;
              const pop = i === filled - 1 ? dotPop : 0;
              return (
                <span
                  key={i}
                  style={{
                    width: u(12),
                    height: u(12),
                    borderRadius: u(6),
                    boxSizing: 'border-box',
                    background: on ? S.brand : 'transparent',
                    boxShadow: on ? 'none' : `inset 0 0 0 ${1.6 * dp}px ${S.borderStrong}`,
                    transform: `scale(${on ? 1 + 0.16 * pop : 1})`,
                  }}
                />
              );
            })}
          </div>

          {/* the keys */}
          <div dir="ltr" style={{marginTop: u(10), display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: u(7)}}>
            {KEYS.map((key) => (
              <div
                key={key}
                style={{
                  height: u(37),
                  ...cardStyle(dp, 1, R.sm),
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: SH.e1,
                }}
              >
                <Num v={key} dp={dp} size={17} font="display" weight={700} color={S.ink} />
              </div>
            ))}
            <div />
            <div
              style={{
                height: u(37),
                ...cardStyle(dp, 1, R.sm),
                display: 'grid',
                placeItems: 'center',
                boxShadow: SH.e1,
              }}
            >
              <Num v="0" dp={dp} size={17} font="display" weight={700} color={S.ink} />
            </div>
            <div style={{height: u(37), display: 'grid', placeItems: 'center'}}>
              <Glyph name="backspace" dp={dp} size={19} color={S.muted} sw={1.8} />
            </div>
          </div>
        </div>

        {/* the four guards */}
        <div style={{marginTop: u(10), display: 'flex', flexDirection: 'column', gap: u(7)}}>
          {SECURITY.guards.map((guard, i) => {
            const e = tween(t, 22 + i * 5, 18, E.outExpo);
            const meta = GUARD_META[i];
            return (
              <div
                key={guard.label}
                style={{
                  ...cardStyle(dp, i === 0 ? 3 : 1, R.sm),
                  height: u(51),
                  paddingInline: u(10),
                  display: 'flex',
                  alignItems: 'center',
                  gap: u(9),
                  opacity: e,
                  transform: `translateY(${(1 - e) * u(10)}px)`,
                }}
              >
                <span
                  style={{
                    width: u(30),
                    height: u(30),
                    borderRadius: u(10),
                    background: meta.live ? 'rgba(30,158,106,0.12)' : S.brandSoft,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Glyph
                    name={meta.glyph}
                    dp={dp}
                    size={16}
                    color={meta.live ? S.success : S.brandText}
                    sw={1.85}
                  />
                </span>
                <span style={{display: 'flex', flexDirection: 'column', gap: u(1), minWidth: 0}}>
                  <span style={{fontSize: u(13), fontWeight: 600, color: S.ink, lineHeight: 1.25}}>{guard.label}</span>
                  <span style={{fontSize: u(10.2), color: S.muted, lineHeight: 1.3}}>{guard.note}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* the audit tail: nothing is deleted */}
        <SectHead dp={dp} label={SECURITY.auditTitle} marginTop={11}>
          <span
            style={{
              height: u(18),
              paddingInline: u(7),
              borderRadius: u(R.pill),
              display: 'inline-flex',
              alignItems: 'center',
              gap: u(4),
              background: 'rgba(30,158,106,0.12)',
              color: S.success,
              fontSize: u(9.6),
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: u(5),
                height: u(5),
                borderRadius: u(3),
                background: S.success,
                opacity: 0.35 + 0.65 * pulse(t, 30),
              }}
            />
            مباشر
          </span>
        </SectHead>
        <div style={{marginTop: u(7), ...cardStyle(dp, 1, R.sm), overflow: 'hidden', boxShadow: 'none'}}>
          {SECURITY.audit.map((row, i) => {
            const e = tween(t, 37 + i * 3, 12, E.outExpo);
            const lastRow = i === SECURITY.audit.length - 1;
            return (
              <div
                key={`${row[0]}-${i}`}
                style={{
                  height: u(29),
                  paddingInline: u(10),
                  display: 'flex',
                  alignItems: 'center',
                  gap: u(8),
                  boxShadow: lastRow ? 'none' : `inset 0 -1px 0 ${S.border}`,
                  opacity: e,
                }}
              >
                <Num v={row[0]} dp={dp} size={9.8} weight={500} color={S.faint} style={{width: u(30)}} />
                <span style={{fontSize: u(11.4), fontWeight: 600, color: S.ink}}>{row[1]}</span>
                <span style={{flex: 1}} />
                <span style={{fontSize: u(10.4), color: S.muted, ...MIXED}}>
                  <Mixed text={row[2]} />
                </span>
              </div>
            );
          })}
        </div>
      </Body>
    </Frame>
  );
};

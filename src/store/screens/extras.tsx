/**
 * Store film — support screens for «متجرك جوّا تلجرام».
 *  ▪ ChatScreen      — the Telegram chat that opens the store (not a store screen: Telegram's own shell)
 *  ▪ WalletScreen    — «محفظتي» (storefront/screens/Wallet.svelte)
 *  ▪ FeaturesScreen  — the feature board (this one is designed copy, not a product screen)
 *  ▪ SuccessToast    — «تم الدفع وبدأ تنفيذ طلبك» over the product screen
 *
 * Provenance / honesty:
 *  - tokens (colours, radii, fonts, glass, shadows) come from `../tokens`, transcribed from
 *    `bot-store-saas/webapp/src/styles/tokens.css` + `fonts.css`.
 *  - every Arabic string comes from `../demo` (which traces to the app's own string tables and
 *    `mock/fixtures.ts` sample data) or from the app's `admin/sections.ts` label+blurb pair.
 *  - copy that is *designed*, not shipped by the app, is marked `[DESIGN]` inline and listed in
 *    the hand-off note: the feature board's headline, and the 4 card labels the app does not say
 *    word-for-word (their literal app wording is in `FEATURES[].src`).
 *  - no invented numbers: $12.56 and the three ledger rows are the app's demo fixtures.
 *
 * Rules kept: RTL canvas 412×915 dp, every value × `dp`, Latin numerals only (through `Num`),
 * Reem Kufi for display, motion is a pure function of `t` (frames since the shot starts).
 */
import React from 'react';
import {E, countUp, entrance, pulse, tween} from '../../lib/anim';
import {HOME, STORE, SUCCESS, WALLET} from '../demo';
import {APP, F, GLASS, R, S, SH} from '../tokens';

type Shot = {dp: number; t: number};

/** Loaded faces (see src/fonts.ts). Arabic never gets negative tracking or uppercase. */
const FAM = {
  display: `'${F.display}', 'Tajawal', serif`,
  text: `'${F.text}', 'Tajawal', sans-serif`,
} as const;

/**
 * Latin numerals in an RTL flow: isolated, LTR, tabular.
 * NOTE — `src/store/ui.tsx` (the lead's shared kit with the canonical `Num`) was not on disk
 * when this file was written; when it lands, delete this shim and `import {Num} from '../ui'`.
 */
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

/** Arabic + Latin mixed strings (e.g. «طلب #1047 - 660 UC») keep their own direction. */
const MIXED: React.CSSProperties = {unicodeBidi: 'plaintext'};

/**
 * Mixed Arabic/Latin copy: every token carrying a Latin letter or a digit is isolated with
 * `<bdi dir="ltr">`, so «طلب #1047 - 660 UC» keeps its logical order instead of letting the
 * bidi algorithm flip the number and the price (which is what a plain RTL run does).
 */
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


// ── line icons ───────────────────────────────────────────────────────────────
// One family: 24 grid, 1.7 stroke, round caps. The app's material-symbol subset in
// `generated/icons.ts` has no wallet / card / megaphone / channel glyph, so the board
// and the chrome share this drawn set instead of mixing two weights.
type GlyphName =
  | 'bolt'
  | 'card'
  | 'wallet'
  | 'coin'
  | 'star'
  | 'megaphone'
  | 'plane'
  | 'chart'
  | 'inbox'
  | 'ticket'
  | 'check'
  | 'spark'
  | 'paperclip'
  | 'mic'
  | 'chevron'
  | 'home'
  | 'orders'
  | 'person'
  | 'search'
  | 'more'
  | 'in'
  | 'out'
  | 'plus';

const P: Record<GlyphName, React.ReactNode> = {
  bolt: <path d="M13.3 2.6 6 13.1h4.9l-1 8.3 7.6-10.8h-5z" />,
  card: (
    <>
      <rect x="3.2" y="6.4" width="17.6" height="12.4" rx="3" />
      <path d="M3.2 10.7h17.6" />
      <circle cx="16.3" cy="15.3" r="1.15" />
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
  chart: (
    <>
      <path d="M4 19.4V4.6" />
      <path d="M4 19.4h16" />
      <path d="M8.3 19.4v-5.2" />
      <path d="M12.3 19.4v-8.9" />
      <path d="M16.3 19.4v-3.4" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.6 13.1 6.4 5.9a2 2 0 0 1 1.9-1.3h7.4a2 2 0 0 1 1.9 1.3l2.8 7.2v4.6a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2z" />
      <path d="M3.7 13.2h4l1.3 2.2h6l1.3-2.2h4" />
    </>
  ),
  ticket: (
    <>
      <path d="M4.2 8.8a2 2 0 0 1 2-2h11.6a2 2 0 0 1 2 2v1.4a1.8 1.8 0 0 0 0 3.6v1.4a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2v-1.4a1.8 1.8 0 0 0 0-3.6z" />
      <path d="M9.8 8.6v6.8" strokeDasharray="2.2 2.6" />
    </>
  ),
  check: <path d="M5.4 12.5 9.9 17 18.6 7.2" />,
  spark: <path d="M12 3.2l1.7 5.1 5.1 1.7-5.1 1.7L12 16.8l-1.7-5.1L5.2 10l5.1-1.7z" />,
  paperclip: <path d="M16.9 7.7 10.6 14a2.5 2.5 0 0 0 3.5 3.5l6.5-6.5a4.3 4.3 0 1 0-6.1-6.1L7.1 12.4a6 6 0 1 0 8.5 8.5l4.6-4.6" />,
  mic: (
    <>
      <rect x="9.3" y="3.4" width="5.4" height="10.3" rx="2.7" />
      <path d="M6.4 11.6a5.6 5.6 0 0 0 11.2 0" />
      <path d="M12 17.2v3.3" />
    </>
  ),
  chevron: <path d="M9.8 5.8 16 12l-6.2 6.2" />,
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
  person: (
    <>
      <circle cx="12" cy="8.2" r="3.55" />
      <path d="M4.9 20.2c0-3.6 3.15-5.9 7.1-5.9s7.1 2.3 7.1 5.9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.4" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  in: (
    <>
      <path d="M18.6 5.4 7.3 16.7" />
      <path d="M7.3 9.5v7.2h7.2" />
    </>
  ),
  out: (
    <>
      <path d="M5.4 18.6 16.7 7.3" />
      <path d="M16.7 14.5V7.3H9.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.4v13.2" />
      <path d="M5.4 12h13.2" />
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

/** The store's mark: the app's favicon — a coupon with two cut notches and a perforation. */
const StoreMark: React.FC<{dp: number; size: number; fg?: string; glow?: number}> = ({
  dp,
  size,
  fg = '#FFFFFF',
  glow = 0,
}) => {
  const raw = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `coupon${raw}`;
  return (
    <div
      style={{
        width: size * dp,
        height: size * dp,
        borderRadius: (size / 2) * dp,
        background: `linear-gradient(142deg, ${S.brand} 0%, #12A2A6 52%, ${S.saffron} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow:
          glow > 0
            ? `0 ${3 * dp}px ${12 * dp}px -${3 * dp}px rgba(15,124,128,${0.5 * glow})`
            : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.56 * dp} height={size * 0.56 * dp} aria-hidden>
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="#FFFFFF" />
          <circle cx="2.2" cy="12" r="2.6" fill="#000000" />
          <circle cx="21.8" cy="12" r="2.6" fill="#000000" />
          <path
            d="M14.9 3.4v17.2"
            fill="none"
            stroke="#000000"
            strokeWidth="1.15"
            strokeDasharray="2.1 2.4"
          />
        </mask>
        <rect x="2.1" y="4.9" width="19.8" height="14.2" rx="3.2" fill={fg} mask={`url(#${maskId})`} />
      </svg>
    </div>
  );
};

// ── shared chrome ────────────────────────────────────────────────────────────
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

/** Soft brand bloom behind glass — the app's own light, not a lens flare. */
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

// ═════════════════════════════════════════════════════════════════════════════
// 1. ChatScreen — Telegram's own shell, the store living inside a conversation
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Telegram's chat wallpaper: a tiled doodle field (planes, sparks, tickets, blobs) at ~13%
 * brand ink over the app's grey. Drawn as an inline SVG tile so it repeats crisply at any dp.
 */
const DOODLE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='212' height='212' viewBox='0 0 212 212'>
    <g fill='none' stroke='#0F7C80' stroke-opacity='0.12' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'>
      <g transform='rotate(-9 26 34)'>
        <path d='M16 30l18-6.4-7.4 17z'/>
        <path d='M16 30l18-6.4-11 11.4'/>
      </g>
      <g transform='rotate(16 132 30)'>
        <path d='M132 14l3.4 8.2 8.2 3.4-8.2 3.4-3.4 8.2-3.4-8.2-8.2-3.4 8.2-3.4z'/>
      </g>
      <path d='M52 96h24a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H61l-8 6.4V115h-1a4 4 0 0 1-4-4v-11a4 4 0 0 1 4-4z'/>
      <g transform='rotate(-15 168 128)'>
        <path d='M168 118c3.4-4.4 9.6-3.4 11 .9 1.1 3.4-1.8 5.9-5.4 8.8-3.6-2.9-6.5-5.4-5.4-8.8 1.4-4.3 7.6-5.3 11-.9'/>
      </g>
      <circle cx='92' cy='24' r='7.6'/>
      <path d='M30 158l5.6 3.3v6.6l-5.6 3.3-5.6-3.3v-6.6z'/>
      <g transform='rotate(7 112 168)'>
        <path d='M96 156h30v15H96z'/>
        <path d='M111 156v15' stroke-dasharray='2 2.8'/>
      </g>
      <path d='M186 168l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'/>
      <circle cx='26' cy='120' r='4.2'/>
      <path d='M178 78v15'/>
      <path d='M170.5 85.5h15'/>
      <path d='M56 128c7-7 16 2.4 23 0'/>
      <path d='M148 190l2.6 6.6'/>
      <circle cx='196' cy='20' r='2.6'/>
      <g transform='rotate(24 74 190)'>
        <path d='M64 184h20v11H64z'/>
      </g>
    </g>
  </svg>`,
)}")`;

export const ChatScreen: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;

  const headIn = tween(t, 0, 12, E.outQuart);
  const dateIn = tween(t, 3, 12, E.outExpo);
  const bubbleIn = tween(t, 6, 16, E.outExpo);
  const typingIn = tween(t, 11, 12, E.outExpo) * (1 - tween(t, 24, 10, E.outQuart));
  const cardO = tween(t, 20, 11, E.outExpo);
  const cardPop = tween(t, 20, 22, E.outBack);
  const inputIn = tween(t, 2, 14, E.outExpo);

  const headerH = 56;
  const inputH = 62;

  return (
    <Frame dp={dp}>
      {/* wallpaper: Telegram's doodle field, tinted with the store's brand ink */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: DOODLE,
          backgroundSize: `${u(212)}px ${u(212)}px`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(185deg, rgba(15,124,128,0.06) 0%, rgba(238,241,246,0) 34%, rgba(238,241,246,0) 72%, rgba(255,255,255,0.55) 100%)`,
        }}
      />

      {/* ── Telegram header ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: u(headerH),
          display: 'flex',
          alignItems: 'center',
          gap: u(9),
          padding: `0 ${u(8)}px`,
          background: `rgba(255,255,255,0.86)`,
          backdropFilter: GLASS,
          WebkitBackdropFilter: GLASS,
          boxShadow: `0 1px 0 rgba(20,26,38,0.07)`,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * -u(10)}px)`,
          zIndex: 4,
        }}
      >
        <div style={{width: u(30), height: u(30), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Glyph name="chevron" dp={dp} size={21} color={S.brand} sw={2.05} />
        </div>
        <StoreMark dp={dp} size={38} glow={0.5} />
        <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(3)}}>
          <span
            style={{
              fontSize: u(16.5),
              fontWeight: 600,
              lineHeight: 1.22,
              color: S.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {STORE.name}
          </span>
          <span style={{display: 'flex', alignItems: 'center', gap: u(4)}}>
            <span style={{width: u(5), height: u(5), borderRadius: u(3), background: S.success}} />
            <span style={{fontSize: u(11.5), lineHeight: 1.1, color: S.brandText, fontWeight: 500}}>متصل الآن</span>
          </span>
        </div>
        <Glyph name="search" dp={dp} size={19} color={S.muted} sw={1.75} />
        <Glyph name="more" dp={dp} size={19} color={S.muted} sw={1.75} style={{marginLeft: u(4)}} />
      </div>

      {/* ── the conversation, pinned to the bottom like a live chat ──────────── */}
      <div
        style={{
          position: 'absolute',
          top: u(headerH),
          left: 0,
          right: 0,
          bottom: u(inputH + 2),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: u(9),
          padding: `0 ${u(13)}px ${u(12)}px`,
        }}
      >
        {/* date separator */}
        <div
          style={{
            alignSelf: 'center',
            padding: `${u(4)}px ${u(10)}px`,
            borderRadius: R.pill * dp,
            background: `rgba(255,255,255,0.72)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontSize: u(10.5),
            fontWeight: 500,
            color: S.faint,
            opacity: dateIn,
            transform: `translateY(${(1 - dateIn) * u(6)}px)`,
          }}
        >
          اليوم
        </div>

        {/* incoming bubble — the store's welcome */}
        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: u(296),
            padding: `${u(9)}px ${u(12)}px ${u(7)}px`,
            background: S.solid1,
            border: `1px solid ${S.border}`,
            borderRadius: `${u(17)}px ${u(17)}px ${u(6)}px ${u(17)}px`,
            boxShadow: SH.e1,
            opacity: bubbleIn,
            transform: `translateY(${(1 - bubbleIn) * u(12)}px)`,
          }}
        >
          <div
            style={{
              fontSize: u(14.2),
              lineHeight: 1.62,
              color: S.ink,
              unicodeBidi: 'plaintext',
            }}
          >
            {STORE.welcome}
          </div>
          <div
            style={{
              marginTop: u(4),
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: u(3),
            }}
          >
            <Num v="12:41" dp={dp} size={10} weight={500} color={S.faint} />
          </div>
        </div>

        {/* typing */}
        <div
          style={{
            alignSelf: 'flex-start',
            width: u(60),
            height: u(36),
            borderRadius: `${u(17)}px ${u(17)}px ${u(6)}px ${u(17)}px`,
            background: S.solid1,
            border: `1px solid ${S.border}`,
            boxShadow: SH.e1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: u(4.5),
            opacity: typingIn,
            transform: `translateY(${(1 - tween(t, 11, 12, E.outExpo)) * u(8)}px)`,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: u(6),
                height: u(6),
                borderRadius: u(3),
                background: S.muted,
                opacity: 0.42 + 0.58 * pulse(t, 26, i * 0.16),
                transform: `translateY(${-u(2.6) * pulse(t, 26, i * 0.16)}px)`,
              }}
            />
          ))}
        </div>

        {/* Mini App card — appears at t≈20 on a spring */}
        <div
          style={{
            alignSelf: 'flex-start',
            width: u(258),
            padding: u(12),
            background: S.solid1,
            border: `1px solid ${S.border}`,
            borderRadius: u(19),
            boxShadow: SH.e2,
            opacity: cardO,
            transform: `translateY(${(1 - cardO) * u(18)}px) scale(${0.94 + 0.06 * cardPop})`,
            transformOrigin: 'right bottom',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: u(8)}}>
            <StoreMark dp={dp} size={24} />
            <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(1.5)}}>
              <span style={{fontSize: u(12.4), fontWeight: 600, color: S.ink, lineHeight: 1.2, ...MIXED}}>
                {STORE.name}
              </span>
              <span
                dir="ltr"
                style={{
                  fontSize: u(10.2),
                  color: S.faint,
                  lineHeight: 1.1,
                  fontFamily: FAM.text,
                  textAlign: 'right',
                  unicodeBidi: 'isolate',
                }}
              >
                {STORE.handle}
              </span>
            </div>
            <span
              dir="ltr"
              style={{
                fontSize: u(8.8),
                fontWeight: 600,
                color: S.brandText,
                background: S.brandSoft,
                borderRadius: R.pill * dp,
                padding: `${u(3)}px ${u(6.5)}px`,
                lineHeight: 1.15,
                unicodeBidi: 'isolate',
                letterSpacing: 0,
              }}
            >
              Mini App
            </span>
          </div>

          <div
            style={{
              height: u(1),
              margin: `${u(10)}px 0`,
              backgroundImage: `repeating-linear-gradient(90deg, rgba(20,26,38,0.18) 0 ${u(3)}px, transparent ${u(3)}px ${u(7)}px)`,
            }}
          />

          <div
            style={{
              height: u(40),
              borderRadius: u(13),
              background: `linear-gradient(150deg, ${S.brand} 0%, ${S.brandText} 100%)`,
              color: S.onBrand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: u(7),
              boxShadow: `0 ${6 * dp}px ${16 * dp}px -${8 * dp}px rgba(15,124,128,0.55)`,
            }}
          >
            <Glyph name="ticket" dp={dp} size={16} color={S.onBrand} sw={1.9} />
            <span style={{fontSize: u(13.4), fontWeight: 600, lineHeight: 1}}>افتح المتجر</span>
          </div>
        </div>
      </div>

      {/* ── message input bar ───────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: u(inputH),
          padding: `${u(9)}px ${u(10)}px ${u(13)}px`,
          display: 'flex',
          alignItems: 'center',
          gap: u(9),
          background: `rgba(255,255,255,0.9)`,
          backdropFilter: GLASS,
          WebkitBackdropFilter: GLASS,
          boxShadow: `0 -1px 0 rgba(20,26,38,0.06)`,
          opacity: inputIn,
          transform: `translateY(${(1 - inputIn) * u(16)}px)`,
          zIndex: 4,
        }}
      >
        <Glyph name="paperclip" dp={dp} size={20} color={S.muted} sw={1.75} />
        <div
          style={{
            flex: 1,
            height: u(38),
            borderRadius: R.pill * dp,
            background: S.solid1,
            border: `1px solid ${S.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${u(13)}px`,
          }}
        >
          <span style={{fontSize: u(13.2), color: S.faint}}>اكتب رسالة…</span>
        </div>
        <Glyph name="mic" dp={dp} size={20} color={S.brand} sw={1.8} />
      </div>
    </Frame>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. WalletScreen — «محفظتي»
// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
  {label: HOME.tabs[0], icon: 'home' as GlyphName},
  {label: HOME.tabs[1], icon: 'orders' as GlyphName},
  {label: HOME.tabs[2], icon: 'wallet' as GlyphName},
  {label: HOME.tabs[3], icon: 'person' as GlyphName},
];

export const WalletScreen: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;

  const headIn = tween(t, 0, 14, E.outExpo);
  const cardIn = tween(t, 3, 22, E.outExpo);
  const ctaIn = tween(t, 13, 16, E.outBack);
  const tabsIn = tween(t, 8, 16, E.outExpo);

  // the balance is the app's own sample figure ($12.56); count-up in cents, integer only
  const cents = countUp(t, 7, 22, 1256);
  const amount = (cents / 100).toFixed(2);
  const amountRise = tween(t, 7, 18, E.outExpo);

  return (
    <Frame dp={dp}>
      <Bloom dp={dp} x={APP.w * 0.86} y={132} r={420} color="rgba(15,124,128,0.14)" />
      <Bloom dp={dp} x={APP.w * 0.1} y={760} r={360} color="rgba(242,169,59,0.10)" />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `${u(24)}px ${u(16)}px ${u(80)}px`,
        }}
      >
        {/* header */}
        <div
          style={{
            opacity: headIn,
            transform: `translateY(${(1 - headIn) * u(12)}px)`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: u(10),
          }}
        >
          <div style={{display: 'flex', flexDirection: 'column', gap: u(3)}}>
            <span
              style={{
                fontFamily: FAM.display,
                fontSize: u(26),
                fontWeight: 700,
                lineHeight: 1.7,
                color: S.ink,
              }}
            >
              {WALLET.title}
            </span>
            <span style={{fontSize: u(13), color: S.muted, lineHeight: 1.35, marginTop: u(-6)}}>
              {WALLET.sub}
            </span>
          </div>
        </div>

        <div style={{height: u(20)}} />

        {/* balance ticket — label, amount, perforated stub with the top-up CTA */}
        <div
          style={{
            position: 'relative',
            borderRadius: u(R.lg),
            padding: u(20),
            background: `linear-gradient(156deg, rgba(255,255,255,0.97) 0%, #EAF7F7 56%, #E2F1F1 100%)`,
            border: `1px solid rgba(15,124,128,0.14)`,
            boxShadow: SH.e2,
            overflow: 'hidden',
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * u(22)}px)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: u(-40),
              top: u(-70),
              width: u(240),
              height: u(240),
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(15,124,128,0.18) 0%, rgba(15,124,128,0) 66%)`,
            }}
          />
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{fontSize: u(12.5), fontWeight: 500, color: S.brandText, lineHeight: 1.2}}>
              {WALLET.balanceLabel}
            </span>
            <span style={{display: 'flex', alignItems: 'center', gap: u(4)}}>
              <span style={{width: u(5), height: u(5), borderRadius: u(3), background: S.saffron}} />
              <span style={{fontSize: u(9.6), fontWeight: 600, color: S.saffronText, lineHeight: 1}}>
                USD
              </span>
            </span>
          </div>

          <div
            style={{
              marginTop: u(12),
              textAlign: 'right',
              opacity: amountRise,
              transform: `translateY(${(1 - amountRise) * u(8)}px)`,
            }}
          >
            <span
              dir="ltr"
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: u(4),
                unicodeBidi: 'isolate',
              }}
            >
              <span style={{fontSize: u(21), fontWeight: 500, color: S.muted, lineHeight: 1}}>$</span>
              <Num v={amount} dp={dp} size={52} font="display" weight={700} color={S.ink} />
            </span>
          </div>

          {/* perforation + the two cut notches that make it a coupon */}
          <div style={{position: 'relative', margin: `${u(18)}px 0 ${u(14)}px`}}>
            <div
              style={{
                height: u(1),
                backgroundImage: `repeating-linear-gradient(90deg, rgba(20,26,38,0.22) 0 ${u(4)}px, transparent ${u(4)}px ${u(9)}px)`,
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: u(-27),
                top: u(-8),
                width: u(17),
                height: u(17),
                borderRadius: u(9),
                background: S.bg,
                boxShadow: `inset -1px 0 0 rgba(20,26,38,0.10)`,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: u(-27),
                top: u(-8),
                width: u(17),
                height: u(17),
                borderRadius: u(9),
                background: S.bg,
                boxShadow: `inset 1px 0 0 rgba(20,26,38,0.10)`,
              }}
            />
          </div>

          <div
            style={{
              height: u(46),
              borderRadius: u(14),
              background: `linear-gradient(150deg, ${S.brand} 0%, ${S.brandText} 100%)`,
              color: S.onBrand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: u(8),
              opacity: ctaIn,
              transform: `scale(${0.94 + 0.06 * ctaIn})`,
              boxShadow: `0 ${8 * dp}px ${20 * dp}px -${10 * dp}px rgba(15,124,128,0.6)`,
            }}
          >
            <Glyph name="plus" dp={dp} size={15} color={S.onBrand} sw={2.1} />
            <span style={{fontSize: u(14), fontWeight: 600, lineHeight: 1}}>{WALLET.deposit}</span>
          </div>
        </div>

        <div style={{height: u(24)}} />

        {/* ledger */}
        <div style={{display: 'flex', alignItems: 'center', gap: u(9), marginBottom: u(10)}}>
          <span style={{fontSize: u(13.8), fontWeight: 600, color: S.ink, lineHeight: 1.3}}>
            {WALLET.movesTitle}
          </span>
          <span style={{flex: 1, height: u(1), background: S.border}} />
        </div>

        <div
          style={{
            borderRadius: u(R.md),
            background: S.glass3,
            backdropFilter: 'blur(14px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
            border: `1px solid ${S.border}`,
            boxShadow: SH.e1,
            overflow: 'hidden',
          }}
        >
          {WALLET.moves.map((m, i) => {
            const inn = tween(t, 17 + i * 5, 15, E.outExpo);
            const plus = m.amount.startsWith('+');
            return (
              <div
                key={m.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: u(10),
                  padding: `${u(13)}px ${u(13)}px`,
                  borderTop: i === 0 ? undefined : `1px solid ${S.border}`,
                  opacity: inn,
                  transform: `translateX(${(1 - inn) * u(10)}px)`,
                }}
              >
                <div
                  style={{
                    width: u(34),
                    height: u(34),
                    borderRadius: u(12),
                    background: plus ? 'rgba(30,158,106,0.12)' : S.sunken,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Glyph
                    name={plus ? 'in' : 'out'}
                    dp={dp}
                    size={17}
                    color={plus ? S.success : S.muted}
                    sw={1.85}
                  />
                </div>
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(2.5)}}>
                  <span
                    style={{
                      fontSize: u(13),
                      fontWeight: 500,
                      color: S.ink,
                      lineHeight: 1.5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <Mixed text={m.title} />
                  </span>
                  <span style={{fontSize: u(10.6), color: S.faint, lineHeight: 1.2}}>{m.when}</span>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: u(2.5)}}>
                  <Num
                    v={m.amount}
                    dp={dp}
                    size={13}
                    weight={600}
                    color={plus ? S.success : S.ink}
                  />
                  <span
                    dir="ltr"
                    style={{
                      fontSize: u(10.2),
                      color: S.faint,
                      lineHeight: 1.15,
                      unicodeBidi: 'isolate',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {m.after}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* real control from Wallet.svelte: the ledger pages on demand */}
        <div
          style={{
            marginTop: u(14),
            height: u(42),
            borderRadius: u(14),
            background: S.glass3,
            border: `1px solid ${S.border}`,
            boxShadow: SH.e1,
            color: S.brandText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: u(13),
            fontWeight: 600,
            opacity: tabsIn,
          }}
        >
          عرض المزيد
        </div>

        <div style={{flex: 1}} />
      </div>

      {/* storefront tab bar — «المحفظة» is the active tab */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: u(64 + 12),
          paddingBottom: u(12),
          display: 'flex',
          alignItems: 'center',
          background: `rgba(255,255,255,0.86)`,
          backdropFilter: GLASS,
          WebkitBackdropFilter: GLASS,
          boxShadow: `0 -1px 0 rgba(20,26,38,0.07)`,
          opacity: tabsIn,
          transform: `translateY(${(1 - tabsIn) * u(14)}px)`,
        }}
      >
        {TABS.map((tab, i) => {
          const active = i === 2;
          return (
            <div
              key={tab.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: u(3.5),
                color: active ? S.brand : S.faint,
              }}
            >
              <Glyph name={tab.icon} dp={dp} size={21} sw={active ? 1.95 : 1.7} />
              <span style={{fontSize: u(10.2), fontWeight: active ? 600 : 500, lineHeight: 1}}>
                {tab.label}
              </span>
              <span
                style={{
                  width: active ? u(14) : 0,
                  height: u(2.5),
                  borderRadius: u(2),
                  background: S.brand,
                  opacity: active ? 1 : 0,
                }}
              />
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. FeaturesScreen — the board that answers «and what do I get?»
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Every label/sub below is the app's own wording. `src` names the file it was copied from so a
 * reviewer can diff a card against the product; `asked` is the lead's brief wording where the
 * app does not say it word-for-word (the brief's phrase is kept only where the app agrees).
 */
const FEATURES: Array<{
  icon: GlyphName;
  label: string;
  sub: string;
  src: string;
  asked?: string;
}> = [
  {
    icon: 'bolt',
    label: 'شحن فوري',
    sub: 'على آيدي اللاعب، بدون كلمة سر',
    src: 'IdentityForm.svelte «شحن فوري» · fixtures.ts منتج «شحن فوري على آيدي اللاعب، بدون كلمة سر.»',
    asked: 'تسليم فوري',
  },
  {
    icon: 'card',
    label: 'الدفع',
    sub: 'الرصيد يُخصم مرة واحدة فقط',
    src: 'CheckoutSheet.svelte «الدفع» / «رصيدك الآن» · demo.ts CHECKOUT.note',
    asked: 'دفع من الرصيد',
  },
  {
    icon: 'coin',
    label: 'عملة المتجر',
    sub: 'كل الأسعار تظهر بالعملة التي تختارها',
    src: 'storefront/screens/Me.svelte «عملة المتجر» + hint',
  },
  {
    icon: 'star',
    label: 'مستويات VIP',
    sub: 'خصومات دائمة لعملائك المميزين',
    src: 'admin/sections.ts «مستويات VIP» + blurb',
    asked: 'خصومات VIP',
  },
  {
    icon: 'megaphone',
    label: 'البث',
    sub: 'رسائل جماعية إلى عملائك من بوت متجرك، الآن أو في موعد',
    src: 'admin/sections.ts «البث» · BroadcastsList.svelte subtitle (مقتطعة)',
    asked: 'البث لعملائك',
  },
  {
    icon: 'plane',
    label: 'القنوات الإجبارية',
    sub: 'اجعل الانضمام إلى قناتك شرطاً لاستعمال المتجر',
    src: 'admin/sections.ts «القنوات الإجبارية» + blurb',
  },
  {
    icon: 'chart',
    label: 'الإحصائيات',
    sub: 'المبيعات والأرباح مقارنة بالفترة السابقة',
    src: 'admin/sections.ts «الإحصائيات» + blurb',
  },
  {
    icon: 'inbox',
    label: 'طلبات الشحن',
    sub: 'المعلقة والمرفوضة والموافق عليها آلياً',
    src: 'admin/sections.ts «طلبات الشحن» + blurb',
  },
];

export const FeaturesScreen: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;

  const titleA = tween(t, 1, 18, E.outExpo);
  const titleB = tween(t, 5, 18, E.outExpo);
  const rule = tween(t, 8, 22, E.outQuart);

  return (
    <Frame dp={dp}>
      <Bloom dp={dp} x={APP.w * 0.9} y={84} r={480} color="rgba(15,124,128,0.16)" />
      <Bloom dp={dp} x={APP.w * 0.02} y={520} r={420} color="rgba(242,169,59,0.10)" />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `${u(60)}px ${u(16)}px ${u(34)}px`,
        }}
      >
        {/* headline — [DESIGN] the one line the app does not ship; no number claimed */}
        {/* headline — [DESIGN] the app does not ship this line; it claims no number */}
        <div
          style={{
            opacity: titleA,
            transform: `translateY(${(1 - titleA) * u(12)}px)`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: u(9),
          }}
        >
          <Glyph
            name="spark"
            dp={dp}
            size={15}
            color={S.saffron}
            sw={1.6}
            style={{marginTop: u(21)}}
          />
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <span
              style={{
                fontFamily: FAM.display,
                fontSize: u(29),
                fontWeight: 600,
                lineHeight: 1.75,
                color: S.ink,
              }}
            >
              كل شيء…
            </span>
            <span
              style={{
                fontFamily: FAM.display,
                fontSize: u(29),
                fontWeight: 600,
                lineHeight: 1.75,
                color: S.ink,
                opacity: titleB,
                transform: `translateY(${(1 - titleB) * u(10)}px)`,
              }}
            >
              جاهز من أول يوم
            </span>
          </div>
        </div>
        <div
          style={{
            marginTop: u(10),
            width: u(52) * rule,
            height: u(3),
            borderRadius: u(2),
            background: `linear-gradient(90deg, ${S.brand} 0%, rgba(15,124,128,0.15) 100%)`,
          }}
        />

        {/* 2×4 board, 3-frame stagger, icon pops a beat behind its card */}
        <div
          style={{
            marginTop: u(18),
            display: 'grid',
            gridTemplateColumns: `1fr 1fr`,
            columnGap: u(11),
            rowGap: u(11),
            flex: 1,
          }}
        >
          {FEATURES.map((f, i) => {
            const d = 6 + i * 3;
            const e = entrance(t, d, {dist: 18, dur: 16, from: 0.97, blur: 9});
            const pop = tween(t, d + 3, 13, E.outBack);
            return (
              <div
                key={f.label}
                style={{
                  position: 'relative',
                  borderRadius: u(R.md),
                  padding: u(13),
                  background: `linear-gradient(158deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.84) 100%)`,
                  border: `1px solid rgba(20,26,38,0.07)`,
                  boxShadow: SH.e1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: u(10),
                  overflow: 'hidden',
                  opacity: e.o,
                  transform: `translateY(${e.y}px) scale(${0.965 + 0.035 * e.s})`,
                  filter: e.b > 0.3 ? `blur(${e.b.toFixed(2)}px)` : undefined,
                }}
              >
                <div
                  style={{
                    width: u(35),
                    height: u(35),
                    borderRadius: u(12),
                    background: S.brandSoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${0.72 + 0.28 * pop})`,
                  }}
                >
                  <Glyph name={f.icon} dp={dp} size={20} color={S.brandText} sw={1.75} />
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: u(4)}}>
                  <span
                    style={{
                      fontSize: u(14),
                      fontWeight: 600,
                      color: S.ink,
                      lineHeight: 1.4,
                    }}
                  >
                    <Mixed text={f.label} />
                  </span>
                  <span style={{fontSize: u(11), color: S.muted, lineHeight: 1.55}}>
                    <Mixed text={f.sub} />
                  </span>
                </div>

                {/* the card is a ticket too: a tear along its bottom edge */}
                <div
                  style={{
                    position: 'absolute',
                    left: u(13),
                    right: u(13),
                    bottom: u(9),
                    height: u(1),
                    backgroundImage: `repeating-linear-gradient(90deg, rgba(20,26,38,0.14) 0 ${u(3)}px, transparent ${u(3)}px ${u(7)}px)`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. SuccessToast — «تم الدفع وبدأ تنفيذ طلبك», composited over the product screen
// ═════════════════════════════════════════════════════════════════════════════
export const SuccessToast: React.FC<Shot> = ({dp, t}) => {
  const u = (n: number) => n * dp;

  const inS = tween(t, 2, 20, E.outBack);
  const land = tween(t, 2, 12, E.outExpo);
  const draw = tween(t, 8, 14, E.outQuart);
  const ring = pulse(t, 34, 0.1);
  const sheen = tween(t, 20, 26, E.inOut);

  return (
    <Frame dp={dp} bg="transparent">
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: u(104),
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: u(320),
            padding: `${u(11)}px ${u(14)}px`,
            borderRadius: u(17),
            background: `linear-gradient(158deg, rgba(22,29,40,0.97) 0%, rgba(14,19,27,0.99) 100%)`,
            border: `1px solid rgba(255,255,255,0.10)`,
            boxShadow: `0 ${10 * dp}px ${30 * dp}px -${8 * dp}px rgba(6,23,31,0.55), 0 ${2 * dp}px ${6 * dp}px rgba(6,23,31,0.3)`,
            display: 'flex',
            alignItems: 'center',
            gap: u(11),
            overflow: 'hidden',
            opacity: land,
            transform: `translateY(${(1 - inS) * u(26)}px) scale(${0.94 + 0.06 * inS})`,
          }}
        >
          {/* success tick — the stroke draws itself */}
          <div style={{position: 'relative', width: u(30), height: u(30), flexShrink: 0}}>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                boxShadow: `0 0 0 ${u(2 + 5 * ring)}px rgba(30,158,106,${0.3 * (1 - ring)})`,
              }}
            />
            <div
              style={{
                width: u(30),
                height: u(30),
                borderRadius: '50%',
                background: S.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${0.6 + 0.4 * draw})`,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width={u(16)}
                height={u(16)}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path
                  d="M5.6 12.6 10 17 18.4 7.4"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - draw}
                />
              </svg>
            </div>
          </div>

          <span
            style={{
              flex: 1,
              fontSize: u(13.6),
              fontWeight: 600,
              lineHeight: 1.45,
              color: S.inkOnDark,
              textAlign: 'center',
              ...MIXED,
            }}
          >
            {SUCCESS.title}
          </span>

          {/* one soft sheen, no glow loop */}
          <span
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: u(54),
              left: `${-20 + sheen * 130}%`,
              background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0) 100%)`,
              transform: 'skewX(-14deg)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </Frame>
  );
};

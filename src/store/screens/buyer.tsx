/**
 * Buyer side of the store film: the four screens a customer actually sees.
 *
 * Contract: every screen is `React.FC<{dp: number; t: number}>`. `t` is frames since
 * the shot began — motion is a pure function of it (never `useCurrentFrame`), so a
 * scene can mount a screen anywhere on the timeline. `AppCanvas` owns the dp scale and
 * sets `dir="rtl"`; anything drawn outside it must do both itself (see CheckoutSheet).
 *
 * Safe area: the film's phone frame draws the camera over the top of the screen, so the
 * OS bar starts at `SAFE_TOP` and every screen begins below that.
 *
 * Copy: `src/store/demo.ts` only, with four exceptions — all of them the real app's own
 * tables, marked `[app: …]` where they are used:
 *   - `lib/catalog/kinds.ts`  → the pre-purchase note on the product page
 *   - `lib/orders/status.ts`  → «شحن لعبة» chip, «قيد التنفيذ», the printed steps
 * and one heading the brief asked for that the app does not have: «الأكثر طلباً»
 * (`[DESIGN]` — the products under it are real `demo.ts` rows).
 *
 * Visual language, reconstructed from the app (not invented):
 *   - tickets: 20 radius, 11 px notches at the perforation, 6-on/12-off dashes,
 *     white body with a 5 % brand wash, `solid-2` stub.
 *   - glass chrome: store header and the bottom sheet (`blur(18px) saturate(1.5)`).
 *   - money is saffron; nothing else is.
 */
import React from 'react';
import {
  AppCanvas,
  StatusBar,
  Card,
  Row,
  Divider,
  SectionTitle,
  Chip,
  Btn,
  Icon,
  IconBtn,
  Num,
  DrawCheck,
  E,
  tween,
  type IconName,
  type ScreenProps,
} from '../ui';
import {S, R, F, SH, GLASS, APP} from '../tokens';
import {STORE, HOME, CATEGORIES, PRODUCT, CHECKOUT, SUCCESS, ORDERS} from '../demo';

/* ──────────────────────────────────────────────────────────────────────────────
 * frame constants
 * ────────────────────────────────────────────────────────────────────────────── */

/** Camera / island safe area above the OS bar (the phone in the film owns this space). */
const SAFE_TOP = 32;
const STATUS = 30;
const HEADER = 56;
/** y of the first pixel a screen may paint its own chrome on. */
export const CHROME_TOP = SAFE_TOP + STATUS + HEADER;

/* ──────────────────────────────────────────────────────────────────────────────
 * timing + shape helpers
 * ────────────────────────────────────────────────────────────────────────────── */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Rise + fade + a whisper of scale. Everything on these screens enters this way. */
const enter = (t: number, at: number, dist = 14, dur = 20, scale = 0.02): React.CSSProperties => {
  const p = tween(t, at, dur, E.outExpo);
  return {
    opacity: clamp01(p * 1.6),
    transform: `translate3d(0, ${((1 - p) * dist).toFixed(2)}px, 0) scale(${(1 - (1 - p) * scale).toFixed(4)})`,
  };
};

/**
 * Money, the way the app prints it: a small `$` ahead of tabular display-font figures,
 * cut out of the bidi flow so the pair never re-orders inside an RTL line. `Price` from
 * the kit sets the symbol at 0.55em, which at these sizes reads as a stray «s» — hence
 * this.
 */
const Money: React.FC<{v: string; size: number; color?: string; weight?: number}> = ({
  v,
  size,
  color = S.ink,
  weight = 600,
}) => {
  const m = /^([^0-9]*)([0-9.,]+)$/.exec(v.trim());
  const sym = m ? m[1].trim() : '';
  const fig = m ? m[2] : v;
  return (
    <span
      dir="ltr"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: F.display,
        color,
        unicodeBidi: 'isolate',
        whiteSpace: 'nowrap',
      }}
    >
      {sym && (
        <span style={{fontSize: size * 0.76, fontWeight: 500, marginInlineEnd: size * 0.05, lineHeight: 1}}>{sym}</span>
      )}
      <span style={{fontSize: size, fontWeight: weight, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1}}>{fig}</span>
    </span>
  );
};

/** Concave notches on the two corners that meet the perforation. */
const notchMask = (radius: number, at: 'top' | 'bottom'): React.CSSProperties => {
  const y = at === 'top' ? '0' : '100%';
  const a = `radial-gradient(circle at 0 ${y}, transparent ${radius}px, #000 ${radius + 0.5}px)`;
  const b = `radial-gradient(circle at 100% ${y}, transparent ${radius}px, #000 ${radius + 0.5}px)`;
  return {
    maskImage: `${a}, ${b}`,
    maskSize: '51% 100%',
    maskPosition: 'left top, right top',
    maskRepeat: 'no-repeat',
    WebkitMaskImage: `${a}, ${b}`,
    WebkitMaskSize: '51% 100%',
    WebkitMaskPosition: 'left top, right top',
    WebkitMaskRepeat: 'no-repeat',
  };
};

/** Same notches, but at a fixed pixel seam (used by the single-piece package cards). */
const notchMaskAt = (radius: number, y: number): React.CSSProperties => {
  const a = `radial-gradient(circle at 0 ${y}px, transparent ${radius}px, #000 ${radius + 0.5}px)`;
  const b = `radial-gradient(circle at 100% ${y}px, transparent ${radius}px, #000 ${radius + 0.5}px)`;
  return {
    maskImage: `${a}, ${b}`,
    maskSize: '51% 100%',
    maskPosition: 'left top, right top',
    maskRepeat: 'no-repeat',
    WebkitMaskImage: `${a}, ${b}`,
    WebkitMaskSize: '51% 100%',
    WebkitMaskPosition: 'left top, right top',
    WebkitMaskRepeat: 'no-repeat',
  };
};

const HAIRLINE = `inset 0 -1px 0 ${S.border}`;
const GLOW = 'inset 0 1px 0 rgba(255,255,255,0.92)';
/** Arabic display type needs air between words, not between letters. */
const WORDS = {wordSpacing: '0.09em'} as React.CSSProperties;

/* ──────────────────────────────────────────────────────────────────────────────
 * chrome + shared objects
 * ────────────────────────────────────────────────────────────────────────────── */

/** Camera safe area: dead space at the very top of the screen. */
const SafeTop: React.FC = () => <div style={{height: SAFE_TOP, flex: 'none'}} />;

/** The store's mark: the coupon glyph, on the brand gradient. */
const Logo: React.FC<{size?: number}> = ({size = 40}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      flex: 'none',
      background: `linear-gradient(150deg, #3BBCC0 0%, ${S.brand} 52%, #0A5F63 100%)`,
      boxShadow: `0 8px 16px -8px rgba(15,124,128,0.9), inset 0 1px 0 rgba(255,255,255,0.32)`,
      display: 'grid',
      placeItems: 'center',
      overflow: 'hidden',
    }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 64" fill="none">
      <rect x="9.5" y="13.5" width="45" height="37" rx="8" stroke="#FFFFFF" strokeWidth="4.2" />
      <path d="M32 14.5v35" stroke="#FFFFFF" strokeWidth="3.4" strokeDasharray="2.5 5.5" strokeLinecap="round" />
      <circle cx="9.5" cy="32" r="4.6" fill="#0A5F63" />
      <circle cx="54.5" cy="32" r="4.6" fill="#0A5F63" />
    </svg>
  </div>
);

/** The wallet chip — the only saffron object on the buyer's screens. */
const BalanceChip: React.FC<{amount: string; size?: number}> = ({amount, size = 40}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: size,
      borderRadius: R.pill,
      background: S.saffronSoft,
      boxShadow: `inset 0 0 0 1px rgba(242,169,59,0.44), ${GLOW}`,
      flex: 'none',
    }}
  >
    <div style={{display: 'flex', alignItems: 'center', gap: 7, paddingInline: '5px 9px'}}>
      <div
        style={{
          width: size * 0.58,
          height: size * 0.58,
          borderRadius: '50%',
          background: S.saffron,
          display: 'grid',
          placeItems: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
        }}
      >
        <Icon name="wallet" size={size * 0.32} color={S.saffronInk} sw={2.1} />
      </div>
      <Money v={amount} size={size * 0.42} color={S.saffronText} />
    </div>
    <div
      style={{
        width: size * 0.74,
        height: size * 0.74,
        marginInline: 3,
        borderRadius: '50%',
        background: S.saffron,
        display: 'grid',
        placeItems: 'center',
        boxShadow: `0 6px 12px -6px ${S.saffron}, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
    >
      <Icon name="plus" size={size * 0.34} color={S.saffronInk} sw={2.6} />
    </div>
  </div>
);

/** Store top bar: glass, logo + name, wallet on the far side. */
const StoreHeader: React.FC<{balance: string; t: number}> = ({balance, t}) => {
  const p = tween(t, 0, 16, E.outExpo);
  return (
    <div
      style={{
        height: HEADER,
        flex: 'none',
        position: 'relative',
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingInline: 16,
        background: S.glass2,
        backdropFilter: GLASS,
        WebkitBackdropFilter: GLASS,
        boxShadow: `${HAIRLINE}, 0 10px 24px -18px rgba(20,26,38,0.42)`,
        opacity: clamp01(p * 1.6),
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
        <Logo size={40} />
        <div style={{minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1}}>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 16,
              fontWeight: 600,
              color: S.ink,
              lineHeight: 1.32,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {STORE.name}
          </div>
          <div style={{fontFamily: F.text, fontSize: 10.5, color: S.faint, lineHeight: 1.3, direction: 'ltr', textAlign: 'right'}}>
            {STORE.handle}
          </div>
        </div>
      </div>
      <div style={enter(t, 6, 8, 18, 0.04)}>
        <BalanceChip amount={balance} size={40} />
      </div>
    </div>
  );
};

/** Search field — a control, not a claim. */
const SearchField: React.FC<{t: number}> = ({t}) => (
  <div
    style={{
      height: 46,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      paddingInline: 15,
      borderRadius: R.sm,
      background: S.glass1,
      backdropFilter: GLASS,
      WebkitBackdropFilter: GLASS,
      boxShadow: `inset 0 0 0 1px ${S.border}, ${GLOW}, ${SH.e1}`,
      ...enter(t, 0, 12, 20),
    }}
  >
    <Icon name="search" size={18} color={S.faint} sw={2.1} />
    <span style={{fontFamily: F.text, fontSize: 15, color: S.faint, lineHeight: 1.4}}>{HOME.search}</span>
  </div>
);

/* six categories, six muted hues — colour belongs to the merchandise, not the chrome */
const CAT_ART: ReadonlyArray<{hue: string; wash: string; icon: IconName}> = [
  {hue: '#0F7C80', wash: '#D7EFEF', icon: 'star'},
  {hue: '#3F6FB0', wash: '#E1EAF7', icon: 'coupon'},
  {hue: '#2AA5A9', wash: '#DCF1F2', icon: 'phone'},
  {hue: '#1E9E6A', wash: '#DBF1E6', icon: 'users'},
  {hue: '#C08430', wash: '#FBEDD3', icon: 'coin'},
  {hue: '#6C5CA8', wash: '#ECE8F7', icon: 'gift'},
];

const CategoryTile: React.FC<{index: number; label: string; sub: string; t: number}> = ({index, label, sub, t}) => {
  const art = CAT_ART[index % CAT_ART.length];
  return (
    <div
      style={{
        background: S.solid1,
        borderRadius: R.md,
        overflow: 'hidden',
        boxShadow: `inset 0 0 0 1px ${S.border}, ${SH.e1}`,
        ...enter(t, 18 + index * 2.4, 18, 20, 0.035),
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          background: `radial-gradient(110% 90% at 76% 4%, ${art.hue}2A 0%, transparent 56%), linear-gradient(162deg, ${art.wash} 0%, #FCFDFE 86%)`,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '-18%',
            bottom: '-24%',
            width: '76%',
            height: '52%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${art.hue}22 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: 'relative',
            width: '56%',
            aspectRatio: '1 / 1',
            borderRadius: '27%',
            background: 'linear-gradient(158deg, #FFFFFF 0%, #F4F8FA 100%)',
            boxShadow: `0 10px 20px -12px ${art.hue}99, inset 0 0 0 1px rgba(255,255,255,0.9), inset 0 -2px 6px ${art.hue}14`,
            display: 'grid',
            placeItems: 'center',
            color: art.hue,
          }}
        >
          <Icon name={art.icon} size={28} sw={1.9} />
        </div>
      </div>
      <div style={{padding: '8px 8px 9px', display: 'flex', flexDirection: 'column', gap: 2}}>
        <div
          style={{
            fontFamily: F.text,
            fontSize: 13,
            fontWeight: 600,
            color: S.ink,
            lineHeight: 1.35,
            minHeight: 18,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: F.text,
            fontSize: 10.5,
            color: S.muted,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
};

/** Product mark: UC on the brand gradient — stands in for the store's own photo. */
const ProductArt: React.FC<{size: number; radius?: number; badge?: boolean}> = ({size, radius = 26, badge = true}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      flex: 'none',
      position: 'relative',
      overflow: 'hidden',
      background: `radial-gradient(120% 90% at 76% 8%, #46C7CB 0%, ${S.brand} 46%, #095A5E 100%)`,
      boxShadow: `0 14px 26px -16px rgba(9,90,94,0.95), inset 0 1px 0 rgba(255,255,255,0.3)`,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    <div style={{position: 'absolute', inset: size * 0.1, borderRadius: '50%', border: '1.4px solid rgba(255,255,255,0.24)'}} />
    <div
      style={{
        position: 'absolute',
        inset: size * 0.2,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 28%, rgba(255,255,255,0.26), rgba(255,255,255,0) 64%)',
      }}
    />
    <div
      style={{
        position: 'relative',
        fontFamily: F.display,
        fontSize: size * 0.32,
        fontWeight: 700,
        color: '#FFFFFF',
        lineHeight: 1,
        textShadow: '0 2px 10px rgba(0,0,0,0.2)',
      }}
    >
      UC
    </div>
    {badge && size >= 60 && (
      <div
        style={{
          position: 'absolute',
          left: size * 0.08,
          bottom: size * 0.08,
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: '50%',
          background: S.saffron,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 4px 10px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <Icon name="coin" size={size * 0.17} color={S.saffronInk} sw={2.2} />
      </div>
    )}
  </div>
);

/** Gift-card mark, for the second featured product. */
const CardArt: React.FC<{size: number; radius?: number}> = ({size, radius = 16}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      flex: 'none',
      position: 'relative',
      overflow: 'hidden',
      background: `radial-gradient(120% 100% at 78% 6%, #6E86C4 0%, #40598F 52%, #2B3E66 100%)`,
      boxShadow: `0 10px 20px -14px rgba(43,62,102,0.95), inset 0 1px 0 rgba(255,255,255,0.28)`,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: size * 0.18,
        left: size * 0.12,
        right: size * 0.12,
        height: size * 0.1,
        borderRadius: size * 0.05,
        background: 'rgba(255,255,255,0.22)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: size * 0.16,
        left: size * 0.12,
        width: size * 0.34,
        height: size * 0.09,
        borderRadius: size * 0.05,
        background: 'rgba(255,255,255,0.16)',
      }}
    />
    <Icon name="coupon" size={size * 0.34} color="#FFFFFF" sw={1.9} />
  </div>
);

/* ──────────────────────────────────────────────────────────────────────────────
 * the ticket (Voucher.svelte): body + stub, notched where they meet
 * ────────────────────────────────────────────────────────────────────────────── */

const Voucher: React.FC<{
  stubAt: 'top' | 'bottom';
  stub: React.ReactNode;
  body: React.ReactNode;
  stubBg?: string;
  bodyBg?: string;
  style?: React.CSSProperties;
}> = ({stubAt, stub, body, stubBg = S.solid2, bodyBg, style}) => {
  const n = 11;
  const r = R.md;
  const bodyEl = (
    <div
      style={{
        background: bodyBg ?? `linear-gradient(180deg, rgba(15,124,128,0.055) 0%, rgba(15,124,128,0) 54%), ${S.solid1}`,
        padding: '15px 16px 13px',
        borderRadius: stubAt === 'bottom' ? `${r}px ${r}px 0 0` : `0 0 ${r}px ${r}px`,
        ...notchMask(n, stubAt === 'bottom' ? 'bottom' : 'top'),
      }}
    >
      {body}
    </div>
  );
  const stubEl = (
    <div
      style={{
        background: stubBg,
        padding: '12px 16px 14px',
        borderRadius: stubAt === 'bottom' ? `0 0 ${r}px ${r}px` : `${r}px ${r}px 0 0`,
        ...notchMask(n, stubAt === 'bottom' ? 'top' : 'bottom'),
      }}
    >
      {stub}
    </div>
  );
  const seam = (
    <div
      style={{
        height: 2,
        marginInline: n + 8,
        backgroundImage: 'repeating-linear-gradient(to right, rgba(20,26,38,0.22) 0 6px, transparent 6px 12px)',
      }}
    />
  );
  return (
    <div
      style={{
        position: 'relative',
        filter: 'drop-shadow(0 0 0.6px rgba(20,26,38,0.38)) drop-shadow(0 8px 9px rgba(20,26,38,0.08))',
        ...style,
      }}
    >
      {stubAt === 'top' ? (
        <>
          {stubEl}
          {seam}
          {bodyEl}
        </>
      ) : (
        <>
          {bodyEl}
          {seam}
          {stubEl}
        </>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────────
 * 1 · store home
 * ────────────────────────────────────────────────────────────────────────────── */

/** A product in the «الأكثر طلباً» strip: thumb, name, price. */
const FeaturedCard: React.FC<{art: React.ReactNode; name: string; price: string; meta?: string; t: number; at: number}> = ({
  art,
  name,
  price,
  meta,
  t,
  at,
}) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      height: 76,
      padding: 11,
      display: 'flex',
      gap: 10,
      background: S.solid1,
      borderRadius: 18,
      boxShadow: `inset 0 0 0 1px ${S.border}, ${SH.e1}`,
      ...enter(t, at, 16, 20, 0.03),
    }}
  >
    {art}
    <div style={{minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
      <div
        style={{
          fontFamily: F.text,
          fontSize: 12.5,
          fontWeight: 600,
          color: S.ink,
          lineHeight: 1.38,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6}}>
        <Money v={price} size={14} />
        {meta && (
          <span
            style={{
              fontFamily: F.text,
              fontSize: 9.5,
              color: S.faint,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              unicodeBidi: 'plaintext',
            }}
          >
            {meta}
          </span>
        )}
      </div>
    </div>
  </div>
);

export const StoreHome: React.FC<ScreenProps> = ({dp, t}) => (
  <AppCanvas dp={dp} chrome={false} tabs activeTab={0}>
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column'}}>
      <SafeTop />
      <StatusBar />
      <StoreHeader balance={CHECKOUT.balance} t={t} />
      <div style={{flex: 1, minHeight: 0, overflow: 'hidden', paddingInline: 16}}>
        <div style={{paddingTop: 12}}>
          <div style={{fontFamily: F.text, fontSize: 13, fontWeight: 500, color: S.muted, lineHeight: 1.4, ...enter(t, 2, 8, 16)}}>
            {HOME.hello}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: F.display,
              fontSize: 25,
              fontWeight: 600,
              color: S.ink,
              lineHeight: 1.38,
              ...WORDS,
              ...enter(t, 5, 12, 22),
            }}
          >
            {HOME.question}
          </div>
          <div style={{marginTop: 13}}>
            <SearchField t={t - 9} />
          </div>
          <div
            style={{
              marginTop: 13,
              fontFamily: F.text,
              fontSize: 14,
              color: S.muted,
              lineHeight: 1.62,
              ...enter(t, 12, 10, 20),
            }}
          >
            {STORE.welcome}
          </div>
          <div style={{marginTop: 16, ...enter(t, 16, 10, 18)}}>
            <SectionTitle style={{marginBottom: 9}}>{HOME.section}</SectionTitle>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 8, rowGap: 8}}>
            {CATEGORIES.map((c, i) => (
              <CategoryTile key={c.label} index={i} label={c.label} sub={c.sub} t={t} />
            ))}
          </div>

          {/* [DESIGN] section heading; both products below are real demo.ts rows */}
          <div style={{marginTop: 16, ...enter(t, 30, 10, 18)}}>
            <SectionTitle style={{marginBottom: 9}}>الأكثر طلباً</SectionTitle>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <FeaturedCard
              art={<ProductArt size={54} radius={16} badge={false} />}
              name={PRODUCT.name}
              price={PRODUCT.packages[2].price}
              meta={CHECKOUT.rows[0][1]}
              t={t}
              at={33}
            />
            <FeaturedCard
              art={<CardArt size={54} radius={16} />}
              name={ORDERS.rows[1].name}
              price={ORDERS.rows[1].amount}
              t={t}
              at={35}
            />
          </div>
        </div>
      </div>
    </div>
  </AppCanvas>
);

/* ──────────────────────────────────────────────────────────────────────────────
 * 2 · product
 * ────────────────────────────────────────────────────────────────────────────── */

/** [app: lib/catalog/kinds.ts → KIND_NOTE.topup] */
const KIND_NOTE = {
  title: 'شحن مباشر على حسابك',
  text: 'يصل الشحن خلال دقائق. تأكد من الآيدي قبل الدفع، فالشحنة التي وصلت لا تُسترد.',
};
/** [app: lib/orders/status.ts → KIND_LABEL.topup] */
const KIND_LABEL = 'شحن لعبة';

const PACKAGES = PRODUCT.packages.slice(0, 4);
const SELECTED_LABEL = (PRODUCT.packages.find((p) => 'selected' in p) ?? PRODUCT.packages[2]).label;

/** One package voucher: name over the perforation, price under it. */
const PackageVoucher: React.FC<{
  label: string;
  price: string;
  selected: boolean;
  select: number;
  t: number;
  index: number;
}> = ({label, price, selected, select, t, index}) => {
  const on = selected ? clamp01(select) : 0;
  const pulse = 1 + 0.035 * Math.sin(Math.PI * clamp01((t - 18) / 14));
  return (
    <div style={{position: 'relative', transform: `scale(${(selected ? lerp(1, pulse, on) : 1).toFixed(4)})`}}>
      <div
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: R.md + 3,
          background: 'radial-gradient(120% 120% at 50% 0%, rgba(15,124,128,0.26), rgba(15,124,128,0) 72%)',
          opacity: on,
          filter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          borderRadius: R.md,
          background: S.solid1,
          boxShadow: selected
            ? `inset 0 0 0 1.6px ${S.brand}, 0 12px 22px -14px rgba(15,124,128,0.8)`
            : `inset 0 0 0 1px ${S.border}, ${SH.e1}`,
          overflow: 'hidden',
          ...notchMaskAt(9, 46),
          ...enter(t, 12 + index * 2.2, 16, 20, 0.03),
        }}
      >
        <div
          style={{
            height: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            paddingInline: 12,
            background: selected
              ? 'linear-gradient(180deg, rgba(15,124,128,0.11) 0%, rgba(15,124,128,0.02) 100%)'
              : 'linear-gradient(180deg, rgba(15,124,128,0.05) 0%, rgba(15,124,128,0) 100%)',
          }}
        >
          <span
            style={{
              fontFamily: F.text,
              fontSize: 14.5,
              fontWeight: 600,
              color: S.ink,
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              unicodeBidi: 'plaintext',
            }}
          >
            {label}
          </span>
          <span
            style={{
              width: 17,
              height: 17,
              borderRadius: 9,
              background: S.brand,
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
              opacity: on,
              transform: `scale(${lerp(0.55, 1, on).toFixed(3)})`,
              boxShadow: `0 4px 8px -4px ${S.brand}`,
            }}
          >
            <Icon name="check" size={10.5} color="#FFFFFF" sw={3.2} />
          </span>
        </div>
        <div
          style={{
            height: 1,
            marginInline: 12,
            backgroundImage: 'repeating-linear-gradient(to right, rgba(20,26,38,0.2) 0 5px, transparent 5px 10px)',
          }}
        />
        <div
          style={{
            height: 50,
            display: 'flex',
            alignItems: 'center',
            paddingInline: 12,
            background: selected ? S.brandSoft : S.solid2,
          }}
        >
          <Money v={price} size={19} color={selected ? S.brandText : S.ink} />
        </div>
      </div>
    </div>
  );
};

export const ProductScreen: React.FC<ScreenProps> = ({dp, t}) => {
  const select = tween(t, 18, 12, E.outBack);
  const cta = tween(t, 30, 18, E.outExpo);
  const caret = 0.6 + 0.4 * Math.cos(t / 7);
  return (
    <AppCanvas dp={dp} chrome={false} tabs activeTab={0}>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column'}}>
        <SafeTop />
        <StatusBar />
        <div
          style={{
            height: HEADER,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingInline: 12,
            background: S.glass2,
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            boxShadow: `${HAIRLINE}, 0 10px 24px -18px rgba(20,26,38,0.42)`,
            position: 'relative',
            zIndex: 3,
            ...enter(t, 0, 8, 16),
          }}
        >
          <IconBtn name="forward" size={36} />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: F.display,
              fontSize: 16,
              fontWeight: 600,
              color: S.ink,
              lineHeight: 1.35,
              ...WORDS,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {PRODUCT.name}
          </div>
          <IconBtn name="dots" size={36} />
        </div>

        <div style={{flex: 1, minHeight: 0, overflow: 'hidden', paddingInline: 16}}>
          <div style={{paddingTop: 14}}>
            <div style={{display: 'flex', gap: 14, ...enter(t, 3, 14, 20)}}>
              <ProductArt size={88} />
              <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8}}>
                <div style={{display: 'flex'}}>
                  <Chip tone="brand" size={11.5}>
                    {KIND_LABEL}
                  </Chip>
                </div>
                <div style={{fontFamily: F.text, fontSize: 14, color: S.muted, lineHeight: 1.6}}>{PRODUCT.desc}</div>
              </div>
            </div>

            {/* what the customer should know before paying [app: kinds.ts] */}
            <div style={{marginTop: 14, ...enter(t, 9, 12, 20)}}>
              <Card pad={12} radius={R.sm} bg={S.brandSoft} border={false} shadow="none">
                <div style={{display: 'flex', gap: 10}}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      flex: 'none',
                      background: S.solid1,
                      color: S.brandText,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: `0 6px 12px -8px ${S.brand}`,
                    }}
                  >
                    <Icon name="spark" size={15} sw={2} />
                  </div>
                  <div style={{minWidth: 0}}>
                    <div style={{fontFamily: F.text, fontSize: 12.5, fontWeight: 600, color: S.brandText, lineHeight: 1.4}}>
                      {KIND_NOTE.title}
                    </div>
                    <div style={{marginTop: 2, fontFamily: F.text, fontSize: 11.5, color: S.brandText, lineHeight: 1.55}}>
                      {KIND_NOTE.text}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div style={{marginTop: 16, ...enter(t, 11, 10, 18)}}>
              <SectionTitle style={{marginBottom: 9}}>{PRODUCT.section}</SectionTitle>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8}}>
              {PACKAGES.map((p, i) => (
                <PackageVoucher
                  key={p.label}
                  label={p.label}
                  price={p.price}
                  selected={p.label === SELECTED_LABEL}
                  select={select}
                  t={t}
                  index={i}
                />
              ))}
            </div>

            {/* the field the order is delivered to */}
            <div style={{marginTop: 14, ...enter(t, 26, 14, 20)}}>
              <Card
                pad={13}
                radius={R.sm}
                style={{background: S.glass1, backdropFilter: GLASS, WebkitBackdropFilter: GLASS}}
              >
                <div style={{fontFamily: F.text, fontSize: 12, fontWeight: 500, color: S.muted, lineHeight: 1.4}}>
                  {PRODUCT.field}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 46,
                    borderRadius: 12,
                    background: S.solid1,
                    boxShadow: `inset 0 0 0 1.6px ${S.brand}, 0 0 0 4px rgba(15,124,128,0.10)`,
                    display: 'flex',
                    alignItems: 'center',
                    paddingInline: 13,
                  }}
                >
                  <span style={{width: 1.6, height: 19, borderRadius: 1, background: S.brand, opacity: caret}} />
                </div>
                <div style={{marginTop: 8, fontFamily: F.text, fontSize: 11.5, color: S.faint, lineHeight: 1.6}}>
                  {PRODUCT.hint}
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* sticky payment bar */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
            height: 68,
            paddingInline: 12,
            borderRadius: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: S.glass3,
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            boxShadow: `inset 0 0 0 1px ${S.border}, inset 0 1px 0 rgba(255,255,255,0.96), ${SH.e2}`,
            opacity: clamp01(cta * 1.5),
            transform: `translate3d(0, ${((1 - cta) * 26).toFixed(2)}px, 0)`,
            zIndex: 4,
          }}
        >
          <div style={{display: 'flex', flexDirection: 'column', gap: 2, paddingInline: 2}}>
            <span style={{fontFamily: F.text, fontSize: 10.5, color: S.muted, lineHeight: 1.3}}>{CHECKOUT.rows[2][0]}</span>
            <Money v={PRODUCT.packages[2].price} size={19} />
          </div>
          <Btn tone="brand" size="lg" full style={{flex: 1, minHeight: 48}}>
            {PRODUCT.cta}
          </Btn>
        </div>
      </div>
    </AppCanvas>
  );
};

/* ──────────────────────────────────────────────────────────────────────────────
 * 3 · checkout sheet
 * ────────────────────────────────────────────────────────────────────────────── */

const ReceiptRow: React.FC<{label: string; value: React.ReactNode}> = ({label, value}) => (
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 26}}>
    <span style={{fontFamily: F.text, fontSize: 13, color: S.muted, lineHeight: 1.4}}>{label}</span>
    <span
      style={{
        fontFamily: F.text,
        fontSize: 13.5,
        fontWeight: 600,
        color: S.ink,
        lineHeight: 1.4,
        unicodeBidi: 'plaintext',
      }}
    >
      {value}
    </span>
  </div>
);

const MoneyRow: React.FC<{label: string; value: string; strong?: boolean}> = ({label, value, strong = false}) => (
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 25}}>
    <span
      style={{
        fontFamily: F.text,
        fontSize: 12.5,
        color: strong ? S.saffronText : S.muted,
        fontWeight: strong ? 600 : 500,
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
    <Money v={value} size={17} color={S.saffronText} />
  </div>
);

export const CheckoutSheet: React.FC<ScreenProps> = ({dp, t}) => {
  const rise = tween(t, 0, 26, E.outQuart);
  const scrim = tween(t, 0, 16, E.outExpo);
  const y = (1 - rise) * 170;
  const content = tween(t, 4, 20, E.outExpo);
  return (
    <div style={{position: 'relative', width: APP.w * dp, height: APP.h * dp, overflow: 'hidden'}}>
      {/* what the sheet opens over: the product page, already settled */}
      <ProductScreen dp={dp} t={120} />

      {/*
        The overlay lives outside AppCanvas, so it owns both things AppCanvas would give
        its children: the dp scale and `dir="rtl"`. Logical units everywhere inside.
      */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: APP.w,
          height: APP.h,
          transform: `scale(${dp})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: SAFE_TOP + STATUS,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(14,19,27,0.42)',
            opacity: scrim,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            transform: `translate3d(0, ${y.toFixed(2)}px, 0)`,
            borderRadius: `${R.lg}px ${R.lg}px 0 0`,
            background: S.glass3,
            backdropFilter: GLASS,
            WebkitBackdropFilter: GLASS,
            boxShadow: `inset 0 0 0 1px ${S.border}, inset 0 1px 0 rgba(255,255,255,0.96), ${SH.e3}`,
          }}
        >
          <div style={{paddingTop: 10, display: 'grid', placeItems: 'center'}}>
            <div style={{width: 44, height: 5, borderRadius: 3, background: S.borderStrong}} />
          </div>

          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingInline: 20,
              opacity: content,
            }}
          >
            <span style={{fontFamily: F.display, fontSize: 20, fontWeight: 600, color: S.ink, lineHeight: 1.35, ...WORDS}}>
              {CHECKOUT.title}
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: S.sunken,
                display: 'grid',
                placeItems: 'center',
                color: S.muted,
                flex: 'none',
              }}
            >
              <Icon name="close" size={15} sw={2.2} />
            </div>
          </div>

          <div
            style={{
              padding: '2px 20px 0',
              opacity: content,
              transform: `translate3d(0, ${((1 - content) * 14).toFixed(2)}px, 0)`,
            }}
          >
            <Voucher
              stubAt="bottom"
              body={
                <>
                  <div style={{display: 'flex', gap: 11, alignItems: 'center'}}>
                    <ProductArt size={42} radius={13} badge={false} />
                    <div style={{minWidth: 0, flex: 1}}>
                      <div
                        style={{
                          fontFamily: F.text,
                          fontSize: 14.5,
                          fontWeight: 600,
                          color: S.ink,
                          lineHeight: 1.35,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {PRODUCT.name}
                      </div>
                      <div style={{marginTop: 2, fontFamily: F.text, fontSize: 11.5, color: S.muted, lineHeight: 1.4}}>
                        {KIND_LABEL}
                      </div>
                    </div>
                  </div>
                  <div style={{height: 1, background: S.border, marginBlock: 11}} />
                  <ReceiptRow label={CHECKOUT.rows[0][0]} value={CHECKOUT.rows[0][1]} />
                  <ReceiptRow label={CHECKOUT.rows[1][0]} value={CHECKOUT.rows[1][1]} />
                </>
              }
              stub={
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                  <span style={{fontFamily: F.text, fontSize: 12.5, color: S.muted, fontWeight: 500, lineHeight: 1.4}}>
                    {CHECKOUT.rows[2][0]}
                  </span>
                  <Money v={CHECKOUT.rows[2][1]} size={26} />
                </div>
              }
            />

            <div
              style={{
                marginTop: 14,
                background: S.sunken,
                borderRadius: R.sm,
                padding: '9px 14px',
                boxShadow: 'inset 0 0 0 1px rgba(20,26,38,0.05)',
              }}
            >
              <MoneyRow label={CHECKOUT.balanceLabel} value={CHECKOUT.balance} />
              <div style={{height: 1, background: 'rgba(20,26,38,0.07)', marginBlock: 2}} />
              <MoneyRow label={CHECKOUT.afterLabel} value={CHECKOUT.after} strong />
            </div>

            <div style={{marginTop: 11, display: 'flex', alignItems: 'center', gap: 6}}>
              <Icon name="lock" size={13} color={S.faint} sw={2} />
              <span style={{fontFamily: F.text, fontSize: 11.5, color: S.faint, lineHeight: 1.5}}>{CHECKOUT.note}</span>
            </div>
          </div>

          <div style={{marginTop: 14, padding: '12px 20px 16px', boxShadow: `inset 0 1px 0 ${S.border}`}}>
            {/* label and money as two runs, or the `$` drifts off the digits in the RTL line */}
            <Btn tone="brand" size="lg" full>
              <span>{CHECKOUT.pay.replace(/\s*\$[\d.,]+/, '').trim()}</span>
              <Money v={CHECKOUT.rows[2][1]} size={18} color={S.onBrand} />
            </Btn>
          </div>
        </div>

        {/* the OS home indicator sits on top of the sheet */}
        <div
          style={{
            position: 'absolute',
            bottom: 7,
            left: '50%',
            width: 132,
            height: 4.5,
            marginLeft: -66,
            borderRadius: 3,
            background: 'rgba(20,26,38,0.22)',
          }}
        />
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────────
 * 4 · order success
 * ────────────────────────────────────────────────────────────────────────────── */

/** [app: lib/orders/status.ts → STATUS_LABEL.processing] */
const STATUS_WORD = 'قيد التنفيذ';
/** [app: lib/orders/status.ts → stepsFor(processing · topup)] */
const STEPS: ReadonlyArray<{label: string; state: 'done' | 'current' | 'todo'}> = [
  {label: 'تم استلام طلبك وخصم المبلغ', state: 'done'},
  {label: 'جارٍ الشحن على حسابك', state: 'current'},
  {label: 'اكتمال الطلب', state: 'todo'},
];

const StepDot: React.FC<{state: 'done' | 'current' | 'todo'; p: number}> = ({state, p}) => {
  if (state === 'done') {
    return (
      <div
        style={{
          width: 17,
          height: 17,
          borderRadius: 9,
          background: S.success,
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          boxShadow: `0 4px 10px -5px ${S.success}`,
        }}
      >
        <Icon name="check" size={10} color="#FFFFFF" sw={3.4} />
      </div>
    );
  }
  if (state === 'current') {
    return (
      <div
        style={{
          width: 17,
          height: 17,
          borderRadius: 9,
          border: `2px solid ${S.brand}`,
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          background: S.solid1,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: S.brand,
            opacity: 0.5 + 0.45 * p,
            boxShadow: `0 0 8px ${S.brand}`,
          }}
        />
      </div>
    );
  }
  return <div style={{width: 17, height: 17, borderRadius: 9, border: `1.6px solid ${S.borderStrong}`, flex: 'none'}} />;
};

export const OrderSuccess: React.FC<ScreenProps> = ({dp, t}) => {
  const draw = tween(t, 8, 22, E.outQuart);
  const badge = tween(t, 3, 20, E.outExpo);
  const halo = tween(t, 12, 26, E.outQuart);
  const from = parseFloat(CHECKOUT.balance.replace(/[^\d.]/g, ''));
  const to = parseFloat(CHECKOUT.after.replace(/[^\d.]/g, ''));
  const money = lerp(from, to, tween(t, 20, 18, E.outQuart));
  const breath = 0.5 + 0.5 * Math.sin(t / 7);
  return (
    /* no tab bar: a paid order is a terminal state, nothing to navigate to */
    <AppCanvas dp={dp} chrome={false}>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column'}}>
        <SafeTop />
        <StatusBar />
        <StoreHeader balance={CHECKOUT.after} t={t} />

        <div style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingInline: 16}}>
          <div style={{paddingTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{position: 'relative', width: 100, height: 100, ...enter(t, 3, 10, 20, 0.06)}}>
              <div
                style={{
                  position: 'absolute',
                  inset: -16,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(30,158,106,0.22) 0%, rgba(30,158,106,0) 68%)',
                  opacity: halo,
                  transform: `scale(${lerp(0.86, 1.05, halo).toFixed(3)})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'linear-gradient(170deg, #E9F7F0 0%, #FFFFFF 100%)',
                  boxShadow: `inset 0 0 0 1px rgba(30,158,106,0.16), ${SH.e2}`,
                  transform: `scale(${lerp(0.9, 1, badge).toFixed(3)})`,
                }}
              />
              <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
                <DrawCheck size={62} progress={draw} stroke={3.2} />
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                textAlign: 'center',
                fontFamily: F.display,
                fontSize: 22,
                fontWeight: 600,
                color: S.ink,
                lineHeight: 1.5,
                maxWidth: 300,
                ...WORDS,
                ...enter(t, 8, 12, 20),
              }}
            >
              {SUCCESS.title}
            </div>
            <div style={{marginTop: 8, textAlign: 'center', ...enter(t, 13, 8, 18)}}>
              <span style={{fontFamily: F.text, fontSize: 13, color: S.muted, lineHeight: 1.5}}>
                {SUCCESS.order.split('#')[0]}
                <Num v={`#${SUCCESS.order.split('#')[1]}`} size={13} family="text" weight={600} color={S.muted} />
              </span>
            </div>
          </div>

          {/* the order, printed */}
          <div style={{width: '100%', marginTop: 18, ...enter(t, 16, 18, 22)}}>
            <Voucher
              stubAt="top"
              stubBg="#E4F4EC"
              stub={
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                  <span
                    style={{
                      fontFamily: F.display,
                      fontSize: 20,
                      fontWeight: 600,
                      color: S.brandText,
                      lineHeight: 1.35,
                      ...WORDS,
                    }}
                  >
                    {STATUS_WORD}
                  </span>
                  <Money v={CHECKOUT.rows[2][1]} size={22} />
                </div>
              }
              body={
                <>
                  <div style={{display: 'flex', gap: 11, alignItems: 'center'}}>
                    <ProductArt size={38} radius={12} badge={false} />
                    <div style={{minWidth: 0, flex: 1}}>
                      <div
                        style={{
                          fontFamily: F.text,
                          fontSize: 14,
                          fontWeight: 600,
                          color: S.ink,
                          lineHeight: 1.35,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {PRODUCT.name}
                      </div>
                      <div style={{marginTop: 2, fontFamily: F.text, fontSize: 11.5, color: S.muted, lineHeight: 1.4}}>
                        <span style={{unicodeBidi: 'plaintext'}}>{CHECKOUT.rows[0][1]}</span> · {PRODUCT.field}
                      </div>
                    </div>
                  </div>
                  <div style={{height: 1, background: S.border, marginBlock: 12}} />
                  {STEPS.map((s, i) => (
                    <div key={s.label} style={{display: 'flex', gap: 10}}>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: 17}}>
                        <StepDot state={s.state} p={breath} />
                        {i < STEPS.length - 1 && (
                          <div
                            style={{
                              width: 1.6,
                              flex: 1,
                              minHeight: 11,
                              background: i === 0 ? S.success : S.borderStrong,
                              opacity: i === 0 ? 0.42 : 1,
                            }}
                          />
                        )}
                      </div>
                      <span
                        style={{
                          flex: 1,
                          paddingBottom: i < STEPS.length - 1 ? 11 : 0,
                          fontFamily: F.text,
                          fontSize: 12.5,
                          fontWeight: s.state === 'current' ? 600 : 500,
                          color: s.state === 'current' ? S.brandText : s.state === 'done' ? S.ink : S.faint,
                          lineHeight: 1.45,
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </>
              }
            />
          </div>

          {/* delivery: the code, with its copy action */}
          <div style={{width: '100%', marginTop: 12, ...enter(t, 24, 16, 22)}}>
            <Card pad={13} radius={R.sm}>
              <div style={{fontFamily: F.text, fontSize: 12.5, fontWeight: 600, color: S.muted, lineHeight: 1.4}}>
                {SUCCESS.delivery}
              </div>
              <div style={{marginTop: 3, fontFamily: F.text, fontSize: 11, color: S.faint, lineHeight: 1.4}}>
                {SUCCESS.codeLabel}
              </div>
              <div
                style={{
                  marginTop: 7,
                  minHeight: 56,
                  borderRadius: 15,
                  background: S.solid2,
                  boxShadow: `inset 0 0 0 1.5px ${S.borderStrong}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingInline: 12,
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontFamily: F.display,
                    fontSize: 15.5,
                    fontWeight: 600,
                    color: S.ink,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {SUCCESS.code}
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: S.brandText,
                    background: S.brandSoft,
                    borderRadius: R.pill,
                    padding: '6px 10px',
                    flex: 'none',
                  }}
                >
                  <Icon name="copy" size={13} sw={2.1} />
                  <span style={{fontFamily: F.text, fontSize: 11.5, fontWeight: 600, lineHeight: 1.4}}>{SUCCESS.copy}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* what is left in the wallet */}
          <div
            style={{
              width: '100%',
              marginTop: 12,
              background: S.saffronSoft,
              borderRadius: R.sm,
              padding: '10px 14px',
              boxShadow: 'inset 0 0 0 1px rgba(242,169,59,0.36)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              ...enter(t, 29, 14, 20),
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: S.saffron,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                }}
              >
                <Icon name="wallet" size={14} color={S.saffronInk} sw={2.1} />
              </div>
              <span style={{fontFamily: F.text, fontSize: 12.5, fontWeight: 600, color: S.saffronText, lineHeight: 1.4}}>
                {SUCCESS.remaining}
              </span>
            </div>
            <Money v={`$${money.toFixed(2)}`} size={19} color={S.saffronText} />
          </div>

          <div style={{marginTop: 'auto', width: '100%', paddingTop: 16, paddingBottom: 26, ...enter(t, 34, 14, 20)}}>
            <Btn tone="brand" size="lg" full>
              {SUCCESS.done}
            </Btn>
          </div>
        </div>

        {/* the OS home indicator, since this screen carries no tab bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 7,
            left: '50%',
            width: 132,
            height: 4.5,
            marginLeft: -66,
            borderRadius: 3,
            background: 'rgba(20,26,38,0.22)',
          }}
        />
      </div>
    </AppCanvas>
  );
};

/** Parity with the kit probe in `DevScreens`. */
export const BuyerProbe: React.FC<ScreenProps> = ({dp}) => (
  <AppCanvas dp={dp} title="فحص">
    <Card style={{margin: 16}}>
      <Row justify="space-between">
        <span style={{fontFamily: F.text, fontSize: 13}}>{PRODUCT.name}</span>
        <Money v={CHECKOUT.balance} size={17} />
      </Row>
    </Card>
    <div style={{paddingInline: 16}}>
      <Divider />
    </div>
  </AppCanvas>
);

import React from 'react';
import {useDp} from './Phone';
import {Ico} from './Ico';
import {C, FONT, R, SP, T, shadow} from '../theme';

/**
 * A generic, honest app screen: the shape most products share (greeting, hero card,
 * quick actions, list rows, tab bar). Replace it with the client's real screen —
 * this exists so the template renders something believable on the first run.
 */
export type DemoCopy = {
  greeting: string;
  sub: string;
  heroTitle: string;
  heroMeta: string;
  heroAction: string;
  tiles: Array<{icon: string; label: string; tone: string}>;
  rows: Array<{icon: string; title: string; sub: string}>;
  tabs: string[];
};

export const DEMO: DemoCopy = {
  greeting: 'صَباح الخير',
  sub: 'جاهز لمتابعة تعلّمك اليوم؟',
  heroTitle: 'الفكرةُ الكبرى في هذا الفصل',
  heroMeta: 'صفحة 48 · جاهز',
  heroAction: 'تابع المذاكرة',
  tiles: [
    {icon: 'gridView', label: 'مخطط', tone: C.plum},
    {icon: 'quiz', label: 'اختبار', tone: C.coral},
    {icon: 'summarize', label: 'تلخيص', tone: C.amber},
    {icon: 'forum', label: 'محادثة', tone: C.emerald},
  ],
  rows: [
    {icon: 'autoAwesome', title: 'المساعد الذكي', sub: 'اسأل، ولخّص، واختبر فورًا'},
    {icon: 'calendarMonth', title: 'خطة المراجعة', sub: 'مهامُّ يومية على مقاسك'},
  ],
  tabs: ['الرئيسية', 'مكتبتي', 'المخطط', 'حسابي'],
};

export const DemoUI: React.FC<{copy?: DemoCopy}> = ({copy = DEMO}) => {
  const dp = useDp();
  const c = copy;

  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        width: 412 * dp,
        height: 915 * dp,
        background: C.paper,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT.tajawal,
        letterSpacing: 0,
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div style={{padding: `${SP.screen * dp}px`, paddingTop: 52 * dp, display: 'flex', alignItems: 'flex-start', gap: SP.xs * dp}}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2 * dp}}>
          <span style={{fontSize: T.displayMedium.size * dp, lineHeight: 1.16, fontWeight: 800, color: C.ink}}>
            {c.greeting}
          </span>
          <span style={{fontSize: T.titleMedium.size * dp, lineHeight: 1.4, fontWeight: 500, color: C.inkSoft}}>{c.sub}</span>
        </div>
        <div style={{display: 'flex', gap: 8 * dp, alignItems: 'center'}}>
          <div style={chip(dp, C.emeraldSoft)}>
            <span style={{fontSize: 18 * dp, fontWeight: 800, color: C.emeraldDeep}}>E</span>
          </div>
          <div style={chip(dp, C.paperSunken)}>
            <Ico name="notificationsOutline" size={22 * dp} color={C.inkSoft} />
          </div>
          <div style={chip(dp, C.ink)}>
            <Ico name="autoAwesome" size={22 * dp} color={C.parchment} />
          </div>
        </div>
      </div>

      {/* hero card */}
      <div style={{padding: `0 ${SP.screen * dp}px`, marginTop: SP.xs * dp}}>
        <div
          style={{
            borderRadius: R.lg * dp,
            padding: 18 * dp,
            background: `linear-gradient(150deg, ${C.emerald} 0%, ${C.emeraldDeep} 58%, #114E47 100%)`,
            boxShadow: shadow.hero,
            display: 'flex',
            flexDirection: 'column',
            gap: 10 * dp,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12 * dp}}>
            <div
              style={{
                width: 46 * dp,
                height: 46 * dp,
                borderRadius: R.sm * dp,
                background: 'rgba(255,255,255,0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ico name="descriptionOutline" size={26 * dp} color="#FFFFFF" />
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2 * dp}}>
              <span style={{fontSize: T.titleLarge.size * dp, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3}}>
                {c.heroTitle}
              </span>
              <span style={{fontSize: T.bodySmall.size * dp, fontWeight: 500, color: 'rgba(255,255,255,0.72)'}}>
                {c.heroMeta}
              </span>
            </div>
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-start'}}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6 * dp,
                padding: `${7 * dp}px ${14 * dp}px`,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.92)',
              }}
            >
              <span style={{fontSize: T.labelLarge.size * dp, fontWeight: 700, color: C.emeraldDeep}}>{c.heroAction}</span>
              <Ico name="arrowBack" size={16 * dp} color={C.emeraldDeep} />
            </div>
          </div>
        </div>
      </div>

      {/* quick tiles */}
      <div style={{display: 'flex', gap: 10 * dp, padding: `${SP.md * dp}px ${SP.screen * dp}px`}}>
        {c.tiles.map((t) => (
          <div key={t.label} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * dp}}>
            <div
              style={{
                width: 46 * dp,
                height: 46 * dp,
                borderRadius: R.md * dp,
                background: C.paperRaised,
                border: `${1 * dp}px solid ${C.hairline}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: shadow.card,
              }}
            >
              <Ico name={t.icon} size={24 * dp} color={t.tone} />
            </div>
            <span style={{fontSize: T.labelSmall.size * dp, fontWeight: 500, color: C.inkSoft}}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* rows */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 10 * dp, padding: `0 ${SP.screen * dp}px`}}>
        {c.rows.map((r) => (
          <div
            key={r.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12 * dp,
              padding: `${12 * dp}px ${14 * dp}px`,
              borderRadius: R.md * dp,
              background: C.paperRaised,
              border: `${1 * dp}px solid ${C.hairline}`,
              boxShadow: shadow.card,
            }}
          >
            <div
              style={{
                width: 40 * dp,
                height: 40 * dp,
                borderRadius: R.sm * dp,
                background: C.emeraldSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ico name={r.icon} size={22 * dp} color={C.emeraldDeep} />
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2 * dp}}>
              <span style={{fontSize: T.titleMedium.size * dp, fontWeight: 700, color: C.ink, lineHeight: 1.35}}>{r.title}</span>
              <span style={{fontSize: T.bodySmall.size * dp, fontWeight: 400, color: C.inkFaint}}>{r.sub}</span>
            </div>
            <Ico name="chevronLeft" size={18 * dp} color={C.inkFaint} />
          </div>
        ))}
      </div>


      {/* weekly progress — the honest "there is depth here" block */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px`}}>
        <div
          style={{
            borderRadius: R.md * dp,
            padding: `${14 * dp}px ${16 * dp}px`,
            background: C.paperSunken,
            display: 'flex',
            flexDirection: 'column',
            gap: 10 * dp,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{fontSize: T.labelMedium.size * dp, fontWeight: 700, color: C.inkSoft}}>تقدّم هذا الأسبوع</span>
            <span style={{fontSize: T.labelMedium.size * dp, fontWeight: 700, color: C.emeraldDeep}}>٣ من ٥</span>
          </div>
          <div style={{height: 8 * dp, borderRadius: 999, background: 'rgba(26,42,54,0.10)', overflow: 'hidden'}}>
            <div style={{width: '60%', height: '100%', borderRadius: 999, background: C.emerald}} />
          </div>
        </div>
      </div>

      <div style={{flex: 1}} />

      {/* tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: `${10 * dp}px ${SP.sm * dp}px ${18 * dp}px`,
          background: C.paperRaised,
          borderTop: `${1 * dp}px solid ${C.hairline}`,
        }}
      >
        {c.tabs.map((t, i) => {
          const active = i === 0;
          return (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6 * dp,
                padding: `${6 * dp}px ${10 * dp}px`,
                borderRadius: 999,
                background: active ? C.emeraldSoft : 'transparent',
              }}
            >
              <Ico
                name={['home', 'menuBook', 'gridView', 'personOutline'][i] ?? 'home'}
                size={20 * dp}
                color={active ? C.emeraldDeep : C.inkFaint}
              />
              <span
                style={{
                  fontSize: T.labelMedium.size * dp,
                  fontWeight: active ? 700 : 500,
                  color: active ? C.emeraldDeep : C.inkFaint,
                }}
              >
                {t}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const chip = (dp: number, bg: string): React.CSSProperties => ({
  width: 38 * dp,
  height: 38 * dp,
  borderRadius: 999,
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

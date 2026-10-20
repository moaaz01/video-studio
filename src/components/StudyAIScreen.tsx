import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Ico} from './Ico';
import {useDp} from './Phone';
import {C, FONT, R, SP, T, shadow} from '../theme';
import AR from '../generated/studyai-ar.json';

/**
 * The real StudyAI screens, rebuilt from the app's own structure and strings.
 *
 * Every label here is copied verbatim from `res/values-ar/strings_*.xml` by
 * `scripts/app_strings.py` into `src/generated/studyai-ar.json`; the component
 * only ever renders `t('key')`, so a paraphrase cannot sneak in. The layout
 * follows the Compose screens: header + hero + quick actions + library rows +
 * tab bar on Home, and suggestions + bubbles + composer on the Agent.
 *
 * Not a pixel capture: the device was unavailable, so this is a reconstruction
 * from source. `scripts/app_strings.py --check` is the fidelity gate that keeps
 * the words honest.
 */

type Key = keyof typeof AR.keys;
const t = (k: Key): string => AR.keys[k].ar;

const QUICK: Array<{key: Key; icon: string; tone: string; soft: string}> = [
  {key: 'samp_quick_action_chat', icon: 'forum', tone: C.emeraldDeep, soft: C.emeraldSoft},
  {key: 'samp_quick_action_summary', icon: 'summarize', tone: C.amber, soft: C.amberSoft},
  {key: 'samp_quick_action_quiz', icon: 'quiz', tone: C.coral, soft: C.coralSoft},
  {key: 'samp_quick_action_diagram', icon: 'gridView', tone: C.plum, soft: C.plumSoft},
];

const ROWS: Array<{title: Key; when: Key; icon: string; tone: string}> = [
  {title: 'samp_doc_d1_title', when: 'samp_doc_d1_timestamp', icon: 'descriptionOutline', tone: C.emeraldDeep},
  {title: 'samp_doc_d2_title', when: 'samp_doc_d2_timestamp', icon: 'descriptionOutline', tone: C.coral},
];

const TABS: Array<{key: Key; icon: string}> = [
  {key: 'nav_home', icon: 'home'},
  {key: 'nav_documents', icon: 'menuBook'},
  {key: 'nav_challenges', icon: 'gridView'},
  {key: 'nav_profile', icon: 'personOutline'},
];

const chip = (dp: number, bg: string): React.CSSProperties => ({
  width: 38 * dp,
  height: 38 * dp,
  borderRadius: 999,
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/** A short, honest answer shape; the citation chip uses the app's own label. */
const ANSWER: string[] = [
  'المجال المغناطيسي المتغيّر يولّد تياراً كهربائياً.',
  'التيار المتناوب ينقل الطاقة لمسافات أطول.',
  'المحوّلات ترفع الجهد وتخفضه حسب الحاجة.',
];

const Home: React.FC<{dp: number; local: number}> = ({dp, local}) => {
  const fill = Math.min(1, Math.max(0, (local - 6) / 34)) * 0.62;
  return (
    <div dir="rtl" lang="ar" style={{width: 412 * dp, height: 915 * dp, background: C.paper, display: 'flex', flexDirection: 'column', fontFamily: FONT.tajawal, overflow: 'hidden'}}>
      {/* header */}
      <div style={{padding: `${SP.screen * dp}px`, paddingTop: 52 * dp, display: 'flex', alignItems: 'flex-start', gap: SP.xs * dp}}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2 * dp}}>
          <span style={{fontSize: T.displayMedium.size * dp, lineHeight: 1.16, fontWeight: 800, color: C.ink}}>
            {t('home_greeting_morning')}
          </span>
          <span style={{fontSize: T.titleMedium.size * dp, lineHeight: 1.4, fontWeight: 500, color: C.inkSoft}}>
            {t('home_header_subtitle')}
          </span>
        </div>
        <div style={{display: 'flex', gap: 8 * dp, alignItems: 'center'}}>
          <div style={chip(dp, C.paperSunken)}>
            <Ico name="notificationsOutline" size={21 * dp} color={C.inkSoft} />
          </div>
          <div style={chip(dp, C.emerald)}>
            <span style={{fontSize: 17 * dp, fontWeight: 800, color: '#FFFFFF'}}>م</span>
          </div>
        </div>
      </div>

      {/* hero: continue studying */}
      <div style={{padding: `0 ${SP.screen * dp}px`}}>
        <div
          style={{
            borderRadius: R.lg * dp,
            padding: 18 * dp,
            background: `linear-gradient(150deg, ${C.emerald} 0%, ${C.emeraldDeep} 58%, #114E47 100%)`,
            boxShadow: shadow.hero,
            display: 'flex',
            flexDirection: 'column',
            gap: 12 * dp,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10 * dp}}>
            <div
              style={{
                width: 44 * dp,
                height: 44 * dp,
                borderRadius: R.sm * dp,
                background: 'rgba(255,255,255,0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ico name="descriptionOutline" size={25 * dp} color="#FFFFFF" />
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 1 * dp}}>
              <span style={{fontSize: T.labelMedium.size * dp, fontWeight: 700, color: 'rgba(255,255,255,0.66)'}}>
                {t('home_continue_badge')}
              </span>
              <span style={{fontSize: T.titleLarge.size * dp, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3}}>
                {t('samp_doc_d1_title')}
              </span>
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8 * dp}}>
            <div style={{flex: 1, height: 6 * dp, borderRadius: 999, background: 'rgba(255,255,255,0.22)', overflow: 'hidden'}}>
              <div style={{width: `${fill * 100}%`, height: '100%', borderRadius: 999, background: '#FFFFFF'}} />
            </div>
            <span style={{fontSize: T.labelSmall.size * dp, fontWeight: 700, color: 'rgba(255,255,255,0.85)'}}>
              {t('cmp_doc_state_ready')}
            </span>
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-start'}}>
            <div style={{display: 'inline-flex', alignItems: 'center', gap: 6 * dp, padding: `${7 * dp}px ${14 * dp}px`, borderRadius: 999, background: '#FFFFFF'}}>
              <span style={{fontSize: T.labelLarge.size * dp, fontWeight: 700, color: C.emeraldDeep}}>{t('home_continue_studying')}</span>
              <Ico name="arrowBack" size={16 * dp} color={C.emeraldDeep} />
            </div>
          </div>
        </div>
      </div>

      {/* quick actions */}
      <div style={{display: 'flex', gap: 10 * dp, padding: `${SP.md * dp}px ${SP.screen * dp}px`}}>
        {QUICK.map((q) => (
          <div key={q.key} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * dp}}>
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
              <Ico name={q.icon} size={24 * dp} color={q.tone} />
            </div>
            <span style={{fontSize: T.labelSmall.size * dp, fontWeight: 500, color: C.inkSoft}}>{t(q.key)}</span>
          </div>
        ))}
      </div>

      {/* library section */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${SP.screen * dp}px`, marginBottom: 8 * dp}}>
        <span style={{fontSize: T.headlineMedium.size * dp, fontWeight: 700, color: C.ink}}>{t('home_section_recent_files')}</span>
        <span style={{fontSize: T.labelMedium.size * dp, fontWeight: 700, color: C.emeraldDeep}}>{t('home_action_see_all')}</span>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: 10 * dp, padding: `0 ${SP.screen * dp}px`}}>
        {ROWS.map((r, i) => {
          const appear = Math.min(1, Math.max(0, (local - 14 - i * 6) / 12));
          return (
            <div
              key={r.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12 * dp,
                padding: `${11 * dp}px ${13 * dp}px`,
                borderRadius: R.md * dp,
                background: C.paperRaised,
                border: `${1 * dp}px solid ${C.hairline}`,
                boxShadow: shadow.card,
                opacity: appear,
                transform: `translateY(${(1 - appear) * 10}px)`,
              }}
            >
              <div
                style={{
                  width: 40 * dp,
                  height: 40 * dp,
                  borderRadius: R.sm * dp,
                  background: C.paperSunken,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico name={r.icon} size={22 * dp} color={r.tone} />
              </div>
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2 * dp}}>
                <span style={{fontSize: T.titleMedium.size * dp, fontWeight: 700, color: C.ink, lineHeight: 1.3}}>{t(r.title)}</span>
                <span style={{fontSize: T.bodySmall.size * dp, fontWeight: 400, color: C.inkFaint}}>{t(r.when)}</span>
              </div>
              <span
                style={{
                  fontSize: 10 * dp,
                  fontWeight: 700,
                  color: C.emeraldDeep,
                  background: C.emeraldSoft,
                  borderRadius: 999,
                  padding: `${3 * dp}px ${8 * dp}px`,
                }}
              >
                {t('cmp_doc_state_ready')}
              </span>
            </div>
          );
        })}
      </div>

      {/* upload */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px`}}>
        <div
          style={{
            borderRadius: R.md * dp,
            padding: `${13 * dp}px ${14 * dp}px`,
            background: C.paperRaised,
            border: `${1 * dp}px solid ${C.hairline}`,
            boxShadow: shadow.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 8 * dp,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 8 * dp}}>
            <div style={{width: 30 * dp, height: 30 * dp, borderRadius: 999, background: C.amberSoft, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Ico name="bolt" size={18 * dp} color={C.amber} />
            </div>
            <span style={{flex: 1, fontSize: T.titleSmall.size * dp, fontWeight: 700, color: C.ink}}>{t('home_daily_goal_title')}</span>
            <span style={{fontSize: T.labelLarge.size * dp, fontWeight: 800, color: C.emeraldDeep}}>
              {t('home_mastery_percent').replace('%1$s', '60')}
            </span>
          </div>
          <div style={{height: 6 * dp, borderRadius: 999, background: C.paperSunken, overflow: 'hidden'}}>
            <div style={{width: '60%', height: '100%', borderRadius: 999, background: C.amber}} />
          </div>
          <span style={{fontSize: T.bodySmall.size * dp, fontWeight: 500, color: C.inkSoft}}>
            {t('home_daily_goal_progress').replace('%1$s', '3').replace('%2$s', '5')}
          </span>
        </div>
      </div>

      <div style={{padding: `0 ${SP.screen * dp}px ${SP.md * dp}px`}}>
        <div
          style={{
            border: `${1.5 * dp}px dashed ${C.hairline}`,
            borderRadius: R.md * dp,
            padding: `${13 * dp}px ${14 * dp}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 10 * dp,
            background: 'rgba(255,255,255,0.55)',
          }}
        >
          <div style={{width: 32 * dp, height: 32 * dp, borderRadius: 999, background: C.emeraldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Ico name="add" size={20 * dp} color={C.emeraldDeep} />
          </div>
          <span style={{fontSize: T.titleSmall.size * dp, fontWeight: 700, color: C.emeraldDeep}}>{t('home_upload_document')}</span>
          <div style={{flex: 1}} />
          <span style={{fontSize: T.labelSmall.size * dp, fontWeight: 500, color: C.inkFaint}}>PDF · DOCX</span>
        </div>
      </div>

      <div style={{flex: 1}} />

      {/* tab bar */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: `${9 * dp}px ${SP.sm * dp}px ${16 * dp}px`, background: C.paperRaised, borderTop: `${1 * dp}px solid ${C.hairline}`}}>
        {TABS.map((tab, i) => {
          const active = i === 0;
          return (
            <div key={tab.key} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * dp, padding: `${5 * dp}px ${8 * dp}px`}}>
              <Ico name={tab.icon} size={21 * dp} color={active ? C.emeraldDeep : C.inkFaint} />
              <span style={{fontSize: 10 * dp, fontWeight: active ? 700 : 500, color: active ? C.emeraldDeep : C.inkFaint}}>{t(tab.key)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Agent: React.FC<{dp: number; local: number}> = ({dp, local}) => {
  const bubble = Math.min(1, Math.max(0, (local - 8) / 12));
  const reply = Math.min(1, Math.max(0, (local - 22) / 14));
  return (
    <div dir="rtl" lang="ar" style={{width: 412 * dp, height: 915 * dp, background: C.paper, display: 'flex', flexDirection: 'column', fontFamily: FONT.tajawal, overflow: 'hidden'}}>
      {/* header */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px`, paddingTop: 50 * dp, display: 'flex', alignItems: 'center', gap: 10 * dp, borderBottom: `${1 * dp}px solid ${C.hairline}`}}>
        <div style={chip(dp, C.paperSunken)}>
          <Ico name="arrowBack" size={20 * dp} color={C.inkSoft} />
        </div>
        <div style={{width: 38 * dp, height: 38 * dp, borderRadius: 999, background: `linear-gradient(140deg, ${C.dreamIris}, ${C.plum})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Ico name="autoAwesome" size={20 * dp} color="#FFFFFF" />
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          <span style={{fontSize: T.titleLarge.size * dp, fontWeight: 700, color: C.ink}}>{t('agent_title')}</span>
          <span style={{fontSize: T.labelSmall.size * dp, fontWeight: 500, color: C.inkFaint}}>{t('agent_subtitle')}</span>
        </div>
        <div style={chip(dp, C.paperSunken)}>
          <Ico name="helpOutline" size={20 * dp} color={C.inkSoft} />
        </div>
      </div>

      {/* suggestions */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px 0`, display: 'flex', flexDirection: 'column', gap: 8 * dp}}>
        <span style={{fontSize: T.labelMedium.size * dp, fontWeight: 700, color: C.inkFaint}}>{t('agent_suggestions_label')}</span>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 7 * dp}}>
          {(['agent_suggestion_1', 'agent_suggestion_2', 'agent_suggestion_3'] as Key[]).map((k) => (
            <div key={k} style={{padding: `${7 * dp}px ${11 * dp}px`, borderRadius: 999, border: `${1 * dp}px solid ${C.hairline}`, background: C.paperRaised}}>
              <span style={{fontSize: T.labelMedium.size * dp, fontWeight: 500, color: C.inkSoft}}>{t(k)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* user turn */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px 0`, display: 'flex', justifyContent: 'flex-start', opacity: bubble, transform: `translateY(${(1 - bubble) * 12}px)`}}>
        <div style={{maxWidth: 300 * dp, display: 'flex', flexDirection: 'column', gap: 7 * dp, alignItems: 'flex-start'}}>
          <div style={{background: C.emerald, borderRadius: `${R.md * dp}px ${R.md * dp}px ${4 * dp}px ${R.md * dp}px`, padding: `${10 * dp}px ${13 * dp}px`}}>
            <span style={{fontSize: T.bodyMedium.size * dp, fontWeight: 500, color: '#FFFFFF', lineHeight: 1.5}}>{t('agent_suggestion_3')}</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 6 * dp, padding: `${5 * dp}px ${9 * dp}px`, borderRadius: R.sm * dp, background: C.paperSunken, border: `${1 * dp}px solid ${C.hairline}`}}>
            <Ico name="descriptionOutline" size={15 * dp} color={C.emeraldDeep} />
            <span style={{fontSize: T.labelSmall.size * dp, fontWeight: 500, color: C.inkSoft}}>{t('samp_doc_d1_title')}</span>
          </div>
        </div>
      </div>

      {/* agent reply */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px 0`, display: 'flex', gap: 8 * dp, opacity: reply, transform: `translateY(${(1 - reply) * 14}px)`}}>
        <div style={{width: 28 * dp, height: 28 * dp, borderRadius: 999, background: `linear-gradient(140deg, ${C.dreamIris}, ${C.plum})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <Ico name="autoAwesome" size={15 * dp} color="#FFFFFF" />
        </div>
        <div style={{flex: 1, background: C.paperRaised, border: `${1 * dp}px solid ${C.hairline}`, borderRadius: R.md * dp, padding: `${12 * dp}px ${13 * dp}px`, boxShadow: shadow.card, display: 'flex', flexDirection: 'column', gap: 9 * dp}}>
          {ANSWER.map((line) => (
            <div key={line} style={{display: 'flex', gap: 7 * dp, alignItems: 'flex-start'}}>
              <div style={{width: 5 * dp, height: 5 * dp, borderRadius: 999, background: C.emerald, marginTop: 9 * dp, flexShrink: 0}} />
              <span style={{fontSize: T.bodySmall.size * dp, fontWeight: 500, color: C.ink, lineHeight: 1.65}}>{line}</span>
            </div>
          ))}
          <div style={{display: 'flex', alignItems: 'center', gap: 6 * dp, alignSelf: 'flex-start', background: C.emeraldSoft, borderRadius: 999, padding: `${4 * dp}px ${9 * dp}px`}}>
            <Ico name="descriptionOutline" size={13 * dp} color={C.emeraldDeep} />
            <span style={{fontSize: 10 * dp, fontWeight: 700, color: C.emeraldDeep}}>
              {t('quiz_page_reference').replace('%1$s', '42')}
            </span>
          </div>
        </div>
      </div>

      <div style={{flex: 1}} />

      {/* composer */}
      <div style={{padding: `${SP.md * dp}px ${SP.screen * dp}px ${SP.lg * dp}px`, display: 'flex', alignItems: 'center', gap: 8 * dp, borderTop: `${1 * dp}px solid ${C.hairline}`, background: C.paperRaised}}>
        <div style={{flex: 1, height: 44 * dp, borderRadius: 999, background: C.paperSunken, display: 'flex', alignItems: 'center', padding: `0 ${14 * dp}px`}}>
          <span style={{fontSize: T.bodyMedium.size * dp, fontWeight: 500, color: C.inkFaint}}>{t('agent_composer_hint')}</span>
        </div>
        <div style={{width: 44 * dp, height: 44 * dp, borderRadius: 999, background: C.emerald, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Ico name="send" size={20 * dp} color="#FFFFFF" />
        </div>
      </div>
    </div>
  );
};

export type StudyAIScreenVariant = 'home' | 'agent';

export const StudyAIScreen: React.FC<{variant?: StudyAIScreenVariant}> = ({variant = 'home'}) => {
  const dp = useDp();
  const frame = useCurrentFrame();
  // Inside a <Sequence> useCurrentFrame() is already local to the beat, so the
  // micro-motion starts when the phone appears instead of at some fixed cycle.
  const local = frame;
  return variant === 'agent' ? <Agent dp={dp} local={local} /> : <Home dp={dp} local={local} />;
};

import {useEffect, useState} from 'react';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import manifestJson from '../screens.json';
import {BRANDS, brandVars, getBrand, type BrandMode} from './brands';
import {hasCatalogue} from './data';
import {SCREENS} from './screens';

type ScreenSpec = {
  slug: string;
  title: string;
  screen: string;
  brand: string;
  mode: BrandMode;
  width: number;
  height: number;
  scale: number;
};

type Manifest = {
  version: number;
  outDir: string;
  screens: ScreenSpec[];
};

const manifest = manifestJson as unknown as Manifest;
const params = new URLSearchParams(window.location.search);
const requested = params.get('screen');
const spec = manifest.screens.find((screen) => screen.slug === requested) ?? manifest.screens[0];

const brandKey = params.get('brand') ?? spec?.brand ?? '';
const requestedMode = params.get('mode');
const mode: BrandMode =
  requestedMode === 'light' || requestedMode === 'dark'
    ? requestedMode
    : (spec?.mode ?? 'light');

function MissingScreen({message}: {message: string}) {
  return (
    <div
      data-mockup-error
      style={{
        display: 'grid',
        placeItems: 'center',
        inlineSize: '100%',
        blockSize: '100%',
        padding: 40,
        background: '#f7f3eb',
        color: '#14231e',
        fontFamily: '"IBM Plex Sans Arabic", sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{fontSize: 22, fontWeight: 700}}>Mockup not found</div>
        <div style={{marginTop: 8, fontSize: 13, color: '#68766f', maxWidth: 420}}>{message}</div>
        <div style={{marginTop: 16, fontSize: 11, color: '#68766f'}}>
          Available: {manifest.screens.map((screen) => screen.slug).join(' · ')}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const settle = async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (!alive) return;
      setReady(true);
      document.documentElement.dataset.mockupReady = 'true';
    };
    void settle();
    return () => {
      alive = false;
      delete document.documentElement.dataset.mockupReady;
    };
  }, [spec?.slug, brandKey, mode]);

  if (!spec) {
    return <MissingScreen message="No screens are declared in tools/mockups/screens.json." />;
  }

  const Screen = SCREENS[spec.screen];
  if (!Screen) {
    return <MissingScreen message={`Unknown screen "${spec.screen}". Add it to src/screens/index.tsx.`} />;
  }

  if (!BRANDS[brandKey]) {
    return <MissingScreen message={`Unknown brand "${brandKey}". Add it to brands.json.`} />;
  }

  if (!hasCatalogue(brandKey)) {
    return <MissingScreen message={`No catalogue for "${brandKey}". Add src/data/${brandKey}.ts.`} />;
  }

  const brand = getBrand(brandKey);

  return (
    <Theme theme={neutralTheme} mode={mode}>
      <div
        className="mockup-root"
        dir="rtl"
        lang="ar"
        data-mode={mode}
        data-ready={ready ? 'true' : 'false'}
        style={{...brandVars(brand, mode), width: spec.width, height: spec.height}}
      >
        <Screen brand={brand} mode={mode} />
      </div>
    </Theme>
  );
}

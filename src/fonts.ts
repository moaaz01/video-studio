/**
 * Self-hosted fonts. Loaded from `public/fonts` through `@remotion/fonts`, which
 * registers a `delayRender` per face — so a render can never start before the
 * Arabic faces are ready (the classic "silent fallback to a system font" bug).
 *
 * Tajawal  -> the app's UI face (ui/theme/Type.kt)
 * Amiri / NotoNaskhArabic -> the faces the backend embeds in generated PDFs (INV-4)
 */
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {FONT} from './theme';

const TAJAWAL: Array<[string, string]> = [
  ['300', 'Tajawal-Light.ttf'],
  ['400', 'Tajawal-Regular.ttf'],
  ['500', 'Tajawal-Medium.ttf'],
  ['700', 'Tajawal-Bold.ttf'],
  ['800', 'Tajawal-ExtraBold.ttf'],
  ['900', 'Tajawal-Black.ttf'],
];

export const fontsReady: Promise<unknown>[] = [];

for (const [weight, file] of TAJAWAL) {
  fontsReady.push(
    loadFont({
      family: FONT.tajawal,
      url: staticFile(`fonts/${file}`),
      weight,
      format: 'truetype',
    }),
  );
}

fontsReady.push(
  loadFont({family: FONT.amiri, url: staticFile('fonts/Amiri-Regular.ttf'), weight: '400', format: 'truetype'}),
  loadFont({family: FONT.amiri, url: staticFile('fonts/Amiri-Bold.ttf'), weight: '700', format: 'truetype'}),
  loadFont({family: FONT.naskh, url: staticFile('fonts/NotoNaskhArabic.ttf'), weight: '400', format: 'truetype'}),
);

export const ff = FONT.tajawal;

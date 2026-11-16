# Mockups: the Astryx UI factory

The studio's weakest pixel was never the grade or the type — it was the interface.
`DemoUI.tsx` is hand-built and reads like a template. **Astryx** is Meta's open
design system (React 19 + StyleX, MIT, 148 components, real RTL, seven themes),
and it is the right tool for a *designed* screen. It is the wrong tool for a film:
its components are interactive and CSS-driven, not frame-driven.

So the integration is a boundary, not a dependency:

```
tools/mockups/          a separate Vite app (never imported by src/ or Remotion)
  brands.json           per-client tokens, light + dark
  screens.json          which screen, which brand, which viewport
  src/screens/*.tsx     pure React screens (brand + mode in, pixels out)
  scripts/capture.mjs   Edge/Chromium, exact viewport, 2×, fonts settled
        │
        ▼
public/mockups/<brand>/<screen>.png   +  manifest.json (size, bytes, sha256)
        │
        ▼
src/scenes/*.tsx  →  <Img src={staticFile('mockups/waha/storefront.png')} />
```

## What it is, and what it is not

| It is | It is not |
|---|---|
| A factory for **designed** screens when the client has no real UI | A replacement for the client's real screens |
| A separate app with its own dependency tree | A dependency of `src/` or the Remotion bundle |
| Real browser pixels at 2× (Arabic shaping, fonts, overflow) | A video renderer; motion stays in the film engine |
| A token contract (`brands.json`) that every screen reads | A license to invent products, prices or testimonials |

**Order of truth:** the client's real app (`studio.py ui --dir <app>` + REA) is
first. Screenshots the client sent are second. This factory is third — for a
concept, a pre-launch store, or a screen the client has not built yet. A mockup
is never presented as "the real app" when it is not.

## Commands

```bash
python scripts/studio.py mockups list
python scripts/studio.py mockups capture
python scripts/studio.py mockups capture --only waha-storefront --no-build
python scripts/studio.py mockups verify --strict
python scripts/studio.py mockups doctor
```

`capture` builds the app, serves `dist/` from a tiny static server (no dev server,
no HMR, no port race), and writes one PNG per screen. On WSL it hands the job to
`cmd.exe` because Edge lives on Windows; on Windows it runs Node directly.

## Add a client brand

One entry in `tools/mockups/brands.json`. Both modes are required:

```json
"acme": {
  "slug": "acme",
  "name": "أكمي",
  "tagline": "جملة قصيرة",
  "monogram": "أ",
  "currency": "$",
  "light": {
    "accent": "#0F7A5E", "accentDeep": "#0A5A45", "accentSoft": "#DDF1EA",
    "accentInk": "#F4FBF8", "paper": "#F7F3EB", "surface": "#FFFFFF",
    "sunken": "#EFE9DE", "ink": "#14231E", "muted": "#68766F",
    "border": "#E5DDD0", "borderStrong": "#D2C7B6",
    "gold": "#C98A2E", "goldSoft": "#F7E9CE", "rose": "#C4553F",
    "shadow": "26,35,30"
  },
  "dark": { "...": "same keys, dark values" }
}
```

`brandVars()` maps these onto Astryx's semantic roles (`--color-accent`,
`--color-background-card`, `--color-text-primary`, `--color-border`, radii, font)
plus `--brand-*` names for decoration. A screen never hard-codes a client colour;
it reads the tokens, so the same screen can be captured for every store.

Then add `tools/mockups/src/data/acme.ts` exporting a `Catalogue` (services,
categories, orders, KPIs, revenue, top services) and register it in
`src/data/index.ts`:

```ts
export const CATALOGUES: Record<string, Catalogue> = {
  waha: WAHA,
  acme: ACME,
};
```

Finally add a `screens.json` entry with `"brand": "acme"` and capture. A brand
key must exist in **both** `brands.json` (tokens) and `src/data/index.ts`
(content); the app refuses to render a brand without a catalogue.

## Add a screen

1. Write `tools/mockups/src/screens/MyScreen.tsx` as a pure component:
   `({brand, mode}: ScreenProps) => JSX`. No fetch, no router, no timers, no
   `Math.random()`. State is allowed for a selected tab/package, but the capture
   always sees the initial state.
2. Register it in `src/screens/index.tsx` (`SCREENS.myScreen = MyScreen`).
3. Add an entry to `screens.json` with `screen`, `brand`, `mode`, `width`,
   `height`, `scale: 2`.
4. `npm run typecheck` in `tools/mockups`, then `capture`, then `verify --strict`.

Rules that are defects, not taste:

- **Logical CSS only**: `inset-inline-*`, `margin-inline-*`, `border-start-*`,
  `text-align: start|end`. No `left`, `right`, `margin-left`, `padding-right`.
  The test `test_no_physical_rtl_properties` enforces this.
- **Arabic letter-spacing is 0**, no `text-transform`.
- **Western digits only** (`123`, never `١٢٣`). Use `money()` from `brands.ts`:
  it wraps the price in LRI/PDI so `1,200 $` is not reordered to `$ 1,200`.
- **No fixture fact in a client film.** Replace `src/data/waha.ts` (or add a client catalogue) before capture.

## The capture contract

- The viewport is exact CSS pixels (`412×915`, `1440×900`, …), `deviceScaleFactor: 2`.
- The app sets `data-mockup-ready="true"` only after `document.fonts.ready` and two
  animation frames. The capture waits for it.
- A missing screen or brand renders `[data-mockup-error]`; capture fails loudly
  instead of writing a blank frame.
- The PNG's IHDR is checked against `width × scale` / `height × scale`.
- `manifest.json` records `path`, `cssWidth`, `cssHeight`, `width`, `height`,
  `scale`, `bytes` and `sha256`. `verify` re-reads the file and re-hashes it.
- A flat frame (one colour) fails `verify`.

## Using a capture in a film

```tsx
import {Img, staticFile} from 'remotion';

<Img src={staticFile('mockups/acme/storefront.png')} />
```

The manifest is also readable from Python (`public/mockups/manifest.json`) if a
scene wants the path/hash. Keep the screen still and let the film engine do the
push, the card entrance and the cut; do not animate the screenshot inside the
factory.

## Quality gates

1. `python scripts/studio.py mockups verify --strict` — dimensions, hashes,
   blank frames, stale captures.
2. Look at the PNG at **1:1**, not on a contact sheet. Arabic is unjudgeable in a
   downscaled preview; a clipped descender or a reordered price is invisible at
   20 %.
3. `python scripts/studio.py safe <still> --preset reels` for a 9:16 screen.
4. Contrast and type size at the film's scale: a 9 px label is fine at 2× on a
   phone, but if the film shows the screen at 60 % width it is 5.4 px. Raise the
   token, not the screenshot.
5. `python -m unittest tests.test_mockups -v` — manifest, tokens, RTL, digits.

## Fixtures vs facts

`waha` (واحة) is **fictional**. Its services, prices, ratings, customer names and
order numbers live in `src/data/waha.ts` and exist only to exercise real layout:
long Arabic titles, a unit price, a discount, a rating, a delivery estimate. They
are not a client catalogue and must never be shipped as one. When a real store
arrives, add `src/data/<client>.ts` and keep the layout.

## Astryx version and upgrade policy

- `@astryxdesign/core` and `@astryxdesign/theme-neutral` are pinned to **0.7.12**,
  the versions tested here. `@stylexjs/stylex` must satisfy the peer range
  (`^0.19.0`); the 0.15 line fails `npm install`.
- Astryx ships prebuilt CSS (`reset.css`, `astryx.css`, `theme.css`). No StyleX
  build plugin is needed; the factory uses Vite + `@vitejs/plugin-react`.
- The theme CSS uses `@scope`, `light-dark()` and `color-mix()`; capture in
  Chromium 120+ (Edge/Chrome current).
- Upgrade both Astryx packages together, run `npm run typecheck`, `capture`,
  `verify`, and compare the stills at 1:1. If a token name moved, fix it in
  `brands.ts` — never patch `node_modules`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `'vite' is not recognized` under Windows Node | `node_modules` was installed from WSL (no `.cmd` shims) | install from Windows, or build in WSL and capture with `--no-build` |
| `no Chromium-based browser found` | Edge/Chrome not installed, or Linux CI | install Edge/Chrome, or set `MOCKUP_BROWSER=chrome` |
| `preview server did not answer` (old script) | dev-server/port race | the current capture uses a static server; rebuild if `dist/` is stale |
| capture waits forever | a screen never sets `data-mockup-ready` | check the console; `document.fonts.ready` can hang on a missing font |
| text is clipped | the viewport is too short for the content | raise `height` or cut copy; never scale the screenshot |
| price reads `$ 1,200` | bidi reordering | use `money()` (LRI/PDI) |
| Arabic looks disconnected | Latin font fallback | keep IBM Plex Sans Arabic loaded; `font-display: block` |

## What comes next

- Add an `omnix` brand and a services catalogue once the client supplies the real
  product list, prices and logo. The storefront/product screens already fit a
  digital-services mini app; only `brands.json` and `src/data/` change.
- Optional v2: a scripted scroll/typing capture (Playwright video is WebM and not
  frame-accurate; a frame-sequence capture would be the honest way). Not in v1.

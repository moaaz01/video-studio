# UI mockup factory

A separate Vite + React 19 app that draws **Arabic-first, RTL product screens**
with [Astryx](https://github.com/meta/astryx) and captures them as 2× PNGs for
films that do not have real screens yet.

It is deliberately **not** imported by `src/` or Remotion. Astryx is a UI design
system, not a frame-driven renderer; the film engine keeps its own look system.

The full guide — quality gates, the capture contract, RTL rules, troubleshooting —
is [`references/mockups.md`](../../references/mockups.md).

## Commands

From the repo root:

```bash
python scripts/studio.py mockups list
python scripts/studio.py mockups capture
python scripts/studio.py mockups capture --only waha-storefront --no-build
python scripts/studio.py mockups verify --strict
python scripts/studio.py mockups doctor
```

Or from this folder:

```bash
npm install
npm run dev        # http://127.0.0.1:5180/?screen=waha-storefront
npm run typecheck
npm run build
npm run capture    # build + serve dist/ + Edge/Chromium at 2×
```

## Layout

| File | Role |
|---|---|
| `brands.json` | Per-client tokens, light + dark. The only place a colour lives. |
| `screens.json` | Which screen, which brand, which mode, which CSS viewport, scale. |
| `src/screens/*.tsx` | Pure components: `{brand, mode}` in, pixels out. No fetch, no timers. |
| `src/data/<client>.ts` | A `Catalogue`: services, orders, KPIs, chart data. |
| `src/styles/theme.css` | The unlayered layer: font faces, brand variables, screen CSS. |
| `scripts/capture.mjs` | Static server + Playwright, exact viewport, fonts settled, PNG + sha256. |

Captures land in `public/mockups/<brand>/` with a `manifest.json`. A scene uses
them with `staticFile('mockups/<brand>/<screen>.png')`.

## Add a client

1. Add the brand to `brands.json` (both `light` and `dark`).
2. Add `src/data/<client>.ts` implementing `Catalogue`; register it in
   `src/data/index.ts`.
3. Add an entry to `screens.json`.
4. Capture, then look at the PNG at **1:1** before it goes into a film.

## The fixture warning

`waha` (واحة) is **fictional**. Its services, prices, ratings, customer names and
order numbers exist to exercise layout, not to be shipped. Replace them with the
client's real catalogue before capturing a client film. If the client has real
screens, scan them with `studio.py ui --dir <app>` first; a mockup is not the
real app.

## Versions

`@astryxdesign/core` and `@astryxdesign/theme-neutral` are pinned to `0.7.12`;
`@stylexjs/stylex` must satisfy `^0.19.0` (the 0.15 line fails `npm install`).
Astryx ships prebuilt CSS, so there is no StyleX build plugin. Astryx and StyleX
are MIT; Lucide is ISC. See `THIRD_PARTY_NOTICES.md`.

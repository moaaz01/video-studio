# The look system

A film has one look. It is chosen before the first render and it is a decision the
client can see, compare and approve — not a filter applied at the end because the
footage felt flat.

## Where it lives

- `src/look/looks.ts` — the presets. Every number here is a deliberate choice.
- `src/look/FilmGrade.tsx` — grade (CSS filter), bloom, vignette, grain, letterbox.
- `src/look/Camera.tsx` — one camera move per beat, plus Perlin handheld.
- `film/film.json` → `"look": "cinema-warm"` — the film's declared look.

## The five presets

| Look | Use it for | Character |
| --- | --- | --- |
| `cinema-warm` | default marketing film | warm highlights, 1.07 contrast, visible grain, strong vignette |
| `paper-clean` | product/UI explainers, screen-recording heavy | almost neutral, low grain, gentle vignette |
| `ink-noir` | premium teaser, dark UI | crushed blacks, 1.13 contrast, 2.39:1 bars, heavier grain |
| `vivid-launch` | paid social, small screens | saturated, bright bloom, more camera movement |
| `ui-daylight` | UI-first launch film; screens are the argument | paper stays paper-white, mild saturation, camera energy instead of haze |

## Rules

1. **One look per film.** Mixing looks between beats reads as an editing mistake.
2. **Grade is CSS, not canvas.** It survives every renderer, costs nothing and is
   deterministic. Canvas effects (`lut()`, `glow()`, `lens-blur()` from
   `@remotion/effects`) are the next layer and must degrade to this one.
3. **Grain is animated by offset, not by randomness.** The tile is rasterised
   once; only `background-position` changes per frame, so a still and the
   matching video frame are identical.
4. **Handheld is Perlin noise, not `Math.random()`.** Same reason.
5. **Text keeps priority.** If a look reduces copy contrast, `advise.py` fails it:
   the grade must never be the reason a headline is hard to read.
6. **Letterbox only when the content is a hero shot.** Cropping a UI demo into
   2.39:1 destroys the phone's aspect; use it for the hook and the end card only.
7. **A shutter blurs motion that exists.** `look.motionBlur` sets the 180-degree
   shutter samples (3 = film cadence, 0 = off). Motion blur on a static shot is
   invisible, so `Camera` opens each beat with a 7-frame accent — the settle that
   gives the shutter something to smear. Cost measured: 3 samples = 1.93x render
   time at 1080p; exposure is preserved within 0.24 luma because the samples are
   additive and normalised.

## Show, don't tell

```bash
python scripts/looks.py                       # every look on the same frames
python scripts/looks.py --looks cinema-warm,ink-noir --frame 200 620
```

The frames land in `out/looks/`. Send them to the client, get one answer, set
`film.look`, then render. This replaces the "which style do you prefer?" question
asked in words.

## The grade is generated, not borrowed

`scripts/lut.py` reads the app's palette (`src/theme.ts`) and turns it into
transfer curves: highlights lean to the parchment token, shadows to ink, and the
paper surfaces stay at their real value instead of being pushed to white.
`src/generated/grade.json` is the committed artefact; `FilmGrade` applies it as a
real `feComponentTransfer` filter, and the same maths writes 33-cube LUTs into
`public/luts/` (gitignored, regenerated in under a second).

Check parity with the probe, not with your eyes:

```bash
npx remotion still src/index.ts GradeLab out/qa/grade_lab.png --frame=1
python scripts/lut.py --json-only
```

Sixteen neutral patches must match the JSON within one code value — measured
mean 0.46, i.e. 8-bit rounding only. If they diverge, the look is a bug.

## Next: applying the LUT to the DOM

`@remotion/effects` offers `lut()` and `createEffect()` for canvas layers, and
`<HtmlInCanvas>` would let a shader grade the whole composite. The LUT already
exists in `public/luts/<look>.cube`; what is missing is the Chrome flag, not the
colour. Until then the SVG filter is the path, and when the flag ships both paths
must produce the same reading of the image — a viewer should not be able to tell
which one rendered.

# The look system

A film has one look. It is chosen before the first render and it is a decision the
client can see, compare and approve — not a filter applied at the end because the
footage felt flat.

## Where it lives

- `src/look/looks.ts` — the presets. Every number here is a deliberate choice.
- `src/look/FilmGrade.tsx` — grade (CSS filter), bloom, vignette, grain, letterbox.
- `src/look/Camera.tsx` — one camera move per beat, plus Perlin handheld.
- `film/style.json` → `"look": "premium-warm"` — the film's declared look
  (the whole cut is declared there: look, motion, background, transitions, sfx).

## The seven presets

| Look | Use it for | Character |
| --- | --- | --- |
| `cinema-warm` | default marketing film | warm highlights, 1.07 contrast, visible grain, strong vignette |
| `paper-clean` | product/UI explainers, screen-recording heavy | almost neutral, low grain, gentle vignette |
| `ink-noir` | premium teaser, dark UI | crushed blacks, 1.13 contrast, 2.39:1 bars, heavier grain |
| `vivid-launch` | paid social, small screens | saturated, bright bloom, more camera movement |
| `premium-warm` | a device-led launch film with paper beats | cinema-warm's atmosphere without the haze: bloom .62, vignette .30, grain .05, camera 1.12, a warm LUT (sat 1.10, warm .30) |
| `ui-daylight` | UI-first explainer where the screen is the only subject | almost flat: vignette .14, bloom .22 — the look that taught us a screen-only film reads as a slide deck |
| `midnight-souk` | a store/product launch whose only light source is the UI itself | deep teal-ink stage, bloom .78, vignette .40, grain .06, camera 1.35 — the product is the lamp, saffron is the money |

## The style contract

`film/style.json` (or a project `style.json`) declares the whole cut, and
`make_timeline.py` compiles it into `src/generated/style.json`:

```json
{
  "template": "app-demo",
  "look": "premium-warm",
  "motion": 1.0,
  "background": "paper-glow",
  "transitions": ["whip", "slide", "blur"],
  "sfx": {"intro": "riser_short", "cut": "whoosh_rtl", "accent": "card_pop"}
}
```

- `motion` scales every camera move and float (0.2–1.5); 1.0 is the designed pace.
- `background` is the stage a scene paints on: `paper-glow` (warm paper + aurora +
  rule + dust), `ink-aurora` (night green aurora for type beats), `emerald-depth`
  (the end card's deep green), `souk-night` (midnight teal stage for a store film) and
  `vault-night` (black vault, a single raking shaft, for a security beat). Each scene
  declares a `tone` and the ground resolves
  to the matching variant; the film's `background` is the declared nominal stage,
  and `make_timeline --strict` refuses a name that is not in this list.
- `transitions` is the **cut vocabulary**, one word per bar line, cycling. The cut
  is a hand-off, not a curtain: each beat is pre-rolled by 8 frames, then hands
  over across 10 frames while the next scene arrives on the same axis
  (`whip` = skewed slide + leak, `slide` = push, `blur` = defocus crossfade,
  `flash` = light bloom). A solid wipe is not in the vocabulary — it renders a
  blank cream frame at the seam, which is exactly the "primitives" note.
- `sfx` names the stems the mix uses: `intro` rise, `cut` whoosh, `accent` pop, and
  optional named stems (`tick · drop · success · stamp · rise · seal · reward · land ·
  sweep · open · close`) that a beat can cue by name. Every stem must exist in
  `public/audio/sfx/` or `--strict` fails.

## Backgrounds and stage colour

The paper is a material, not a hex: `Ground` layers a 118° gradient
(`#FFF9EE → #F8EBD5 → #F2DFC4`), an aurora, two soft glows, optional ruled lines,
grain and a vignette. Ink beats swap the same structure for `#08110F` aurora and
emerald type. Every scene states its `tone`, so a viewer feels the film move
between *printed page* and *night screen* without a single hard cut.

## Captions

`Captions` burns `src/generated/captions.json` (built by `scripts/captions.py`)
**only where the safe band exists**: 9:16 reels. The 16:9 master and the 4:5 / 1:1
teasers ship clean, because the strip would sit on the copy. Captions are display
copy: `clean_text()` strips tashkeel and the escaped-comma prosody hint, so the
burned line is readable even though the VO script carries full vocalisation.

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

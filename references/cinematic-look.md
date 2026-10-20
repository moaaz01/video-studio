# The look system

A film has one look. It is chosen before the first render and it is a decision the
client can see, compare and approve — not a filter applied at the end because the
footage felt flat.

## Where it lives

- `src/look/looks.ts` — the presets. Every number here is a deliberate choice.
- `src/look/FilmGrade.tsx` — grade (CSS filter), bloom, vignette, grain, letterbox.
- `src/look/Camera.tsx` — one camera move per beat, plus Perlin handheld.
- `film/film.json` → `"look": "cinema-warm"` — the film's declared look.

## The four presets

| Look | Use it for | Character |
| --- | --- | --- |
| `cinema-warm` | default marketing film | warm highlights, 1.07 contrast, visible grain, strong vignette |
| `paper-clean` | product/UI explainers, screen-recording heavy | almost neutral, low grain, gentle vignette |
| `ink-noir` | premium teaser, dark UI | crushed blacks, 1.13 contrast, 2.39:1 bars, heavier grain |
| `vivid-launch` | paid social, small screens | saturated, bright bloom, more camera movement |

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

## Show, don't tell

```bash
python scripts/looks.py                       # every look on the same frames
python scripts/looks.py --looks cinema-warm,ink-noir --frame 200 620
```

The frames land in `out/looks/`. Send them to the client, get one answer, set
`film.look`, then render. This replaces the "which style do you prefer?" question
asked in words.

## Next: a LUT we own

`@remotion/effects` provides `lut()` for inline 3D `.cube` LUTs and
`createEffect()` for custom WebGL2/WebGPU shaders. The plan is a film-print
emulation generated from our own palette, applied through `<HtmlInCanvas>` with
an `isSupported()` fallback to the CSS grade above. Non-negotiable: the fallback
path and the LUT path must produce the same *reading* of the image — a viewer
should not be able to tell which one rendered.

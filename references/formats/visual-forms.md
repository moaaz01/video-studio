# Tutorial, character, motion graphics: three drawn forms

Each form is a beat `kind` with its own scene, compile-time checks
(`scripts/kinds.py`) and a starter in `references/starters/`. A film mixes them
freely; a tutorial can open on the presenter and close on a gfx CTA.

```bash
python scripts/studio.py new howto --format tutorial          # or character | motion-graphics
python scripts/studio.py pipeline start tutorial --film film/howto.json
python scripts/studio.py timeline --film film/howto.json --strict
```

## `tutorial` — the screen is the lesson

`src/scenes/Tutorial.tsx`. One real capture per beat (PNG/JPG or a screen recording
MP4 under `public/`), in a `browser`, `phone` or `none` frame.

| field | meaning |
|---|---|
| `src`, `aspect` | the capture and its width/height (measure it, do not guess) |
| `steps[].at` | seconds into the beat when the cursor **arrives**; it travels for 0.55 s before |
| `steps[].x/y` | 0–1 of the capture: where the camera centres and the cursor lands |
| `steps[].zoom` | 1–4 (default 1.8); the camera never shows past the capture's edge |
| `steps[].box` | `[x, y, w, h]` spotlight: the rest of the screen dims |
| `steps[].label` | the Arabic callout, one action per step |
| `steps[].click` | `false` for a hover-only step (no ripple) |

Rules: one action per step, one screen per beat. Read coordinates off the real
image (open it at 1:1 and divide the pixel by its width/height). Captures come from
`studio.py ui` / REA (`fidelity-pipeline.md`), never from a re-drawn mock.

## `character` — the studio presenter

`src/scenes/Character.tsx` + `src/components/Puppet.tsx`. An original SVG
character: blink, breath and head bob are procedural, the mouth is driven by the
VO word timings (`lib/speech.ts`: jaw flaps per syllable; the vowel letter picks
the shape: open, wide or round). With no VO the mouth rests; it never mimes.

| field | values |
|---|---|
| `character` | `skin`, `hair`, `shirt`, `accent`, `hairStyle` (short, long, hijab, cap, none), `glasses` |
| `gestures[]` | `{at, pose}` where pose is idle, wave, point, cheer, think or present; blends over 10 frames |
| `expression` | neutral, happy, surprised, thinking, concerned, confident |
| `side` | `right` (default; the presenter points left into the Arabic copy) or `left` |
| `card` | `{title, rows[]}`: the proof under the bubble |
| `bubble` | `false` hides the speech bubble (captions or VO only) |

Keep one wardrobe per film (a cast is several `character` objects reused by id in
your film.json). `point` on the beat that names the thing; `cheer` only on the CTA.

## `gfx` — motion graphics as data

`src/scenes/Gfx.tsx`. A beat is `data.layers[]`, painted in order. Every layer has
`at` (seconds), `x`/`y` (0–1 of the frame), `size` (fraction of the short side ×
1080), `color`, `anim` (pop, fade, rise, slide, spin, pulse, none; paths draw) and
an optional `v: {x, y, size, w, h}` override for vertical canvases.

| type | needs | notes |
|---|---|---|
| `shape` | `shape`: circle, rect, ring, blob, triangle | `fill: false` makes an outline |
| `path` | `d` in a 0–100 viewBox | draws on over `dur` s (`@remotion/paths`) |
| `text` | `text` | Arabic, word-safe; `w` = width as a fraction of the frame |
| `icon` | `name` | Material Symbols, same set as the app |
| `bars` | `values[]`, `labels[]` | RTL order, last bar in the accent, Arabic-Indic values |
| `counter` | `to`, `from`, `suffix`, `label` | counts on the frame clock |
| `ring` | `value` 0–1 | a progress ring with its percentage |
| `connector` | `to: [x, y]` | a drawn curve between two points |
| `image` | `src` under public/ | real assets only |
| `lowerthird` | `title`, `sub` | anchored bottom-right (RTL) |

Numbers in a gfx beat are claims: they come from the intake, or the beat says
"sample" on screen, as the starter does.

# Templates and the style contract

A film starts with two decisions that are easy to make late and expensive to make
late: *what kind of film is this* and *what does it look and sound like*. The
archive in `references/templates/` records those decisions as data, and
`scripts/templates.py` turns a brief into the six fields the composition can
consume.

This is the decision layer, not a renderer. A recipe says "this kind of film is
made of these beats, cut this way, lit this way" — it never draws a frame, and no
asset, prompt or frame from a reference film enters the repo through it.

## The pipeline

```
film/brief.md
   │  studio.py new <slug>                the copy decisions, in prose
   ▼
film/film.json                            copy, cut, and one `style` key
   │  templates.py pick --brief film/film.json
   ▼
<template id>
   │  templates.py apply <id> --film film/film.json --out film/style.json
   ▼
film/style.json                            six fields, no more:
   │                                       template · look · motion · background ·
   │                                       transitions · sfx
   │  make_timeline.py --film film/film.json
   ▼
src/generated/style.json + timeline        the compiled plan, the only thing the
   │                                       composition imports
   ▼
engine ── the composition reads the style plan; the timeline and the copy are unchanged
```

- `pick` scores the whole archive against the brief and prints the number and the
  reasons. The brief can be a real `film.json` or a hint object
  (`{"kind": "reel", "energy": "high", "aspect": "9x16", "dialect": "ar-levant"}`,
  or `-` for stdin) when the film does not exist yet.
- `apply` validates the recipe's capabilities against the repo and writes the
  contract. It refuses a capability the engine does not have.
- The plan's `style` key is the integration point: a filename relative to the plan
  (`"style": "style.json"`) or the same six fields inline. `make_timeline.py`
  resolves either, merges it over safe defaults — a film that declares nothing
  still compiles — and writes `src/generated/style.json` next to the timeline.
  Either way the style object has exactly six fields: a seventh field is outside
  the contract, and this layer refuses to write one.

**Status.** The archive, the contract and the commands are here, and every field
but one is consumed by the renderer:

| field | consumed by |
|---|---|
| `look` | `FilmGrade` + the palette-derived LUT |
| `motion` | camera strength and float amplitude in `Film`/scenes |
| `transitions` | the hand-off between beats in `Film.tsx` |
| `sfx` | `Soundtrack` (`intro` rise, per-cut `cut`, `accent`) |
| `background` | **validated only**: a scene's `tone` selects its ground variant (`paper-glow`, `ink-aurora`, `emerald-depth`), so the declared name documents the stage rather than overriding a scene's tone |

Until a field is consumed by a render, do not report a visual difference you have
not seen — the grade is measured on the artifact, not on the file.

## Choosing in 60 seconds

| the request is… | start from | why that one |
| --- | --- | --- |
| an app launch where the screens are the product | `app-demo` | the device is the frame; one screen per beat |
| something ships and the audience already wants it | `launch-hero` | claim, drop, product on the kick, end card |
| one feature, shown once | `feature-reveal` | one screen, one variable changed |
| "we used to do X, now we do Y" | `before-after` | the old workflow replaced by the real screen |
| the number is the argument | `stats-impact` | one figure counted and landed |
| a user's sentence carries the claim | `testimonial-quote` | the quote on paper, the UI answering it |
| a mechanism that must be understood | `explainer-education` | the mechanism drawn in order |
| the message is a sentence, no product surface | `kinetic-manifesto` | words as the only object |
| credibility: institutional, academic, premium | `arabic-editorial` | ink on paper, margins, one stamp |
| 9:16 first, feed-native | `reel-vertical` | a claim per bar, captions burned, safe areas |
| a date, a place, a programme | `event-promo` | what, when, where, then urgency |
| a name and not much else | `product-teaser` | withhold, reveal once, name it |
| one UI element is the story | `ui-morph` | one element through its states, never a cut |

If none of these is the request, the right move is the adaptive rules below —
not a fifteenth template invented from taste.

## Adaptive rules

`pick` returns a score, a runner-up and a margin. Read them, do not just take the
top row.

| signal | what it means | what to do |
| --- | --- | --- |
| score ≥ 60, margin ≥ 5 | the archive has this kind of film | take the template, then write the copy |
| score ≥ 60, margin < 5 | two recipes fit the same brief shape | compare the runner-up's structure and transitions; add the missing discriminator (`kind`, `energy`, `aspect`, `dialect`) to the brief, or choose deliberately and record why |
| score < 60 | the archive does not have this film | do not force a template: collect 3–5 references of the same genre, name their shared moves, and add a recipe (see `references/templates/README.md`) |
| no recipe for the aspect | the composition is not a rescale | re-frame the winner's structure for the aspect; do not crop the 16:9 |
| no look/background/transition/stem for the intent | a capability gap, not a template gap | extend the engine budget first (`src/look/looks.ts`, the contract enums, `public/audio/sfx/`); a recipe may not promise what the renderer cannot draw |
| a dialect or audience is missing | a tag gap | add the tag and write the copy rules for that register; the beat structure rarely changes |
| the same request arrives twice | it is a genre, not a one-off | promote it: one reference card per film, then one recipe |
| the same template is used three times | the films start to read alike | vary the content inside the vocabulary (screens, copy, evidence), and if two films still read alike, the direction needs a new move — not more templates |

A template is a starting decision, never a final answer: the brief wins, and the
copy, the real numbers and the real screens are still the work.

## The style contract

`film/style.json` — exactly these six fields:

| field | type | allowed | rule |
| --- | --- | --- | --- |
| `template` | string | a recipe id | names what was applied; the provenance of the style |
| `look` | string | the `LookName` union in `src/look/looks.ts` | one look per film (see `src/look/cinematic-look.md`) |
| `motion` | number | `0.0–1.5` | the film's motion weight; a recipe contributes `0.0–1.0` |
| `background` | string | `paper-glow`, `ink-aurora`, `emerald-depth` | the ground the type sits on |
| `transitions` | list of 1–2 strings | `whip`, `slide`, `blur`, `flash` | one cut vocabulary; a cross-dissolve is not in the budget |
| `sfx` | object | `intro`, `cut`, `accent`, each a stem in `public/audio/sfx/` | the foley map; every stem must exist as `<stem>.wav` |

The worked example, written for the current StudyAI Shami film
(`projects/studyai-shami/film.json`, five beats, 21 bars, 42.0 s):

```json
{
  "template": "app-demo",
  "look": "ui-daylight",
  "motion": 0.45,
  "background": "paper-glow",
  "transitions": ["slide", "blur"],
  "sfx": {"intro": "ui_chirp", "cut": "whoosh_rtl", "accent": "button_click"}
}
```

```powershell
python scripts/templates.py pick --brief projects/studyai-shami/film.json
# picked: app-demo (score 77/100), runner-up ui-morph (68), margin 9
python scripts/templates.py apply app-demo --film projects/studyai-shami/film.json --out film/style.json
# wrote: film/style.json
```

The film's own `look` was already `ui-daylight`, so the contract agrees with the
plan instead of overwriting its look decision. That is the normal case: `pick`
matches the brief's existing look when the brief declares one, and the recipe's
look is the fallback for a film that has not chosen yet.

The style file lives next to the plan that declares it: for a project plan,
`apply … --out projects/<slug>/style.json` and `"style": "style.json"` in that
plan's `film.json`. The checked-in `film/style.json` is this repo's example; the
demo plan does not declare the key yet, so the compiler falls back to defaults
there. The path is written relative to the plan's own folder, not the repo root.

## The capability budget

A recipe may only use what the engine can draw. The script reads the look union
from `src/look/looks.ts` at runtime, so the list below is the file's, not a copy:

| capability | values | source of truth |
| --- | --- | --- |
| looks | `cinema-warm`, `premium-warm`, `paper-clean`, `ink-noir`, `vivid-launch`, `ui-daylight` | `src/look/looks.ts` |
| backgrounds | `paper-glow`, `ink-aurora`, `emerald-depth` | this layer's contract |
| transitions | `whip`, `slide`, `blur`, `flash` | this layer's contract |
| SFX stems | 42 one-shots under `public/audio/sfx/` (cuts: `whoosh_rtl`, `paper_whoosh`, `sub_thump`; accents: `button_click`, `card_pop`, `ding`, `impact`, `stamp_thud`, `ui_chirp`, `shimmer`, …) | the folder itself |
| palette | the `src/theme.ts` tokens only | `theme.ts` |
| faces | `Tajawal`, `Amiri`, `NotoNaskhArabic` | `src/fonts.ts` |

`--check` fails on any value outside these lists, on a duplicate or empty field,
on a structure that breaks the bar grammar, and on typography or layout variants
outside their vocabularies.

## Commands

```powershell
python scripts/templates.py list                     # the archive as a table
python scripts/templates.py list --json              # same, machine-readable
python scripts/templates.py show app-demo            # one recipe, field by field
python scripts/templates.py show launch-hero --json  # the raw recipe
python scripts/templates.py pick --brief film/film.json
python scripts/templates.py pick --brief - --aspect 9x16 --energy high   # stdin hint object
python scripts/templates.py apply app-demo --film projects/studyai-shami/film.json --out film/style.json
python scripts/templates.py --check                  # validate the archive against the repo
python scripts/templates.py --self-test              # archive + 4 synthetic briefs + style schema
```

`--self-test` writes its evidence to `out/templates/` (gitignored, regenerable):
`archive.json`, `briefs/<name>.json`, `picks/<name>.json`, `styles/<name>.json`
and `self-test.json`. The four synthetic briefs are a device launch, a stat-led
impact film, an Arabic editorial and an energetic reel; each must land on its
expected recipe with a margin of at least 5, and the applied style must validate.

Measured in this repo:

```
$ python scripts/templates.py --check
template archive: references/templates (13 recipes)
capabilities: 6 looks (...); 3 backgrounds; 4 transitions; 42 sfx stems; 30 theme colours
PASS: 13/13 recipes valid; style contract keys: template, look, motion, background, transitions, sfx

$ python scripts/templates.py --self-test
PASS pick device-launch: expected app-demo, picked app-demo (100, margin 16)
PASS pick stat-impact: expected stats-impact, picked stats-impact (100, margin 23)
PASS pick arabic-editorial: expected arabic-editorial, picked arabic-editorial (100, margin 7)
PASS pick energetic-reel: expected reel-vertical, picked reel-vertical (99, margin 22)
SELF-TEST PASS (4/4 picks, 13/13 recipes, style schema valid)

$ python scripts/make_timeline.py --film out/templates/wire/film.json \
    --out out/templates/wire/timeline.json --style-out out/templates/wire/style.json
...
style: app-demo · look ui-daylight · motion 0.45 · bg paper-glow · cut slide/blur
```

The last command compiles a copy of the demo plan that declares
`"style": "style.json"` next to the checked-in `film/style.json`; the compiled
`style` block matches the contract file field for field and rides in the timeline
the composition imports. The demo plan itself does not declare the key yet, so on
`film/film.json` the compiler falls back to its defaults.

## Adding to the archive

The archive restocks after a reference, not after an opinion. The full procedure
is in `references/templates/README.md`; the short version:

1. pin a corpus card (`scripts/corpus.py add …`) and pass `corpus.py check --min 2`;
2. extract the grammar — bar grid, cut rate, palette temperature, one accent, type
   scale, transition vocabulary, where the sound hits;
3. write `references/templates/<id>.json` with the fields the validator expects;
4. run `--check`, then `--self-test`; a recipe that makes the archive ambiguous
   fails the self-test;
5. update the two tables (this file and the archive README) in the same change.

Provenance is not negotiable: patterns, not assets; the reference is cited by
URL and type; no frames, prompts, fonts, LUTs, music or SFX are copied; no recipe
claims a verification this repo did not measure.

## Limits

- **The contract is not the render.** The composition reads `look`, `motion` and
  `transitions`; `background` and `sfx` are validated and carried, with their
  renderer consumers still open. Do not describe a look change from the JSON
  alone — render a still, then say it.
- **A template carries no copy.** Arabic register, tashkeel, the handle, the
  numbers: those come from the brief and the product, and no recipe is allowed to
  invent them.
- **A template is not a claim.** It does not certify quality, performance or
  originality; it records a pattern that worked for this kind of film.
- **The archive is small on purpose.** Thirteen recipes cover the studio's
  requests; a fourteenth is added only when the adaptive rules say the gap is
  real and a reference backs it.

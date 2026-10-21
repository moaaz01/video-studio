# Template archive

A recipe is the decision layer between a brief and `film/style.json`: what kind
of film this is, which beats it is made of, and how it is lit, set, cut and
sounded. Thirteen recipes live here, one JSON file per id, and
`scripts/templates.py` is the only thing that reads them.

They are **patterns, not presets and not assets.** Every recipe names the
reference it was adapted from and says what was *not* reused. Nothing here is a
prompt dump, a moodboard, or a licence to reproduce someone's film.

## The thirteen

| id | use it when | look / background | bars · s |
| --- | --- | --- | --- |
| `app-demo` | the app is the product; screens are the evidence | `premium-warm` / `paper-glow` | 21 · 42 |
| `launch-hero` | something ships, the audience already wants it | `vivid-launch` / `ink-aurora` | 13 · 26 |
| `feature-reveal` | one feature, one screen, one change per beat | `paper-clean` / `paper-glow` | 15 · 30 |
| `before-after` | the old workflow replaced by the real screen | `paper-clean` / `paper-glow` | 16 · 32 |
| `stats-impact` | the number *is* the argument | `ink-noir` / `ink-aurora` | 15 · 30 |
| `testimonial-quote` | a user's sentence carries the claim | `cinema-warm` / `paper-glow` | 21 · 42 |
| `explainer-education` | a mechanism that must be understood | `paper-clean` / `paper-glow` | 23 · 46 |
| `kinetic-manifesto` | the message is a sentence, with no product surface | `ink-noir` / `ink-aurora` | 16 · 32 |
| `arabic-editorial` | credibility: ink on paper, margins, a stamp | `paper-clean` / `paper-glow` | 21 · 42 |
| `reel-vertical` | 9:16 first, a claim per bar, burned captions | `vivid-launch` / `emerald-depth` | 11 · 22 |
| `event-promo` | what, when, where, then urgency | `cinema-warm` / `emerald-depth` | 17 · 34 |
| `product-teaser` | withhold, one reveal, the name | `ink-noir` / `ink-aurora` | 10 · 20 |
| `ui-morph` | one UI element through its states, never a cut | `ui-daylight` / `paper-glow` | 17 · 34 |

Durations are `bars × 2.000 s` at 120 BPM (60 frames at 30 fps).

## One recipe, field by field

The shape of `app-demo.json`, with the beat list and the type rules shortened so
the fields fit on one screen (the real file is the source of truth):

```json
{
  "id": "app-demo",
  "title": "App demo: the device is the frame, one screen per beat",
  "when": {
    "kind": ["app-demo", "device-demo", "ui-film"],
    "aspects": ["16x9", "9x16"],
    "energy": "mid",
    "audience": ["students", "consumer", "parents"],
    "dialect": ["ar-msa", "ar-levant"],
    "duration": [40, 75]
  },
  "structure": {"beats": [{"kind": "hook", "bars": 3, "role": "the pain, named in one line"}], "total_bars": 21},
  "look": "ui-daylight",
  "palette": {"ground": "#FBF7F0", "surface": "#FFFFFF", "ink": "#1A2A36", "accent": "#0E8A6E", "support": "#EADFCD"},
  "typography": {"face": "Tajawal", "display_px": [56, 84], "body_px": [30, 40], "line_height": 1.25, "weights": [500, 700, 800], "rules": ["..."]},
  "layouts": ["device-left-copy-right", "device-stacked-caption", "screen-detail-crop", "end-card"],
  "transitions": ["slide", "blur"],
  "sfx": {"intro": "ui_chirp", "cut": "whoosh_rtl", "accent": "button_click"},
  "background": "paper-glow",
  "motion": 0.45,
  "reference": {"site": "prompt-motion.com", "url": "https://prompt-motion.com/", "pattern": "product-ui", "move": "...", "note": "..."},
  "guardrails": ["Screens are rebuilt from the app's own code and tokens, not redrawn from a screenshot."]
}
```

Rules the validator enforces (`python scripts/templates.py --check`):

| field | rule |
| --- | --- |
| `id` | lower-kebab-case, equals the filename stem |
| `title` | one-line description of the pattern, not a slogan |
| `when.kind` | request kinds from the script's vocabulary; **the first entry is the home genre**, the rest are family matches worth fewer points in `pick` |
| `when.aspects` | `16x9`, `9x16`, `1x1` |
| `when.energy` | `low`, `mid`, `high` |
| `when.audience` / `when.dialect` | tags used by `pick`; dialects are `ar-msa`, `ar-levant`, `ar-gulf`, `ar-egypt` |
| `when.duration` | `[low, high]` seconds, and the structure's own runtime must sit inside it |
| `structure` | 3–8 beats; kinds `hook`/`device`/`stat`/`cta`; 1–8 bars each; opens on a hook, closes on a CTA; only `device` may repeat consecutively (a second screen); 8–26 bars total |
| `look` | must exist in `src/look/looks.ts` — read at runtime, never copied into the script |
| `palette` | every value a `src/theme.ts` token; ink-on-ground contrast ≥ 4.5:1; `ink-noir` needs a dark ground, `paper-clean`/`ui-daylight` a light one |
| `typography` | face from the self-hosted set (`Tajawal`, `Amiri`, `NotoNaskhArabic`); pixel ranges; 2–6 rules that a beat can obey |
| `layouts` | 2–5 names from the script's controlled list |
| `transitions` | 1–2 of `whip`, `slide`, `blur`, `flash` — one vocabulary per film |
| `sfx` | `intro`/`cut`/`accent` stems that exist under `public/audio/sfx/` |
| `background` | `paper-glow`, `ink-aurora`, `emerald-depth` |
| `motion` | 0.0–1.0 recipe weight (`film/style.json` allows 0.0–1.5) |
| `reference` | `site`, `url`, `pattern`, `move`, `note`; `url` is https; `note` must say a pattern was adapted, not an asset copied |
| `guardrails` | optional 1–4 honesty rules for the cut (no invented quotes, numbers or screens) |

`--check` also reads `src/look/looks.ts` and `src/theme.ts` and lists the SFX
folder, so a recipe cannot name a capability the engine does not have. If a look
or a token is added later, the archive is re-validated with the new list; the
script is never edited to hard-code it.

## The style contract

`apply` writes the six-field file that the pipeline compiles for the engine, and
nothing else:

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

The palette, type and layouts are decisions for whoever writes the copy and the
components; they are not transportable to the engine, and the contract says so by
omitting them. `film/style.json` is the worked example for the StudyAI Shami
project.

The file reaches the composition through the plan's `style` key — a relative
filename or the same object inline — and `scripts/make_timeline.py` compiles it
into `src/generated/style.json` over safe defaults. So a plan that declares no
style still renders; a plan that declares an unknown background, cut or stem is
warned (and with `--strict`, refused) instead of silently drawing something else.

## Adding a recipe (after a reference, not before)

1. **Pin the reference first.** A recipe without a card is a mood:
   ```powershell
   python scripts/corpus.py add --url <original post> --title "<film>" --source whatships `
     --direction device --move "<the one technique>" --why "<what it is for here>" `
     --not-taking "<what stays with the author>"
   python scripts/corpus.py check --min 2
   ```
   Cite the original post, never a re-upload. The card records the *move*, not the
   look of the film.
2. **Extract the grammar, not the picture.** Cut rate and bar grid, palette
   temperature and one accent, type scale, transition vocabulary, where the sound
   hits. If the reference does not survive muting, it has no grammar to take.
3. **Write `<id>.json`** with the fields above. Keep `reference.note` honest:
   "pattern adapted from …", and name what is *not* reused.
4. **Validate:** `python scripts/templates.py --check`. Every look, token and stem
   is checked against the repo, not against memory.
5. **Prove it discriminates:** `python scripts/templates.py --self-test` — the
   four synthetic briefs must still land on the four expected recipes, with a
   margin. A recipe that makes the archive ambiguous fails the test.
6. **Update the tables** in this file and in `docs/templates.md` in the same
   change, and note the new recipe in `pick --json` output expectations if a
   synthetic brief now has a second plausible home.

## Provenance rules

- A pattern, never an asset: no frames, prompts, fonts, LUTs, music or SFX from a
  reference film enters the repo through this folder.
- A recipe may not claim something was verified, approved or posted unless a
  command in this repo measured it. The `reference` block cites what was read,
  not what was liked.
- Numbers in a recipe (pixel sizes, contrast, motion weight) are design rules the
  copy must obey; they are not measurements of a reference film.
- Placeholder people, quotes and logos are not allowed. A testimonial recipe
  without a real, cleared quote is a scenario beat, not a testimonial.

## What a recipe is not

- Not a renderer preset: the six style fields are all the engine reads, and the
  rest is guidance for the person writing the beats.
- Not a prompt library: `reference.note` cites a pattern taxonomy, never the text
  of a prompt.
- Not a guarantee: a recipe says what usually works for this kind of film, not
  what the brief asked for. The brief wins, and `pick` reports its score and
  margin so an ambiguous brief is visible instead of silently resolved.

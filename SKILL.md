---
name: video-studio
description: Use when asked to design, script, voice, render or QA a marketing video, product film, app promo, explainer reel, launch trailer, UI demo, kinetic-type piece, reel/short, or any motion-design deliverable — including Arabic/RTL films, intake-driven product facts, multi-aspect/platform exports, thumbnail/cover stills, original score and SFX, and faithful reproduction of a real product UI inside the video. Triggers on briefs like "صمم فيديو", "make a promo video", "launch video", "app demo video", "reel", "explainer", "intro", or any request to turn a product/app/design into moving pictures.
---

# Video studio

## Overview

A complete production environment for films that must look designed, not generated:
a Remotion render engine with a timed script compiler, an Arabic-first type system,
an original score + foley engine, a Fish Audio voice pipeline, and hard QA gates.

**Core principle:** the film is a *designed artifact*. Every frame is a deliberate
choice — a named visual direction, a grid, a type scale, a mix level — and every
claim in it is verified by a script, not by vibes. A film that cannot survive its
own QA never ships.

## When to use

- Any request to make a marketing/product/launch/explainer video, reel, short, ad,
  or animated UI walkthrough.
- Any request to re-cut, re-voice, re-score, resize, re-brand or QA an existing film.
- Any request for stills from a film (thumbnail, cover, social crop).
- Arabic/RTL motion work, or a film that must reproduce a real app's screens.

Not for: editing third-party footage, live-action, or audio-only podcasts.

## Phase 0 — intake (blocking)

No film is written from a hunch. The agent asks the user the questions in
[`references/intake.md`](references/intake.md) — product, audience, promise, true
proof points, action, assets, palette, voice, platforms, duration — fills
`film/intake.json`, and runs `intake check`. A missing product image is a reason
to ask, not a reason to invent one. `intake brief` turns a complete intake into
the six-block `film/brief.md`.

The **director** then reads the intake and writes a treatment: format, direction,
clock, delivery matrix, required assets, why, alternatives
([`references/director.md`](references/director.md)). Show the treatment to the
user and get a yes before writing beats.

```bash
python scripts/studio.py intake questions --format explainer
python scripts/studio.py intake check --intake film/intake.json
python scripts/studio.py director --intake film/intake.json
```

## The forms

The studio is a set of film forms, not one template. The router and the two new
playbooks live in [`references/formats/`](references/formats/):

| brief | form | direction | start from |
|---|---|---|---|
| a game / launch / dev tool with a claim | **kinetic** | `#kinetic` / `#code` | `references/templates/kinetic-launch.json` |
| a mechanism to teach, a numbered reel | **explainer** | `#editorial` / `#diagram` | `references/templates/explainer-reel.json` |
| an app with real screens | **device** | `#device` | device/store scenes |
| a SaaS launch | **ui-film** | `#ui-film` | real UI crops |
| a store's economics | **data-film** | `#data-film` | `references/templates/cobalt-ledger.json` |
| a physical product | **editorial** | `#photo` | real photos |

Every form exports the same four masters by default: `9x16`, `16x9`, `4x5`, `1x1`
([`references/platform-matrix.md`](references/platform-matrix.md)).

## The eight phases

Run them in order. Each phase has an exit gate; do not enter the next phase with an
open gate — a late discovery re-renders the whole film.

| # | Phase | Produces | Exit gate |
|---|---|---|---|
| 1 | Brief | `film/brief.md` from `film/brief.template.md` — six labelled blocks (inputs, direction, structure, build, gotchas, start) | one sentence: "for X, the film proves Y, so they do Z"; every block filled |
| 2 | Direction | a named direction from `references/visual-direction.md` + palette/motion/type tokens, grounded by **two pinned reference cards** | `corpus.py check --min 2` passes and you can name the exact move you are borrowing, per card |
| 3 | Script | `film/film.json` — beat grid, on-screen copy, VO lines with tashkeel | every beat matches one line; reading time ≤ beat length |
| 4 | Voice | `src/generated/vo.json` + wavs via `scripts/voice.py` | every line measured; total speech ≥ 55 % of runtime |
| 5 | Build | `film/ui-source.json` scanned from the real app, scenes in `src/scenes/`, assembled by `src/film/Film.tsx` | typecheck clean, still per beat rendered, every on-screen string exists in the app's own table |
| 6 | Mix | bed composed from the timeline by `scripts/make_bed.py`, VO placed from `vo.json`, foley on the 120 BPM cuts by `src/audio/Soundtrack.tsx` | bed RMS ≈ −19 dBFS, peak ≤ −3 dBFS, 0 clipped samples, and `qa --require-audio` sees an AAC track |
| 7 | QA | `out/qa/` sheet + gates from `references/qa-gates.md` | every gate green, nothing read only from logs |
| 8 | Deliver | `out/masters/film_*.mp4` (CRF 10 / png hero, CRF 16 teasers), the QA sheet, thumbnail/cover stills, and `python scripts/package_project.py` -> `projects/<slug>/` with `manifest.json` + `SHA256SUMS` | names, durations, sizes and hashes read from the delivered files; `sha256sum -c` passes; the hand-off list matches what the user can actually open |

The look belongs to phase 5, before the first render, and it is **declared, not
improvised**: `film/style.json` names one preset from
[`references/cinematic-look.md`](references/cinematic-look.md), and `studio.py looks`
shows the client the same frame in every look so the choice is a picture, not a
preference. `studio.py advise` measures the plan before you spend render time
(reading time, contrast, rhythm, cta, look, frame arithmetic).

### The style contract (one file per film)

`film/style.json` — compiled by `make_timeline.py` into `src/generated/style.json`
— declares how the film moves, so a new film inherits a direction instead of
improvising one. A project carries its own copy (`projects/<slug>/style.json`).

- `look`: one of nine presets (`premium-warm` is the device-led default; `ui-daylight`
  is the flat lesson; `midnight-souk` is the store-launch look; `cobalt-atelier` is
  the data-film look; `atelier-emerald` is the brand-atelier look). See
  [`references/cinematic-look.md`](references/cinematic-look.md).
- `background`: `paper-glow` | `ink-aurora` | `emerald-depth` | `souk-night` |
  `golden-souk` | `vault-night` | `vault-warm` | `atelier` | `cobalt` — the stage each
  scene paints on.
- `transitions`: the cut vocabulary, cycled — `whip` | `slide` | `blur` | `flash` |
  `flood` | `iris` | `maskline` (the last three are clips: the outgoing frame stays
  alive underneath while a shape opens over it).
  A cut is a **hand-off**: the outgoing beat leaves while the next arrives on the
  same axis (8-frame pre-roll, 8-frame overlap). Never a solid wipe: it renders a
  blank frame at the seam.
- `sfx`: `{intro, cut, accent}` plus optional named stems; `--strict` fails on any
  missing stem.
- `motion`: 1.0 is the designed pace; camera strength and floats scale with it.

The scene system is the same contract in code: beat `kind` names a scene grammar
(`hook · device · stat · cta` for the launch grammar; `open · store · admin ·
security · close` and the data grammar `design · setup · sources · finale` in
`src/store/`), then
`Ground` + `CornerMarks` +
`FloatCard`/`PaperCard` + one headline per beat, with `emphasis` words coloured and
`mode="words"` reveals. Variety comes from beat type and content, not from a new
transition per scene.

### Voices: the endorsed set

The four Shami probes the client called excellent are cloned and catalogued
(`film/voices.json`, [`references/voices.md`](references/voices.md)) with their
reference ids, measured pitch and pace; the delivered StudyAI cut uses
`shami-m-deep` at speed 0.95, and the Cobalt cut uses Fish **`drama-3`** with the
Damascene male (`6e52d5af…`), temperature 0.6, per-line speed lifts. ElevenLabs
library voices are blocked on the free API (`402 paid_plan_required`); do not spend
credits retrying one. The same page lists MSA, Gulf, Saudi, Egyptian,
Lebanese and Shami stock ids, each actually spoken and ASR-checked — start there
before auditioning strangers, and always run `voice_check.py` before a mix.

### The Cobalt Ledger recipe (48 s feature film)

The reusable answer to "explain the store, don't just show it". Start from
`references/templates/cobalt-ledger.json` and
[`references/PLAYBOOK-cobalt-ledger.md`](references/PLAYBOOK-cobalt-ledger.md),
not from a blank `film.json`.

- **Clock:** 24 bars / 48.00 s — open 3, setup 4, store 5, sources 5, owner 4,
  finale 3. One data event per bar.
- **Look:** `cobalt-atelier` on `cobalt`; Tajawal 700/800; champagne only for money.
- **Scenes:** `setup` (real wizard steps + `≈ 15 دقيقة` condition), `sources`
  (three source cards → cheapest → 15% margin → source rise → automatic repricing),
  `store` (buyer path + payment-method row), `admin`, `finale`.
- **Data rule:** the product card sits below the sub, the price panel starts after
  the headline's right edge, and the source numbers are labelled «مثال».
- **CTA:** «للمزيد من التفاصيل أو لمتجرك — تواصل معنا على الخاص.» Never
  «السعر على الخاص».
- **Voice:** `drama-3` + Damascene male; ASR 6/6 worst 0.985; the delivered line
  set is 41.2 s. The exact spec is `projects/cobalt-store-launch/vo-script.json`.
- **Gate that matters:** every data scene is rendered as a 1:1 still *before* the
  first video frame; overlap defects are invisible on a contact sheet.

## The command surface

```bash
python scripts/studio.py doctor          # env, fonts, ffmpeg, key, deps
python scripts/studio.py ui --dir <app>  # scan the real project -> film/ui-source.json
python scripts/studio.py refs whatships "<product>"   # what already shipped
python scripts/studio.py refs motion product-ui        # what the corpus has
python scripts/studio.py refs tech                       # how a move is built, and if this engine has it
python scripts/studio.py refs add --url ... --title ... --move ... --why ...
python scripts/studio.py refs check --min 2            # the phase-2 gate
python scripts/studio.py new <slug> --format explainer   # scaffold from a form
python scripts/studio.py intake questions --format explainer
python scripts/studio.py intake check --intake film/intake.json
python scripts/studio.py director --intake film/intake.json
python scripts/studio.py format explainer --film film/film.json --strict
python scripts/studio.py format kinetic --film film/film.json --strict
python scripts/studio.py motion out/film_9x16.mp4 --profile kinetic --strict
python scripts/studio.py export --targets 9x16,16x9,1x1,4x5 --strict
python scripts/studio.py timeline        # film.json -> src/generated/timeline.json
python scripts/studio.py voice           # Fish Audio lines -> wavs + measured vo.json
python scripts/ui_source.py --rea        # the capture commands (device, APK, web)
python scripts/studio.py score           # compose the bed from the timeline, then level it
python scripts/studio.py still 502       # one frame, 1:1 crop, for eyeballing
python scripts/studio.py looks           # the same beat in every look, for the client
python scripts/studio.py storyboard      # sheet.png: real panels + VO, to annotate
python scripts/studio.py advise          # measured review before spending render time
python scripts/studio.py eval            # golden briefs must compile and score >= 90
python scripts/studio.py lut             # palette -> grade curves (and .cube for later)
python scripts/studio.py safe <still> --preset reels --strict   # platform UI bands
python scripts/studio.py captions        # cue JSON + wide/vertical SRT (--check verifies)
python scripts/studio.py shotlist <brief> --out film/plan.json   # brief -> shot list + plan
python scripts/studio.py provenance --strict   # declared captures match their hashes
python scripts/mcp_server.py             # expose the studio to any agent (MCP, stdio)
                                          # tools: doctor, scan, refs, advise, storyboard, still,
                                          # render, qa, captions, safe, shotlist, grade, evals
                                          # resources: studio://film|timeline|grade|captions|ui-source|roadmap|skill
python scripts/studio.py render 16x9 9x16 4x5 1x1   # masters, all four by default
python scripts/studio.py qa              # gates + contact sheets + thumbnails
```

Anything that takes a flag accepts `--help`; read it rather than guessing.

## Direction in one table

| If the brief is… | Direction | Reference |
|---|---|---|
| a product UI that is the star | Product UI / UI demo | `visual-direction.md#ui-film` |
| a launch, hype, "we shipped" | Launch trailer / drop | `#launch` |
| a number, a stat, a claim to land | Kinetic type / data | `#kinetic` |
| an explainer with a mechanism | Diagram / schematic | `#diagram` |
| a phone app shown faithfully | Device film | `#device` |
| a calm, premium, editorial pitch | Editorial / paper | `#editorial` |
| the product's economics need explaining | Data film / Cobalt Ledger | `#data-film` + `PLAYBOOK-cobalt-ledger.md` |
| a numbered lesson / mechanism, voice-led | Explainer reel | `#editorial` / `#diagram` + `references/formats/explainer-reel.md` |
| a game / launch / dev-tool claim, beat-grid | Kinetic film | `#kinetic` / `#code` + `references/formats/kinetic-film.md` |

Full rubric, palettes and motion signatures live in
[`references/visual-direction.md`](references/visual-direction.md).

## Non-negotiables

1. **The intake is blocking.** No beat is written until `intake check` passes and
   the treatment is approved. Ask for real screens, strings, colours and facts;
   never invent them. See [`references/intake.md`](references/intake.md).
2. **Fidelity is measured, not remembered.** Scan the project
   (`studio.py ui --dir <app>`): every screen, string, colour and font family the
   film shows must exist there. For pixels, capture the real device with REA and
   match at 1:1. Invented UI is the fastest way to lose the audience's trust —
   see [`references/fidelity-pipeline.md`](references/fidelity-pipeline.md).
3. **No fake social proof.** No invented ratings, user counts, awards, "the #1".
   Placeholder document names are fine; placeholder success is not.
4. **Arabic is set, not styled.** No `letterSpacing`, no `text-transform`, no
   italics, no letter-by-letter reveal. `dir="rtl"` + `lang="ar"` always.
   See [`references/arabic-type.md`](references/arabic-type.md).
5. **Audio is composed to the cut.** Everything sits on a 120 BPM grid; a cut with
   no sound is a mistake. See [`references/audio-and-voice.md`](references/audio-and-voice.md).
6. **Silent-autoplay safe.** Every beat must read as a still, with sound off.
7. **Borrowed taste is cited.** Two pinned cards minimum; each names the move and
   the source. See [`references/prompt-anatomy.md`](references/prompt-anatomy.md)
   for the prompt structure those cards are written in.
8. **Gates before praise.** Never report a render as good until
   `references/qa-gates.md` passes on the real file.
9. **The look is declared, not improvised.** One preset per film, named in
   `film/style.json` before the first render. Mixing looks between beats reads as a
   mistake; changing the look to fix weak content is a lie. See
   [`references/cinematic-look.md`](references/cinematic-look.md).
10. **A cut moves the film, it does not hide it.** Scenes hand over on one axis; no
   solid wipe, no dip to a blank colour, no cut where both frames are static. The
   seam is where the energy is.
11. **One timeline, four canvases.** Every film ships 9:16, 16:9, 4:5 and 1:1 by
    default; a platform cut is a subset, not a second edit. Check a 1:1 still before
    the render. See [`references/platform-matrix.md`](references/platform-matrix.md).
12. **Critique with frames, not adjectives.** Before the client is asked to choose,
   render the options: `studio.py looks` as real frames, `studio.py storyboard` as
   the whole film on one sheet. A brief answered with a picture gets a decision.

## Layout of this skill

```
SKILL.md                  this file
AGENTS.md                 portable entry for any non-DSH agent
scripts/studio.py         orchestrator: doctor/new/ui/refs/timeline/voice/score/render/qa
scripts/voice.py          Fish Audio TTS -> measured VO manifest
scripts/voice_check.py    ASR round-trip gate: the wav must say the scripted words
scripts/app_strings.py    real app strings (values-*/strings*.xml) -> src/generated JSON
scripts/make_bed.py       additive synth: the bed, from timeline.json, measured
scripts/make_score.py     legacy map-driven composer (only when a --map exists)+ foley, no samples
scripts/level_score.py    loudness/peak leveller
scripts/make_timeline.py  film.json -> timeline.json, grid + reading-time checks
scripts/intake.py        questions, completeness gate, six-block brief
scripts/director.py      intake -> treatment (format/direction/clock/delivery)
scripts/platform_matrix.py  platform/aspect/safe presets
scripts/platforms.py     plan/export all four masters + manifest
scripts/format_check.py  explainer / kinetic format gates
scripts/motion_audit.py  still %, holds, cuts, flow on the delivered MP4
scripts/voice_elevenlabs.py  optional TTS + word timestamps
scripts/qa.py             probes, blackdetect, loudness, Arabic scan, sheets
scripts/ui_source.py      scans a real app project -> film/ui-source.json; REA capture bridge
scripts/corpus.py         what shipped (whatships), what the corpus has (prompt-motion),
                          how a move is built (tech), cards, gates
scripts/package_project.py  a film project folder: assets copied, masters measured, manifest + SHA256SUMS
scripts/advise.py         measured design review: reading time, contrast, rhythm, cta, look
scripts/looks.py          the same beat in every look -> out/looks/, for the client
scripts/storyboard.py     out/storyboard/sheet.png, rendered by the engine itself
scripts/mcp_server.py     MCP over stdio: 13 tools, 7 resources, no SDK, for any agent
src/                      the Remotion engine (theme, type, motion, film, scenes)
src/look/                 the look system: presets, grade/grain/vignette, one camera move per beat
references/               the craft: direction, motion, type, audio, platforms, QA,
                          fidelity-pipeline, prompt-anatomy, reference-sources,
                          cinematic-look, corpus/, intake.md, director.md,
                          platform-matrix.md, formats/
projects/<slug>/          a finished film lives here: brief, film.json, vo-script, assets, output, manifest
docs/ROADMAP-v2.md        what to build next, and the tests a candidate must pass
examples/                 a shipped 118 s film as the worked example
```

## Common mistakes

| Mistake | Reality |
|---|---|
| Design in the render loop | Text and timing are decided in `film.json`; renders are just confirmation |
| "Looks good" from a 0.2-scale contact sheet | Arabic and kerning are unjudgeable below 1:1 — crop and read the still |
| Adding a new transition per scene | One cut vocabulary per film; variety lives in the content |
| A "clean" flat look for a UI film | Flat is not neutral: `ui-daylight` reads as a slide deck. Paper needs grain, vignette and bloom, and the cut needs to move |
| A wipe or flash-to-paper at the seam | It renders a blank cream frame. Hand the beats over: outgoing leaves, incoming arrives, both full-size |
| Music louder than speech | Duck the bed under every VO line, then re-level, then re-check peak |
| 4K because "premium" | 4K at this complexity costs ~6 h/film. 1080p CRF 10 / `--image-format=png` is the master; 1080p CRF 16 / medium is the teaser |
| Trusting the encoder's log | Probe the output file itself: dimensions, fps, duration, peak, black frames |
| Rebuilding the UI from memory | Scan the project first — one command turns "how did the header look" into a string table |
| Collecting references in a browser tab | A reference is a card: the move, the source, what it buys. Tabs are not evidence |

## Red flags

- A frame with two headlines fighting, or a caption covering the UI it explains.
- Arabic that renders in a broken or left-aligned state.
- Any beat where the picture and the voice describe different things.
- A render you have not probed, or a QA claim copied from a previous run.
- Copy on screen longer than it takes to read aloud twice.

**All of these mean: stop and fix the plan, not the comp.**

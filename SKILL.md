---
name: video-studio
description: Use when asked to design, script, voice, render or QA a marketing video, product film, app promo, explainer, launch trailer, UI demo, kinetic-type piece, reel/short, or any motion-design deliverable — including Arabic/RTL films, multi-aspect exports, thumbnail/cover stills, original score and SFX, and faithful reproduction of a real product UI inside the video. Triggers on briefs like "صمم فيديو", "make a promo video", "launch video", "app demo video", "reel", "intro", or any request to turn a product/app/design into moving pictures.
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

## The seven phases

Run them in order. Each phase has an exit gate; do not enter the next phase with an
open gate — a late discovery re-renders the whole film.

| # | Phase | Produces | Exit gate |
|---|---|---|---|
| 1 | Brief | `film/brief.md` — audience, promise, one action, aspect, length, tone | one sentence: "for X, the film proves Y, so they do Z" |
| 2 | Direction | a named direction from `references/visual-direction.md` + palette/motion/type tokens | can name the direction and show its 3 defining moves |
| 3 | Script | `film/film.json` — beat grid, on-screen copy, VO lines with tashkeel | every beat matches one line; reading time ≤ beat length |
| 4 | Voice | `src/generated/vo.json` + wavs via `scripts/voice.py` | every line measured; total speech ≥ 55 % of runtime |
| 5 | Build | scenes in `src/scenes/`, assembled by `src/film/Film.tsx` | typecheck clean, still per beat rendered |
| 6 | Mix | score from `scripts/make_score.py`, SFX on the 120 BPM grid | peak ≤ −1.4 dBFS, no clipped sample |
| 7 | QA | `out/qa/` sheet + gates from `references/qa-gates.md` | every gate green, nothing read only from logs |

## The command surface

```bash
python scripts/studio.py doctor          # env, fonts, ffmpeg, key, deps
python scripts/studio.py new <slug>      # scaffold a film from the template
python scripts/studio.py timeline        # film.json -> src/generated/timeline.json
python scripts/voice.py --script film/vo.json     # Fish Audio -> wavs + vo.json
python scripts/studio.py score           # original bed + foley, levelled
python scripts/studio.py still 502       # one frame, 1:1 crop, for eyeballing
python scripts/studio.py render 16x9 9x16 # masters, concurrent
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

Full rubric, palettes and motion signatures live in
[`references/visual-direction.md`](references/visual-direction.md).

## Non-negotiables

1. **Fidelity beats invention.** If the film shows a product, the product's real
   screens, strings, tokens and states — rebuilt, never faked. Invented UI is the
   fastest way to lose the audience's trust.
2. **No fake social proof.** No invented ratings, user counts, awards, "the #1".
   Placeholder document names are fine; placeholder success is not.
3. **Arabic is set, not styled.** No `letterSpacing`, no `text-transform`, no
   italics, no letter-by-letter reveal. `dir="rtl"` + `lang="ar"` always.
   See [`references/arabic-type.md`](references/arabic-type.md).
4. **Audio is composed to the cut.** Everything sits on a 120 BPM grid; a cut with
   no sound is a mistake. See [`references/audio-and-voice.md`](references/audio-and-voice.md).
5. **Silent-autoplay safe.** Every beat must read as a still, with sound off.
6. **Gates before praise.** Never report a render as good until
   `references/qa-gates.md` passes on the real file.

## Layout of this skill

```
SKILL.md                  this file
AGENTS.md                 portable entry for any non-DSH agent
scripts/studio.py         orchestrator: doctor/new/timeline/score/render/qa
scripts/voice.py          Fish Audio TTS -> measured VO manifest
scripts/make_score.py     additive synth: music bed + foley, no samples
scripts/level_score.py    loudness/peak leveller
scripts/make_timeline.py  film.json -> timeline.json, grid + reading-time checks
scripts/qa.py             probes, blackdetect, loudness, Arabic scan, sheets
src/                      the Remotion engine (theme, type, motion, film, scenes)
references/               the craft: direction, motion, type, audio, platforms, QA
examples/                 a shipped 118 s film as the worked example
```

## Common mistakes

| Mistake | Reality |
|---|---|
| Design in the render loop | Text and timing are decided in `film.json`; renders are just confirmation |
| "Looks good" from a 0.2-scale contact sheet | Arabic and kerning are unjudgeable below 1:1 — crop and read the still |
| Adding a new transition per scene | One cut vocabulary per film; variety lives in the content |
| Music louder than speech | Duck the bed under every VO line, then re-level, then re-check peak |
| 4K because "premium" | 4K at this complexity costs ~6 h/film. 1080p at CRF 15 is the deliverable |
| Trusting the encoder's log | Probe the output file itself: dimensions, fps, duration, peak, black frames |

## Red flags

- A frame with two headlines fighting, or a caption covering the UI it explains.
- Arabic that renders in a broken or left-aligned state.
- Any beat where the picture and the voice describe different things.
- A render you have not probed, or a QA claim copied from a previous run.
- Copy on screen longer than it takes to read aloud twice.

**All of these mean: stop and fix the plan, not the comp.**

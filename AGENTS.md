# AGENTS.md — entry protocol for any coding agent

You are in the **video-studio** repository. It is a working video studio, not a
sample project: it renders Arabic-first product films end to end, and it doubles
as a portable Agent Skill (`SKILL.md`).

Read in this order, and stop when you have what you need:

1. `SKILL.md` — the protocol: eight phases, exit gates, non-negotiables.
2. `references/visual-direction.md` — pick the look *before* writing code.
3. `references/arabic-type.md` — hard rules; violating them is a defect, not a taste.
4. `references/audio-and-voice.md` — if the request includes voice or music.
5. `references/qa-gates.md` — the commands that decide whether you are done.

## The 30-second version

```powershell
npm install
python scripts/studio.py doctor        # environment check, no network
python scripts/studio.py timeline      # film/film.json -> src/generated/timeline.json
python scripts/studio.py render        # out/film_1080p.mp4 + out/film_9x16.mp4
python scripts/studio.py qa --stills 8 # gates + contact sheets, non-zero on failure
```

## How to make a new film

1. **Brief** (`references/brief-recipes.md`): fill the brief shape — product,
   audience, one promise, one action, aspect, duration, language, sources.
   If a required fact is missing (a handle, a price), ask; never invent it.
2. **Direction**: choose one of the twelve directions and write down why. You are
   not allowed to "just make it modern".
3. **Script**: edit `film/film.json` — beats, `bars` (one bar = 2 s at 120 BPM),
   Arabic copy, `vo` lines with full tashkeel. Copy rules: 8–16 words per line,
   one idea per beat, punctuation is prosody.
4. **Voice** *(optional)*: `python scripts/studio.py voice`, then
   `python scripts/studio.py timeline --strict` — the beats must fit the measured
   speech plus 0.35 s of air, or the timeline refuses to compile.
5. **Build**: `src/brand.ts` (name, mark, accent, action, contacts) and the
   screens in `src/components/DemoUI.tsx` — or the client's real screens. Scenes
   read copy from the timeline; keep components dumb.
6. **Mix**: `python scripts/studio.py score` — 120 BPM bed, foley on cuts only
   (see the foley table), levelled to peak −1.4 dBFS / RMS −20…−23.
7. **QA**: run the gates. Report *measured* numbers, from the delivered MP4.
   `python scripts/qa.py` also scans every source file for Arabic mojibake.

## Where things live

| Path | Role |
|---|---|
| `film/film.json` | The whole film: beats, bars, copy, VO lines. Edit here first. |
| `src/generated/timeline.json` | Compiled output. Never hand-edit. |
| `src/brand.ts` | Client identity: name, monogram/icon, accent, CTA, contacts. |
| `src/scenes/*.tsx` | One component per beat kind. Copy arrives as props. |
| `src/film/Film.tsx` | Sequences beats, inserts cuts, drives both aspects. |
| `src/components/DemoUI.tsx` | The mock product screen. Replace with the real UI. |
| `scripts/` | Orchester + timeline compiler + Fish bridge + score engine + QA. |

## Hard rules

- **Never invent product facts, screens, numbers or testimonials.** Fidelity to
  the real app is the first requirement of this studio. If the user gave you
  screenshots, those are the truth.
- **Never round-trip Arabic through PowerShell/CMD.** Windows consoles corrupt it
  (cp1256). Write `\u`-escaped or UTF-8 files with Python, and run Python with
  `PYTHONIOENCODING=utf-8`.
- **Never commit `.env`.** The Fish key lives there or in `FISH_API_KEY`.
- **Never trust a render's own metrics.** Probe the MP4 (`scripts/qa.py`).
- **Never claim "done" without the gate output in hand** — peak, RMS, clipped
  samples, black stretches, Arabic scan.
- **One idea per beat.** If a beat needs two headlines, it is two beats.

## Extending

- **New look** → add a direction to `references/visual-direction.md` with its
  palette, type, motion and fail-mode, then build it as a scene variant.
- **New platform** → `references/platform-specs.md` + a new `<Composition>` in
  `src/Root.tsx`; add the aspect to `RENDERS` in `scripts/studio.py`.
- **New voice model** → `scripts/voice.py` takes `--model`; keep `s2.1-pro-free`
  as the default so the repo stays runnable without spend.
- **New language** → the type and bidi rules live in `references/arabic-type.md`;
  add a parallel note (e.g. `references/hebrew-type.md`) rather than editing the
  Arabic one, and keep `lib/rtl.ts` as the single place that knows direction.

## Working with me (the human)

- Ask for the real screens and the real strings before designing; a film built on
  invented UI is thrown away.
- Show a still at 1:1 before rendering minutes of video — Arabic is unjudgeable
  in a downscaled preview.
- Tell me the measured numbers and what is still wrong. "Looks great" is not a
  status.

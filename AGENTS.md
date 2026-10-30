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
6. `references/PLAYBOOK-cobalt-ledger.md` — the 48 s data-film recipe, if the brief
   is a store/economics film. Copy it; do not start from a blank `film.json`.

## The 30-second version

```powershell
npm install
python scripts/install_check.py       # am I actually installed for every agent?
python scripts/studio.py doctor        # environment check, no network
python scripts/studio.py intake questions --format explainer
python scripts/studio.py intake check --intake film/intake.json
python scripts/studio.py director --intake film/intake.json
python scripts/studio.py ui --dir <app>  # scan the real project -> film/ui-source.json
python scripts/studio.py refs check --min 2   # are the references pinned?
python scripts/studio.py timeline      # film/film.json -> src/generated/timeline.json
python scripts/studio.py format explainer --film film/film.json --strict
python scripts/studio.py format kinetic --film film/film.json --strict
python scripts/studio.py motion out/film_9x16.mp4 --profile kinetic --strict
python scripts/studio.py export --targets 9x16,16x9,1x1,4x5 --strict
python scripts/studio.py render        # 1080p masters, all four aspects by default
python scripts/studio.py qa --stills 8 # gates + contact sheets, non-zero on failure
python scripts/studio.py safe <still>  # platform safe-area check (reels/shorts/story/feed)
python scripts/studio.py captions      # cue JSON + wide/vertical SRT, self-checked
python scripts/studio.py shotlist <brief> --out film/plan.json   # brief -> plan + shots
python scripts/studio.py provenance --strict   # captures match their hashes
python scripts/studio.py advise        # measured design review before you render
python scripts/studio.py storyboard    # out/storyboard/sheet.png: real panels, real Arabic
python scripts/studio.py looks         # one frame in every look: let the client choose
python scripts/studio.py eval          # golden briefs: schema + compile + score floor
python scripts/studio.py lut           # palette-derived grade curves + .cube LUTs
python scripts/studio.py safe out/qa/vert_device.png --preset reels --strict

```

## How to make a new film

0. **Intake**: ask the questions in `references/intake.md` for the chosen form,
   fill `film/intake.json`, and pass `studio.py intake check`. Then run
   `studio.py director` and show the treatment to the user. No beat until both
   gates pass. Missing images/screens/facts are questions, not guesses.
1. **Brief**: `studio.py intake brief` writes the six blocks (`inputs`, `direction`,
   `structure`, `build`, `gotchas`, `start`) from the intake — see
   `references/prompt-anatomy.md` for why that shape.
2. **Form + direction**: the director proposes one of the forms in
   `references/formats/` (explainer, kinetic, device, ui-film, data-film,
   editorial) and one of the twelve directions. Override only with a recorded
   reason; choose one direction and write down why. You are
   not allowed to "just make it modern". Then pin the two references you are
   actually borrowing from:
   `python scripts/studio.py refs whatships "<product>"` /
   `refs motion product-ui` -> `refs add --url ... --move ... --why ...`.
   The gate `refs check --min 2` must pass before you write beats.
3. **Script**: edit `film/film.json` — beats, `bars` (one bar = 2 s at 120 BPM),
   Arabic copy, `vo` lines with full tashkeel. Copy rules: 8–16 words per line,
   one idea per beat, punctuation is prosody.
4. **Voice** *(optional)*: `python scripts/studio.py voice`, then
   `python scripts/studio.py timeline --strict` — the beats must fit the measured
   speech plus 0.35 s of air, or the timeline refuses to compile.
5. **Build**: scan the product first (`studio.py ui --dir <repo>`) — every screen,
   string, colour and font family you print must be in `film/ui-source.json`. Then
   `src/brand.ts` (name, mark, accent, action, contacts) and the screens in
   `src/components/DemoUI.tsx`, or the client's real screens. For real pixels, capture
   the device with REA (`references/fidelity-pipeline.md`). Scenes read copy from the
   timeline; keep components dumb.
6. **Look and cut** *(before the first render)*: `studio.py looks` -> pick one preset
   -> write `film/style.json` (`look`, `motion`, `background`, `transitions`, `sfx`).
   Then `studio.py storyboard` and `studio.py advise`: the sheet is what the client
   annotates, the review is what you fix. Guide: `references/cinematic-look.md`.
7. **Mix**: `python scripts/studio.py score` — 120 BPM bed, foley on cuts only
   (see the foley table), levelled to peak −1.4 dBFS / RMS −20…−23.
8. **QA**: run the gates. Report *measured* numbers, from the delivered MP4.
   `python scripts/qa.py` also scans every source file for Arabic mojibake.
9. **Deliver**: `python scripts/package_project.py --project projects/<slug>` — the
   only step that produces the folder you hand over (assets + masters + 11 stills +
   manifest + SHA256SUMS). Commit the stills and the manifest; masters stay ignored.

## Where things live

| Path | Role |
|---|---|
| `film/film.json` | The whole film: beats, bars, copy, VO lines. Edit here first. |
| `film/brief.template.md` | The six-block brief to copy into `film/brief.md`. |
| `film/ui-source.json` | Generated by `studio.py ui`: the real app's screens, strings, tokens. Gitignored. |
| `references/corpus/` | Pinned reference cards + their index. `refs add` writes here. |
| `src/generated/timeline.json` | Compiled output. Never hand-edit. |
| `src/brand.ts` | Client identity: name, monogram/icon, accent, CTA, contacts. |
| `src/scenes/*.tsx` | One component per beat kind. Copy arrives as props. |
| `src/film/Film.tsx` | Sequences beats, hands scenes over on the cut axis (pre-roll + 8-frame overlap), drives every aspect. |
| `src/look/looks.ts` | The nine looks; `premium-warm` is the device-led default, `ui-daylight` is the flat cautionary one, `midnight-souk` is the store-launch look, `cobalt-atelier` is the data-film look. `film/style.json` names one; no ad-hoc grading in scenes. |
| `projects/cobalt-store-launch/` | 48 s Cobalt Ledger reference film: 6 beats, 24 bars, sources/pricing/payments; docs + prompt pack + manifest. |
| `src/film/Storyboard.tsx` | The storyboard sheet composition (`studio.py storyboard`). |
| `src/film/Captions.tsx` | Burned captions from `src/generated/captions.json`; 9:16 only, display copy without tashkeel. |
| `film/style.json` + `film/voices.json` | The film's declared cut and its voice catalogue (clones + verified stock ids). |
| `src/components/DemoUI.tsx` | The mock product screen. Replace with the real UI. |
| `src/audio/Soundtrack.tsx` | The mix: bed, measured VO cues, foley on the cuts. Mounted once in `Film.tsx`. |
| `scripts/make_bed.py` | Composes the bed from `timeline.json`; asserts RMS/peak. |
| `scripts/master_audio.py` | One audio gain stage over the masters; video stream copied, result re-measured. |
| `scripts/` | Orchestrator + timeline compiler + Fish bridge + bed composer + QA. |
| `scripts/ui_source.py` | Reads an app project (screens/strings/tokens) + REA capture bridge. |
| `scripts/corpus.py` | whatships + prompt-motion queries, tech axis (does this engine build it?), card pinning, corpus + tech gates. |
| `scripts/advise.py` | Measured design review; exit 1 with `--strict` on a MUST. |
| `scripts/looks.py` | Look variants as real frames, for the client to choose from. |
| `scripts/storyboard.py` | Storyboard sheet + optional per-beat stills. |
| `scripts/mcp_server.py` | MCP stdio server: 13 tools + 7 resources (film, timeline, grade, captions, ui-source, roadmap, skill). |
| `docs/ROADMAP-v2.md` | The development campaign: axes, competitor matrix, priorities, gates. |

## Hard rules

- **Never invent product facts, screens, numbers or testimonials.** Fidelity to
  the real app is the first requirement of this studio. The intake is blocking:
  if the user has not supplied it, ask; do not fill the gap. It is also measurable:
  `studio.py ui --dir <app>` gives you the truth for names, copy and tokens, REA
  gives you the pixels, and `references/fidelity-pipeline.md` is the loop. If the
  user gave you screenshots, those are the truth too.
- **Never round-trip Arabic through PowerShell/CMD.** Windows consoles corrupt it
  (cp1256). Write `\u`-escaped or UTF-8 files with Python, and run Python with
  `PYTHONIOENCODING=utf-8`.
- **Never commit `.env`.** The Fish key lives there or in `FISH_API_KEY`.
- **Never trust a render's own metrics.** Probe the MP4 (`scripts/qa.py`).
- **Never claim "done" without the gate output in hand** — peak, RMS, clipped
  samples, black stretches, Arabic scan.
- **One idea per beat.** If a beat needs two headlines, it is two beats.
- **Never sell with a price line.** The CTA is «التفاصيل على الخاص» or «للحصول على
  متجرك — تواصل معنا», never «السعر على الخاص».
- **Data scenes are checked at 1:1.** A product card over a headline or a price
  panel over the sub is invisible on a contact sheet.

## Extending

- **New look** → add a direction to `references/visual-direction.md` with its
  palette, type, motion and fail-mode, then build it as a scene variant.
- **New platform** → `references/platform-specs.md` + a new `<Composition>` in
  `src/Root.tsx`; add the aspect to `RENDERS` in `scripts/studio.py`.
- **New voice model** → `scripts/voice.py` takes `--model`; keep `s2.1-pro-free`
  as the default so the repo stays runnable without spend. Add the id to
  `film/voices.json` only after a real TTS + ASR round-trip (`references/voices.md`).
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

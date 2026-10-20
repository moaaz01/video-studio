## 2.0.0 — 2026-10-20

The campaign: everything on `docs/ROADMAP-v2.md`, built and measured step by step.
Four gates now decide whether a film is finished — the compiler, the design
review, the golden briefs, and the pixels themselves (safe areas, capture hashes).

### P1-2 — a brief becomes a plan and a shot list (done)

- `scripts/shotlist.py` compiles a short Arabic brief into a `film.json`-shaped
  plan plus a shot list. Rules are code: 120 BPM grid, 15-22 bars, hook <= 4.5 s,
  no adjacent beats of the same kind, a reading budget imported from `advise.py`
  and `make_timeline.py` (never copied), stat beat only when the brief states a
  number, CTA last line carries the brief's own handle.
- Fixture `examples/shotlist/brief-device.md`: 5 beats, 16 bars, **32.00 s /
  960 frames**, compiles with `--strict`, `advise` **95/100, MUST 0**.
- It imports the reviewer rather than re-implementing it, and refuses to write a
  plan that fails the floor.

### P1-1 — real capture: procedure and gate, blocked by the machine (honest)

- `docs/CAPTURE.md` records the exact `adb` procedure (frozen animation clocks,
  `screencap` for a screen, `screenrecord` for a moving beat) and the manifest
  entry each capture needs.
- `scripts/provenance.py --strict` verifies declared captures: file exists,
  SHA-256 matches, beat exists, package matches the scanned app. Proven by a
  control: a wrong hash fails (exit 1), the corrected hash passes.
- **Not done, and not faked:** `adb devices` lists nothing on this machine and the
  repository holds no real app screenshots, so no capture is declared. The film
  says "every screen is a reconstruction" instead of claiming otherwise.

### P1-3 — lens pass: deferred with a reason

`@remotion/effects` (`lens-blur`, `chromatic-aberration`, `light-leak`, `glow`)
only runs on canvas/WebGL layers, and `<HtmlInCanvas>` needs a Chrome flag this
renderer does not set. A DOM approximation of depth of field would be a fake
blur on a live UI, which is the one thing this studio refuses — so the motion
blur (180-degree shutter, measured 1.93x cost) is the optics we ship, and the
real lens pass waits for the canvas path.

### P2-2 — MCP resources, and the new verbs (done)

- `resources/list` + `resources/read` for `studio://film`, `timeline`, `grade`,
  `captions`, `ui-source`, `roadmap` and `skill`: an agent can read the studio's
  state without a render and without hard-coding a path. Unknown URIs return
  `-32602`; the wire protocol is still `2025-06-18`.
- Five tools added, all verified by calling them over the wire:
  `captions` (generate + check), `safe` (safe-area gate), `shotlist`,
  `grade` (regenerate curves), `evals` (score the golden briefs).
- Measured: 13 tools listed, 7 resources listed, `studio://film` reads 2189
  chars, unknown resource rejected, `captions`/`safe`/`evals` return
  `isError=false` with their real output.

### P1-4 — captions that are timed, not typed (done)

- `scripts/captions.py` derives cues from the compiled film (never a second list)
  and writes `src/generated/captions.json` plus wide/vertical `.srt`.
  Timing: beat start, beat end minus a 6-frame tail, measured VO takes precedence
  when `--vo` is supplied; cues never touch (2-frame gap) and the script asserts it.
- Line length is capped at 34 (wide) / 22 (vertical) non-space characters; long VO
  splits into consecutive cues inside the same beat instead of shrinking type.
- `src/film/Captions.tsx` is a pure function of the frame (no timers, no backdrop
  filter), mounted outside `FilmGrade` so the grade cannot tint the white type.
- Social masters (9:16, 4:5, 1:1) burn captions in; the wide film stays clean
  unless asked. The vertical caption plate sits above the Reels UI band
  (`safe_area.py --preset reels` on a caption frame: 0.0%).
- `--check` re-reads the SRT and verifies monotonicity, overlap, and that cue
  count matches the JSON: 10 cues agree at 30 fps.

### P2-1 — every aspect is a layout (done)

- New masters: `Portrait4x5` (1080x1350) and `Square1x1` (1080x1080), same film,
  same scenes. `Device` recomputes its card from the canvas, so 4:5 is a real
  layout and not a crop that eats the Arabic copy.
- The vertical master now lays out inside the Reels/Shorts/Stories safe box
  (150/300 px at 1920): device copy and the hook's brand line moved out of the
  platform UI band.
- `scripts/safe_area.py` measures the result on pixels: corner energy
  (`|dL/dx|*|dL/dy|`) inside the platform bands as a share of the frame.
  Measured before/after on the vertical device beat: **35.2% -> 0.0%**
  (CTA 3.5%), and a synthetic violation still fails at 11.8%, so the check is
  not dead. Presets: reels, shorts, story, feed.
- Verified by rendering all four masters and reading them, not by assertions.

### P0-3 — the grade comes from the palette (done)

- `scripts/lut.py` reads `src/theme.ts`, derives per-channel transfer curves from
  the parchment/ink anchors (highlights lean to parchment, shadows to ink) and
  writes `src/generated/grade.json`. `FilmGrade` applies them as a real
  `feComponentTransfer` + `feColorMatrix` filter instead of a CSS approximation.
- The same maths also emits 33-cube `.cube` LUTs into `public/luts/` (gitignored,
  regenerated in 0.9 s) so the day `HtmlInCanvas` ships, `lut()` gets a
  palette-faithful LUT rather than a downloaded one.
- Parity is measured, not asserted: the `GradeLab` composition renders 16 neutral
  steps through the filter and matches the generator within **1 code value**
  (mean 0.46) — i.e. 8-bit rounding only.
- White protection is a fidelity decision: the earlier CSS grade pushed the app's
  paper surfaces to 255; the curve keeps them at 251. Curve grade also renders
  faster than the CSS stack on this laptop (12.6 s vs 17.2 s for 20 frames).

### P0-2 — the score floor and golden briefs (done)

- `advise.py --min-score N` fails the build below a score; CI now runs
  `advise.py --strict` on the shipped film (no MUST) and
  `evals/run_evals.py --min-score 90` on three golden briefs.
- `evals/briefs/`: device film, launch/kinetic, Arabic editorial. Each must satisfy
  the schema, compile through `make_timeline.py --strict`, and score at or above
  the floor. Current scores: 100, 100, 95 (the 95 is the emerald end card's
  large-text-only contrast, caught on purpose).
- Writing the evals found a real bug: the advisor's bar-to-frame arithmetic was
  wrong (it implied 2 frames per bar instead of 60), so any film that declared
  `frames` failed a check it should have passed. Fixed, and the demo film is
  unaffected because it declares no `frames`.
- `studio.py eval` runs the harness.

### P0-1 — 180-degree shutter (done)

- `look.motionBlur` is now part of the look: 3 samples for `cinema-warm` and
  `vivid-launch`, 2 for `ink-noir`, 0 for `paper-clean`. 3 samples at 1080p cost
  **1.93x** render time on this laptop, not 3x.
- `Camera` gains a 7-frame accent (fast settle) so the shutter has motion to
  smear; without motion, motion blur is decoration.
- Verified on the same look with blur on/off: mean frame difference 0.95-1.34/255,
  exposure unchanged within +/-0.24 luma (the additive sample blend normalises).
- `--props '{"blur":0}'` disables it per render, so a client can compare.

## 1.2.0 — 2026-10-20

The cinematic and agentic pass. Research first (primary sources only), then a
working slice of it.

### Added

- **The look system** — `src/look/`: four named presets (`cinema-warm`,
  `paper-clean`, `ink-noir`, `vivid-launch`) with grade, animated grain, vignette,
  bloom and letterbox; `film.look` declares one per film. `@remotion/effects`
  4.0.537 installed (70+ entry points) for the next optics layer.
- **The camera** — one move per beat (`push-in`, `settle`, `drift`), Perlin
  handheld, pure function of the frame so a still equals the video frame.
- **`scripts/looks.py`** — the same frame in every look, for the client to pick
  from pictures. Verified: two looks differ by mean 27.5/255 per channel.
- **`scripts/storyboard.py`** + a `Storyboard` composition — one sheet of real
  panels with the VO text, rendered by the engine, so the Arabic is shaped exactly
  as it will ship.
- **`scripts/advise.py`** — measured design review: reading time vs beat duration,
  WCAG contrast from the theme tokens, adjacent beat kinds, CTA reachability, look
  validity, frame arithmetic. Graded MUST / SHOULD / COULD, `--json`, `--strict`.
- **`scripts/mcp_server.py`** — dependency-free MCP server (stdio, JSON-RPC 2.0,
  protocol `2025-06-18`) exposing eight studio tools to any agent.
- **`docs/ROADMAP-v2.md`** — the campaign: five axes, competitor matrix,
  prioritised initiatives with acceptance gates, explicit non-goals, sources.
- **`references/cinematic-look.md`** — the look system's rules, and why the LUT is
  ours rather than borrowed.

### Verified on this machine

- `tsc --noEmit` clean; `py_compile` clean for every script.
- Storyboard sheet: 1920x1080, 5 panels, VO captions.
- MCP: `initialize` ok, 8 tools listed, `studio_doctor` executed, unknown tool
  rejected with `-32602`.
- Advisor: demo film 42.0 s, score 85/100, 0 MUST, 3 SHOULD.

# Changelog

## 1.1.1 — 2026-10-20
- `scripts/install_check.py`: proves the install instead of trusting it — every
  discovery path must be a link to this repo, `SKILL.md` must parse, and ten files
  must be readable *through* the link. Exit 1 on any gap. `-Verify` in
  `install.ps1` runs it; `install.sh` runs it too.
- `install.sh` output was mojibake (an em dash written as UTF-8, read as cp1252);
  now ASCII-clean, like `install.ps1`.
- README/AGENTS: the verify step is part of the install, not a footnote.

## 1.1.0 — 2026-10-20
Sources wired in as tools instead of reading material.

- `scripts/ui_source.py` — scans a real app project into `film/ui-source.json`
  (Compose screens, nav routes, every string in every locale, colour tokens, font
  families) and bridges to REA for device capture and APK string decoding.
  Verified against the StudyAI Android project: `com.studyai.app`, 100 screens,
  6 routes, 40 strings x 2 locales, 50 colours, Tajawal family.
- `scripts/corpus.py` — whatships.com public index (2 652 published launch films),
  prompt-motion.com taxonomy (11 tags with live counts), card pinning and the
  phase-2 gate `check --min N`. Three cards ship pinned.
- `references/fidelity-pipeline.md` — scan -> capture -> rebuild -> compare at 1:1,
  with the px/dp math that keeps a device frame honest.
- `references/prompt-anatomy.md` — the six-block prompt structure the corpus
  publishes, and the four build rules that transfer to Remotion.
- `film/brief.template.md` — the brief is now those six blocks; `studio.py new`
  scaffolds from it.
- Sources added and verified: Remotion's resource index, OpenFilm, Remotion Bits /
  Onda / remocn / snapcn, video-shotcraft, remotion-qa, audio-bed-check, Mixkit,
  Freespeech/Freesound licensing notes, Google Fonts Arabic.
- SKILL.md, AGENTS.md, README and CI updated: fidelity is measured, not remembered.

## 1.0.0 — 2026-10-20
- First public cut of `video-studio`: a timeline-driven Remotion engine for
  Arabic-first product films, packaged as an Agent Skill.
- Eight reference notes: visual direction, reference sources, audio & voice,
  Arabic type, motion grammar, platform specs, QA gates, brief recipes.
- Fish Audio voice bridge (`scripts/voice.py`) with a hand-rolled WAV reader that
  survives placeholder RIFF sizes, plus loudness-aware QA.
- Orchestrator (`scripts/studio.py`) with `doctor / timeline / voice / score /
  still / render / qa`, and installers for DSH, Claude Code, opencode,
  OpenClaw and Hermes Agent.
- Worked example: the 118 s StudyAI promo, 16:9 + 9:16.

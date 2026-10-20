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

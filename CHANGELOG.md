# Changelog

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

# Roadmap v2 — the campaign

Written 2026-10-20. Sources are primary only (official docs, package manifests,
specs, repositories) because the studio's own rule is that a claim about quality
must be checkable. Search-engine articles were used for leads, never as evidence.

## How a candidate gets admitted

Four tests, in order. A feature that fails any of them is not built, however
impressive it looks in a demo:

1. **Measured**: it moves a number the studio already gates on (fidelity match,
   reading time, contrast, render determinism, loudness, agent call latency).
2. **Deterministic**: same input, same frame, byte-identical output. Anything
   that samples randomly per render is out unless the seed is explicit.
3. **Callable**: an agent can trigger it and read the result as text.
4. **Cheap**: it does not make a 42-second render slower than a coffee.

## What shipped in v1.2.0 (evidence, not intent)

| Capability | Command | Evidence |
| --- | --- | --- |
| Named film looks (grade, grain, vignette, bloom, letterbox) | `film.look` in `film.json` | two looks rendered from one frame differ by mean 27.5/255 per channel |
| One camera move per beat, Perlin handheld | built into `src/look/Camera.tsx` | still at frame 200 renders with the push, `tsc` clean |
| Look variants for the client to choose from | `python scripts/looks.py` | `out/looks/cinema-warm-f200.png`, `ink-noir-f200.png` |
| Storyboard sheet with real Arabic panels | `python scripts/storyboard.py` | `out/storyboard/sheet.png`, 5 panels, VO captions |
| Measured design review before rendering | `python scripts/advise.py` | demo film: 42.0s, score 85, 0 MUST, 3 SHOULD |
| MCP server so any agent can call the studio | `python scripts/mcp_server.py` | initialize ok, 8 tools listed, `studio_doctor` executed, unknown tool rejected |
| 180-degree shutter, opt-in per look | `look.motionBlur` | 3 samples cost 1.93x; same-look A/B differs by 0.95-1.34/255 with exposure within 0.24 luma |
| Score floor + golden briefs in CI | `python evals/run_evals.py --min-score 90` | 100 / 100 / 95 on device, launch and editorial plans |
| Palette-derived grading, not CSS | `python scripts/lut.py` | `GradeLab` matches `grade.json` within 1 code value (mean 0.46, 8-bit rounding) |
| 1:1 and 4:5 as real layouts | `Portrait4x5`, `Square1x1` | stills rendered and read; the phone card recomputes from the canvas |
| Measured platform safe areas | `python scripts/safe_area.py --preset reels` | vertical device beat 35.2% -> 0.0%, CTA 3.5%, synthetic violation 11.8% (fails) |
| Captions with real timing | `python scripts/studio.py captions --check` | 10 cues agree with captions.json at 30 fps; max line 29/21 chars; 2-frame gaps |

The look is not a filter preset bolted on top. It is derived from what the app
already does — warm paper, ink text, one emerald accent — so the film's grade and
the product's palette agree. That is the whole argument for a look system rather
than a LUT someone liked on a moodboard.

## Where the leverage actually is

Five axes, ranked by quality-per-hour. The score is my estimate of what the
viewer notices, not what is fun to build.

### Axis 1 — Optics and finishing (highest leverage, mostly unbuilt)

Remotion 4.0.537 ships `@remotion/effects` with 70+ post-processing effects
(`lut`, `noise`, `glow`, `lens-blur`, `chromatic-aberration`, `vignette`,
`shadows-highlights`, `color-correction`, `light-leak`, `starburst`,
`page-turn`, `evolve`, `createEffect` for Canvas2D/WebGL2/WebGPU shaders). The
package is now installed here, verified at the same version as `remotion`.

What is left to make it cinematic rather than merely graded:

- **A real 3D LUT** (`lut()`) generated from our own palette, not a stock .cube:
  a film print emulation we control, applied through `<HtmlInCanvas>`.
- **Lens character**: `lens-blur()` for depth of field on the phone screen,
  `chromatic-aberration()` at 0.5-1px on frame edges only, `light-leak()` as a
  motivated transition instead of a wipe.
- **Halation**: `glow()` under threshold, so the emerald CTA blooms like a lit
  screen rather than a flat rectangle.
- **Motion cadence**: 180-degree shutter. `@remotion/motion-blur` gives
  subframe sampling; at 30fps that is 2-3 samples, at 24fps it starts reading as
  film. This is the single change most likely to make the output stop looking
  like a slideshow.
- **Anamorphic option** for hero shots: 2x horizontal streak, 2.39:1 letterbox
  (already a look field), vertical flares.

Cost: medium. Risk: `HtmlInCanvas` is a WICG proposal (`isSupported()` check
required) — it must degrade to the CSS grade we ship today, never blank a frame.

### Axis 2 — Real capture instead of reconstruction (highest fidelity)

The current pipeline rebuilds app screens in React from `film/ui-source.json`.
That is why fidelity is honest but slow, and why a screen the app has but the
film does not yet model is a gap. Remotion ships `Recorder` and `Canvas Capture`;
REA already captures Android screens here. The move: for beats where the only
truth is the running app, capture the device, then composite the capture inside
the same phone frame with perspective, glare and a screen-space grade.

Result: zero reconstruction error on those beats, and the remaining beats stay
code (fast, editable). Rule unchanged — a capture is a source of truth, so it
gets the same provenance record as a screen.

### Axis 3 — Editorial intelligence (partly shipped)

`advise.py` now measures reading time against beat duration, contrast from the
theme tokens, rhythm (adjacent beat kinds), CTA reachability, look validity and
frame arithmetic. Next: **the loop**. Advise → agent fixes → advise again until
the score floor is met, with a golden set of briefs in `evals/` so the studio
cannot silently regress. And a **shot list generator**: given a brief, propose
N beats with duration, camera move, transition and reference card attached.

### Axis 4 — Agent-native (shipped, expandable)

MCP over stdio is live with 8 tools; `SKILL.md` teaches the workflow; five
discovery paths are verified. Worth knowing: Remotion **deprecated its own MCP
server** and now points agents at Agent Skills (`npx skills add
remotion-dev/skills`, covering markup, render, captions, maps, interactivity).
That validates the two-layer split we already have — skill for judgement, MCP for
execution — and warns against betting on a vendor MCP.

Next: expose the studio as a *resource*, not only tools (film.json, ui-source,
corpus index), so an agent can read state without shelling out; and add an
`evals/` harness with three golden briefs scored by (a) deterministic gates,
(b) advise score, (c) a rubric judge.

### Axis 5 — Delivery and Arabic craft (cheap wins)

- Multi-aspect auto-reframe (9x16, 1x1, 4x5) from the same timeline; platform
  spec table already exists in `references/platform-specs.md`.
- Burned captions + SRT, forced alignment from the VO stem.
- Thumbnail/cover stills per platform, A/B pairs for the client.
- Arabic: bidi/RTL test harness (no orphan letters, no clipped tashkeel),
  numeral policy, and a tashkeel audit that fails the build if a VO line loses
  its diacritics.

## Competitor matrix

| Tool | Strength | What it cannot do for us | Verdict |
| --- | --- | --- | --- |
| OpenFilm (open-source editor) | real editing UI, timeline, export | no fidelity contract to a live app, no Arabic gates | borrow interaction ideas only |
| Revideo / Motion Canvas | code-driven motion, good DX | not Remotion-compatible; no effects stack | skip |
| Shotstack / JSON2Video | API-rendered templates, scale | template look, weak typography control | skip |
| Canva / CapCut | speed for non-designers | cannot reproduce our UI or gates | not a competitor for this work |
| Runway / Veo / Sora | generative b-roll, impossible shots | cannot be trusted with product UI or claims | **gated** option: plates and textures only, never UI, always provenance-tagged |
| Remotion (our base) | deterministic React render, effects, Lambda | no editorial judgement, no brand gates | keep, go deeper |

The differentiator is not "we can render video". It is: **fidelity you can audit,
Arabic that is shaped correctly, and an agent that measures instead of guessing.**

## Prioritized initiatives

| # | Initiative | Axis | Effort | Gate it must pass |
| --- | --- | --- | --- | --- |
| P0-1 | 180-degree shutter + motion blur at 2-3 samples | 1 | S | no still regressions; render time +<35% |
| P0-2 | Advise loop with score floor in CI | 3 | S | demo film >= 90, 0 MUST |
| P0-3 | LUT generated from our palette + HtmlInCanvas fallback | 1 | M | identical output when unsupported |
| P1-1 | Real-capture beats (Recorder/Canvas Capture) | 2 | M | capture provenance recorded in film/ui-source.json |
| P1-2 | Shot list generator from brief | 3 | M | 3 golden briefs produce valid timelines |
| P1-3 | Lens pass: DOF, edge aberration, motivated light leak | 1 | M | measured sharpen/softness budget per beat |
| P1-4 | Captions + SRT + forced alignment | 5 | S | caption timing within 120ms |
| P2-1 | Auto-reframe 1x1/4x5, per-platform titles | 5 | M | safe-area checker per aspect |
| P2-2 | MCP resources + evals harness | 4 | M | agent reads state without shell; 3 briefs scored |
| P2-3 | Cloud render (Lambda/Cloud Run) | 4 | L | 4K render under 15 min |
| P2-4 | Generative plates adapter (Veo/Sora/Flux), gated | 2 | L | provenance + license + "no UI" lint |

## Explicit non-goals

- No AI-generated product UI. Ever. A screen must trace to a real screen.
- No automatic "make it viral" templating: the studio sells fidelity, not trends.
- No vendor lock to a single generative video API.
- No replacing the deterministic renderer with a generative one; generated
  material enters as *plates* with metadata, never as the film's spine.
- No dashboard. The surface is a command line and a skill, because that is what
  agents call.

## Sources

- Remotion effects: <https://www.remotion.dev/docs/effects> · HTML-in-canvas:
  <https://www.remotion.dev/docs/html-in-canvas> · shaders:
  <https://www.remotion.dev/docs/shaders> · motion blur:
  <https://www.remotion.dev/docs/motion-blur/> · transitions:
  <https://www.remotion.dev/docs/transitioning>
- Remotion Agent Skills (12 skills, `npx skills add remotion-dev/skills`):
  <https://www.remotion.dev/docs/ai/skills> · coding agents:
  <https://www.remotion.dev/docs/ai/coding-agents>
- Package manifest `@remotion/effects@4.0.537` (70+ entry points) verified
  locally in `node_modules`.
- MCP specification (stdio transport, JSON-RPC 2.0, protocol revision
  2025-06-18 implemented here): <https://modelcontextprotocol.io/specification>
- OpenFilm: <https://github.com/openfilm/openfilm>
- Launch-film corpus: <https://whatships.com/> · motion taxonomy:
  <https://prompt-motion.com/> · REA device analysis:
  <https://github.com/morluto/rea>

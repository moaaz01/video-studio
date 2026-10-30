# Formats — choose the film before you write the film

The studio is not one template. It is a set of film forms, each with its own clock,
scene grammar, type rules and gates. The **director** reads the intake and picks
one; this page is the map it uses.

| If the product is… | and the job is… | form | direction | template / grammar |
|---|---|---|---|---|
| a game | launch / hype | **kinetic** | `#kinetic` | `references/templates/kinetic-launch.json` |
| an app with real screens | launch / explain | **device** | `#device` | store/device scenes, one whole screen per beat |
| a SaaS product | explain a mechanism | **explainer** | `#editorial` / `#diagram` | `references/templates/explainer-reel.json` |
| a SaaS product | launch | **ui-film** | `#ui-film` | real UI crops, one variable per beat |
| a store / service | sell / explain the economics | **data-film** | `#data-film` | `references/templates/cobalt-ledger.json` + `PLAYBOOK-cobalt-ledger.md` |
| a physical product | sell | **editorial** | `#photo` / `#editorial` | real photos, ink on paper |
| a course / teacher | teach | **explainer** | `#editorial` | one sentence + one card per beat |
| a developer tool | launch | **code** | `#code` | kinetic + real source/terminal |
| a personal brand | announce | **editorial** | `#editorial` | one claim, one face, one action |

The director is a rules engine, not a taste oracle: it explains every choice and
records every override. See [`../director.md`](../director.md).

## The two new forms

- [`explainer-reel.md`](explainer-reel.md) — voice-led, word-synced, one card per
  sentence, 9:16 first, all four aspects exported. From the Claude explainer guide,
  rebuilt on the studio's measured VO and safe-area gates.
- [`kinetic-film.md`](kinetic-film.md) — beat-grid type, ground flips, whip/flash
  cuts, one idea per shot. From the Scenario kinetic-film skill, rebuilt for Arabic
  and for this renderer (one shaped text node per frame, no letter splitting).

## The intake comes first

No form is chosen from a hunch. The agent asks the questions in
[`../intake.md`](../intake.md), fills `film/intake.json`, and only then runs the
director. A missing product image is not a reason to invent one; it is a reason to
ask.

```bash
python scripts/studio.py intake questions --format explainer
python scripts/studio.py intake check --intake film/intake.json
python scripts/studio.py director --intake film/intake.json
```

## Every form ships the same matrix

One timeline, four canvases: `9x16`, `16x9`, `4x5`, `1x1`. The default export is
all four; platform-specific cuts are a subset, not a separate edit. See
[`../platform-matrix.md`](../platform-matrix.md).

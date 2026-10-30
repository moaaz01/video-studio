# Director — the studio chooses the form, then explains why

The director is a transparent rules engine. It reads `film/intake.json`, scores
the product type, goal, assets, emotion, platforms and duration, and writes a
**treatment**: format, direction, clock, delivery matrix, required assets, why, and
the alternatives it rejected.

It does not render, and it does not write beats. It produces the proposal the agent
shows the user before the expensive part.

## Run it

```bash
python scripts/studio.py director --intake film/intake.json
python scripts/studio.py director --intake film/intake.json --json
python scripts/studio.py director --intake film/intake.json --format kinetic
python scripts/studio.py director --intake film/intake.json --direction '#editorial'
```

Outputs `film/treatment.json` and `film/treatment.md` (override with `--out` /
`--md`, overwrite with `--force`).

## The routing table

| product_type | goal | first choice | why |
|---|---|---|---|
| game | launch/announce | **kinetic** | the claim is the spectacle; no UI to show |
| game | explain | **kinetic** | one idea per beat beats a feature list |
| mobile-app | launch/explain | **device** if screens, else **explainer** | the real screen is the proof |
| saas-web | explain/teach | **explainer** | a mechanism needs sentences and cards |
| saas-web | launch | **ui-film** | the UI language is the story |
| store-service | sell/explain | **data-film** | sourcing/margin/payments need a data scene |
| physical-product | sell | **editorial** | real photos, ink on paper |
| course-education | teach | **explainer** | one sentence, one card |
| personal-brand | announce | **editorial** | one claim, one face, one action |
| api-devtool | launch | **code** | source/terminal as texture |
| api-devtool | explain | **explainer** | the mechanism, then the code |

Assets override the default: no screenshots means no device film; no key art means
no picture-led kinetic film. Emotion nudges the pace: `hype` → kinetic, `premium` /
`calm` → editorial. The rules and fallbacks are in `scripts/director.py`
(`RULES`, `BY_PRODUCT`, `BY_GOAL`); change them there, not in a prompt.

## The treatment

```json
{
  "format": "explainer",
  "film_format": "explainer",
  "direction": "#editorial",
  "bpm": 120,
  "duration_s": 50,
  "primary_aspect": "9x16",
  "targets": ["9x16", "16x9", "1x1", "4x5"],
  "voice": "fish",
  "structure": [{"beat": "hook", "kind": "explainer", "bars": 4}],
  "assets_required": ["screenshot/product_shot", "logo"],
  "why": ["..."],
  "confidence": 0.79,
  "alternatives": [{"format": "kinetic", "when": "..."}],
  "missing_intake": ["product_type"]
}
```

- `format` is the creative form; `film_format` is what `make_timeline.py` accepts
  (`launch`, `explainer`, `kinetic`). A `data-film` is a `launch` timeline with the
  Cobalt grammar; a `device` film is a `launch` timeline with the device grammar.
- `targets` is **all four masters by default**. `platform_targets` records which
  subset each platform actually uses; the exporter renders the union.
- `missing_intake` is blocking: ask the user before writing beats.
- `confidence` is a signal count, not a probability. Low confidence means ask more.

## Overrides

The user may reject the proposal. Pass `--format` and/or `--direction`; the
treatment records `overridden: true` and appends the reason. Do not silently
change the direction in the film JSON without updating the treatment.

## Approval

Show the user:

1. the one-line form + direction,
2. the clock (beat table),
3. the assets still missing,
4. the four delivery aspects.

Only after a yes: write `film/film.json`, run `timeline --strict`, and render a
still. A treatment is cheap; a render is not.

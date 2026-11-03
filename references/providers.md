# Providers, budget and the decision log

The studio renders with Remotion and owns its score and foley. Everything else
comes from a provider: voice, generated images and clips, stock, avatars,
transcription. `scripts/providers.py` picks one by score and keeps the money
honest. The catalogue is `references/providers.json`.

```bash
python scripts/studio.py providers list                       # ✓ = usable on this machine
python scripts/studio.py providers pick tts --need arabic     # rank + log the choice
python scripts/studio.py providers pick image --profile hero
python scripts/studio.py providers pick video --need offline --dry-run
python scripts/studio.py providers budget --mode cap --cap 10 --approve-over 0.5
python scripts/studio.py providers spend kling --units 8 --what "b03 b-roll" --approved
python scripts/studio.py providers ledger
```

## Scoring

Every provider has seven axes: quality, cost, speed, arabic, control, licence and
availability. Cost is scored relative to its capability: free is 5, and paid
providers sit on a log scale from 4 down to 1. Availability is 5 when the key is
in the environment or `.env`, or when the local module is installed; otherwise it
is 0. The profile weights the axes:

| profile | for |
|---|---|
| `default` | balanced; Arabic weighs as much as quality |
| `draft` | cheap and fast; storyboards, animatics |
| `hero` | the final master; quality first |
| `offline` | only what runs on this machine |

Hard needs filter the pool before any scoring. `--need arabic` keeps providers
with an arabic score of 4 or more. `offline` keeps local providers and `free`
keeps zero-cost ones. Each `pick` appends the winner, the runner-up and the
reason to `film/decisions.jsonl`. Pass `--why` when you override the ranking.

## Budget

`film/budget.json` sets a `mode`:

- `observe` records spend and never blocks.
- `warn` records spend and prints a warning past the cap.
- `cap` refuses any action that would pass the cap.

One rule holds in every mode: a single action above `approve_over_usd` needs
`--approved`. That flag is for the user's yes in chat, never for the agent's own
judgement.

## Rules that do not bend

- Generated images and clips never carry Arabic letters. The renderer sets all
  type. Ask a model for the picture only.
- Avatars and voice clones need the person's written consent, and you record it
  in the decision log.
- Stock and archive media keep their source URL and licence in `provenance`.
- Add a provider to the catalogue only after a real round-trip. Never mark Arabic
  support you have not heard or read.

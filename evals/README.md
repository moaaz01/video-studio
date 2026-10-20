# Evals

Three golden briefs, one per studio shape:

| Brief | Shape | What it proves |
|---|---|---|
| `01-device-film.json` | device film | a UI film can score 100 before it renders |
| `02-launch-kinetic.json` | launch / kinetic | short, stat-led films hold the rhythm rules |
| `03-arabic-editorial.json` | Arabic editorial | the emerald end card is caught as large-text-only contrast |

Run them:

```powershell
python evals/run_evals.py             # table, non-zero exit on any failure
python evals/run_evals.py --json      # for agents
python evals/run_evals.py --min-score 95
```

Each brief must satisfy the schema, compile through `make_timeline.py --strict`,
and pass `advise.py` with no MUST and a score at or above the floor (default 90).
CI runs this, so a change that makes good plans fail is caught before a render.

A brief is a *plan*, not a film: no brand copy is claimed, no metrics are invented.
When you add a fourth shape, add a brief and keep the floor honest.

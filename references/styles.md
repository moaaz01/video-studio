# Styles: pick one card, the engine follows

A style card (`references/styles.json`) is what stays true for **every** film in one
style: the look, palette, backdrop, motion level, the cut vocabulary, what the medium
does best (native moves) and how it fails. The story is always yours.

```bash
python scripts/studio.py craft styles list
python scripts/studio.py craft styles show data-noir
python scripts/studio.py craft styles apply data-noir --film film/film.json
```

With `--film`, `apply` writes `look`, `motion` and `transitions` into **that film's own**
`style` (inline, or the style file the film points at; sfx and other keys are kept),
sets the film's `look`, and fills `palette` + `backdrop` on gfx beats that have none.
It never overwrites a beat that already chose, and never touches another film.
Without `--film` it updates `film/style.json`.

| id | for | look · palette · backdrop |
|---|---|---|
| `data-noir` | one surprising number, economics | cobalt-atelier · midnight-amber · mesh |
| `editorial-paper` | news, history, calm explainer | paper-clean · sand-ink · topo |
| `tech-indigo` | AI, software, how a device works | vivid-launch · electric-indigo · grid |
| `money-emerald` | personal finance, business | atelier-emerald · emerald-gold · beams |
| `space-ocean` | space, earth, scale | ink-noir · ocean-cyan · flow |
| `body-dusk` | health, psychology, habits | premium-warm · sunset-plum · dots |
| `urgent-mono` | breaking, myth vs fact | ink-noir · mono-red · solid |
| `product-cobalt` | SaaS, app demo, UI film | premium-warm · paper-cobalt · mesh |
| `souk-night` | store launch, offers, Ramadan | midnight-souk · midnight-amber · beams |
| `kinetic-type` | quote, manifesto, hook reel | vivid-launch · mono-red · dots |
| `warm-cinema` | brand or device film | cinema-warm · midnight-amber · flow |
| `calm-classroom` | tutorial, course lesson | paper-clean · sand-ink · dots |

## Choosing

1. The director proposes a form (`references/director.md`); pick the style whose
   `for` matches the topic, not the one you used last time.
2. Read its `moves`: plan the one native move for the peak beat (`references/story.md`).
3. Read its `pitfalls` before the first still; `studio.py craft check` measures the
   ones that can be measured.

## A new style

Add an object to `styles.json` with every field the others have. Rules, not history:
`essence` (what reads in one glance), 3 `moves` each with what it fits, 3 `pitfalls`
of the medium. `look`, `palette`, `backdrop` and `transitions` must exist in the engine;
`tests/test_craft.py` checks that. The card-per-style idea follows Lemo-Opuscar's
`STYLE.md` method; no style text or demo was copied.

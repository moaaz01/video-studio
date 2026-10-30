# Platform matrix — one timeline, four canvases

A Reel is not finished when the 9:16 file exists. The same edit must survive the
feed, the timeline and the square card without a second hand-cut. The studio
renders the union of the requested platforms from the **same compiled timeline**:

| aspect | master | pixels | used by |
|---|---|---|---|
| `9x16` | `Studio9x16` | 1080×1920 | Reels, TikTok, Shorts, Stories, Snapchat |
| `16x9` | `Studio16x9` | 1920×1080 | X, YouTube, LinkedIn, Facebook |
| `4x5` | `Portrait4x5` | 1080×1350 | Instagram/Facebook feed |
| `1x1` | `Square1x1` | 1080×1080 | X, LinkedIn, feed cards |

**The default export is all four.** `studio.py render` and `studio.py export` both
produce them unless you name a subset. A platform plan is a subset of the same
masters, never a separate edit.

## Platform presets

| platform | aspects | safe preset | max length |
|---|---|---|---|
| X | 16:9, 1:1 | feed | 140 s |
| Instagram | 9:16, 4:5, 1:1 | reels | 90 s |
| TikTok | 9:16 | reels | 60 s |
| YouTube | 16:9, 9:16 | shorts | 60 s |
| LinkedIn | 1:1, 16:9 | feed | 120 s |
| Snapchat | 9:16 | story | 60 s |
| Facebook | 4:5, 9:16, 16:9 | feed | 120 s |

Safe presets are measured from the rendered still, not assumed: `reels` reserves
150 px top / 300 px bottom of 1920; `shorts` 100/260; `story` 250/250; `feed` only
the 4% margin. The verdict is a share of the frame's strong-edge energy inside the
band, not a legibility claim. Use it to catch a layout drifting into the chrome.

## Commands

```bash
# what will be rendered, and for which platform
python scripts/studio.py platforms plan --film film/film.json --platforms x,instagram

# render all four masters + safe/audio manifest
python scripts/studio.py export --film film/film.json --targets 9x16,16x9,1x1,4x5 --strict

# render only the platform set
python scripts/studio.py export --platforms instagram,tiktok --strict

# the old direct renderer also defaults to all four
python scripts/studio.py render 9x16 16x9 4x5 1x1
```

`export` compiles the timeline, renders each composition, extracts a still at
`--still-second` (default 2 s), measures the safe area, probes the MP4 and its
audio, and writes `out/exports/<slug>/manifest.json`. `--strict` fails on a safe
WARN, clipped audio, or RMS outside −24…−14 dBFS.

## Layout notes per aspect

- **9:16** — primary for explainer/kinetic; keep copy in the middle 80%; the bottom
  300 px belongs to the platform. The `Explainer` scene uses a 0.815 H footer; the
  `Kinetic` scene keeps the HUD at 0.035 H.
- **16:9** — the same scenes re-compose; type sizes are relative to `useVideoConfig`,
  not the 1080 design grid. The kinetic type is wider, the explainer column is
  capped at 1180 px.
- **4:5 / 1:1** — `FilmVertical` drives the vertical grammar; the explainer switches
  to a square column, the kinetic type scales to `W*0.24`. Check a 1:1 still before
  the render; a card that fits 9:16 can crowd a square.
- **End card** — the logo shot is the only place a hold is allowed; the exporter
  still checks it for safe-area edges.

## Files

- `scripts/platform_matrix.py` — the presets and the union.
- `scripts/platforms.py` — plan/export + manifest.
- `src/film/Film.tsx` — the four compositions share `FILM.frames`.
- `references/platform-specs.md` — the older per-platform design notes.

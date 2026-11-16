# Craft gates and the review loop

`studio.py craft` turns the "does this look generated?" judgement into measured
findings, before any render. Three levels, one line each:
`where · problem → exact change`.

- **P0** breaks the read: text too small for a phone, a line on screen far too short
  to read, two glowing accents, Arabic-Indic digits. `--strict` exits 1.
- **P1** weakens the film: no stagger, flat ground, a breathing (pulsing) title, a
  dead stretch (> 3 s with nothing arriving and no voice), a line a little too short.
- **P2** polish: no depth (one `z`), nothing leaves, flat type scale (< 3×), one
  transition kind everywhere (a film uses 2–4), the same title entrance in every beat.

```bash
python scripts/studio.py timeline --strict
python scripts/studio.py craft check --strict --review film/REVIEW.md
```

## The numbers (defaults; a reference you were given wins)

| rule | value | why |
|---|---|---|
| Arabic read time | 0.6 s + 0.4 s per word | from the studio's measured ~21 spoken words per 10 s |
| min text height | 2.6% of the frame height (28 px at 1080, 50 px at 1920) | phone legibility; measured on `text` layers. Kit labels (card sub, bar labels) use fixed engine sizes: check them on the 9:16 still |
| dead stretch | > 3 s with nothing new and no VO | parks the eye |
| type scale | hero ≥ 3× the label | hierarchy reads at thumbnail size |
| stagger | 0.12–0.5 s; next element starts when the last is 30–50% in | sequential is robotic, simultaneous is cheap |
| accents | one glow per frame | two accents cancel |

## The review loop (after the render)

1. **Measure:** `craft check`, `qa --stills 8`, and `motion <mp4>` where a full ffmpeg is installed
   (the bundled one lacks the rawvideo muxer it needs); trust numbers over the eye.
2. **Look like a stranger:** describe each beat still in one sentence naming every
   object. An object you would have to explain is a P0.
3. **Questions, one pass each:** does it read as what it is? does the subject separate
   from the ground? crops and text under platform UI (`safe`)? timing for a first-time
   viewer? which tells are on screen? do the stills alone tell the story? can every
   line be read on the 9:16 sheet?
4. **One fix round:** text first, then timing, then detail; re-check only what changed.
5. **Deliver `REVIEW.md`** (`--review` writes the skeleton): creative calls and the
   storylines not built, what was measured vs only looked at (sound is measured, not
   heard), the weakest shot, warnings kept on purpose. The next session reads it first.

Never score the film out of 10: a score finds nothing to fix.

## Learning from a reference video

```bash
python scripts/studio.py craft breakdown path/to/reference.mp4
```

Writes `out/breakdown/<name>/BREAKDOWN.md` and one still per shot: measured cut times,
shot lengths and pace. Fill the empty columns by looking at each still (made with
code, footage, screen capture or AI; how the type enters; the camera move; the sound
at the cut), then pin the moves you borrow with `studio.py refs add`. Borrow moves,
never assets. The shot-by-shot method follows rea-video (Apache-2.0); this is a
lightweight local version with no model calls. For a full AI/live/3D verdict, run
rea-video itself on the clip and feed its findings into the corpus card.

Sources of these ideas: HyperFrames `review.md`, `motion.md`, `captions.md`
(Apache-2.0); impeccable's deterministic slop detector (Apache-2.0); unslop's
audit-then-direction method (CC BY 4.0, Damir Sokolovsky). Restated, not copied.

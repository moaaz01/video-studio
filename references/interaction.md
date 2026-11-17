# Interaction: clicks, presses, keys and the sounds that follow them

Not every film needs UI sounds. A tutorial is learnt through its clicks; a data story
needs one tick when the number lands; a talking head needs none. The studio decides
from **what is on screen** and the film's **interaction level**, never from habit.

```bash
python scripts/studio.py foley suggest            # level for this film, with the reason
python scripts/studio.py craft styles apply <id> --film film/<slug>.json   # sets it from the style card
python scripts/studio.py timeline --strict        # compiles the cue sheet into timeline.json
python scripts/studio.py foley sheet              # every sound the film will make, frame by frame
python scripts/studio.py craft check              # density, monotony, "no level" findings
```

## The levels (`style.interaction`, `references/interaction.json`)

| level | for | what sounds | cap / 10 s |
|---|---|---|---|
| `none` | real footage, talking head | only cues the film names | 0 |
| `subtle` | data stories, editorial, calm explainers | number landings, bursts, chapter cuts only, soft clicks | 4 |
| `standard` | launches, explainers with UI, motion graphics | every cut (rotated takes), clicks, cards, badges, counters | 7 |
| `rich` | UI films, tutorials | every click and key, results, cuts | 10 |
| `punchy` | kinetic type, hook reels | hits on cuts and landings, no UI sounds | 8 |
| `legacy` | films compiled before levels | the original fixed mix, reproduced exactly | — |

`foley suggest` picks from the beats (footage only → `none`; a third tutorial →
`rich`; mostly kinetic → `punchy`; mostly gfx → `subtle`), and `craft check` reports a
film with no level as P2 with that suggestion. Style cards carry a level.

## Events, not decoration

The compiler (`scripts/foley.py`) reads these events from the beats; a level gives
each one a stem and gain or leaves it silent:

| event | where it comes from | lands on |
|---|---|---|
| `click` | a tutorial step (not `hover`/`scroll`, not a step with `keys`) | the step's `at`, the frame the cursor presses |
| `keys` | a step's `keys: ["Ctrl","K"]` | each keycap going down, 0.1 s apart |
| `counter_land` | gfx `counter` | `at + dur` (default 1.2 s): the number settles |
| `card_land` / `badge_land` | gfx `card` / `badge` | entrance + 2 frames |
| `burst` | gfx `burst` | its `at` |
| `stat` / `cta` / `device` | beat kind | the beat start (device +14 frames) |
| `cut` | every hand-over | the hand-over's fastest frame; `every: "chapter"` sounds only a change of beat kind or a beat with `data.chapter: true` |
| `named` | `sfx` the film lists on a beat | as written, never dropped |

Rules the compiler enforces:

- **Peak on the picture.** Each stem's measured transient (`references/sfx-catalog.json`,
  `foley measure`) lands on the event frame, not the file's first sample. A whoosh with
  its peak 151 ms in starts 151 ms early.
- **Rotate takes.** Repeated stems cycle the level's `rates` (e.g. 1.0 / 0.96 / 1.04
  playback rate), and cuts cycle 2–3 whoosh stems: the same whoosh on every cut is the
  commonest tell.
- **No flams, a ceiling.** Two cues closer than 3 frames keep the higher priority one;
  the level's cap per 10 s keeps clicks and results over card pops and cuts.
- **One loudness family.** Every stem is peak-normalised to −3 dBFS; gains stay within
  0.26–0.6 so a click never shouts over the voice.

## The cursor and the press (`src/components/Cursor.tsx`)

Tutorial steps use the shared cursor:

- **Sized for video**: about 4.5% of the long side; an actual-size arrow vanishes.
- **A real tap**: press to 0.84 in 0.1 s, pivot at the arrow tip, release in 0.22 s.
  The ripple, the target and the sound start on the same frame.
- **The target presses with real pixels**: with a `box`, the capture's own pixels in
  that box dip to 0.94 and darken, then spring back. Nothing is redrawn, so the press
  can only show the real app.
- **Zoom by action** (Screenize-style): `click` 1.8, `type` 2.4, `scroll` 1.25, `drag` 1.5,
  `hover` 1.6, unless the step sets `zoom`.
- **Keycaps**: `keys` shows a shortcut under the screen, each key going down in turn.

```json
{"at": 1.0, "x": 0.803, "y": 0.326, "label": "اضغط «اطلب الآن»", "box": [0.697, 0.309, 0.211, 0.034]},
{"at": 2.6, "x": 0.5, "y": 0.104, "action": "type", "keys": ["Ctrl", "K"], "label": "ابحث عن خدمة"}
```

Read `x`, `y` and `box` off the real capture at 1:1. A screen change after a click
needs a **second real capture** (the next beat): typed text, toasts or opened menus
drawn over a capture are invented UI, which this studio does not ship.

## Not wired yet

- The store/product scenes (`src/store/scenes.tsx`, `store/design.tsx`,
  `store/screens/owner.tsx`, `Explainer.tsx`) draw their own taps; they do not use
  `Cursor.tsx` and emit no `click` event, so their foley is the level's cut/stat/cta set.
- `flood` and `iris` open from preset origins, not from the last click point.

## What is not here, on purpose

- Per-letter typing of Arabic: the shaping rule forbids letter splits; show the real
  result capture instead.
- A cursor on a talking head or a data story: a pointer with nothing to press is noise.
- Generated UI sounds: the 42 stems in `public/audio/sfx/` are measured and licensed;
  a new stem goes in only with its source in `THIRD_PARTY_NOTICES.md` and a re-run of
  `foley measure`. MIT packs worth auditing: `kapishdima/soundcn`, `romainsimon/uisfx`.

Sources: HeyGen's oversized-cursor guidance (press 0.84, 1:2 press/release, sizes),
Screenize (activity zoom, click ripples, keystroke badges, Apache-2.0), UI sound
practice (short taps, rising confirm, restraint). Restated, not copied.

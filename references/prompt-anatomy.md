# Prompt anatomy

The corpus at [prompt-motion.com](https://prompt-motion.com/) publishes the prompts
behind its films. They are worth reading structurally: the prompts that ship look
nothing like a paragraph of wishes. They are six labelled blocks, and each block has
a different job.

This is the structure distilled from those entries (see
[`corpus/twoclipping-5cba86.md`](corpus/twoclipping-5cba86.md) for a pinned example,
"Shape morphing through UI states"). Use it for the film brief, and for every beat
that needs a decision.

## The six blocks

| Block | Answers | Fails when |
|---|---|---|
| `<inputs>` | what must the maker ask for before starting: states, palette, track, length | it is a wish list instead of questions — the film starts before the facts are in |
| `<direction>` | the *feel*, in one breath: references, what is banned, one sentence of taste | it lists adjectives but bans nothing; the maker fills the gap with clip art |
| `<structure>` | the beat sheet on the clock: what happens on which bar | it describes shots instead of events, so nothing lands on a cut |
| `<build>` | constraints that make it reproducible: one file, pure function of time, springs, measured audio | it is missing, and the render is improvised every time |
| `<gotchas>` | the three things that will look cheap | it is empty; everyone relearns the same mistakes |
| `<start>` | the first action, and the confirmation the maker must show before coding | the agent starts rendering before the plan is approved |

Arabic and Remotion wire into the same skeleton: the film brief is `<inputs>` +
`<direction>` + `<structure>`, and `film/film.json` *is* the `<structure>` — bars,
copy, voice — with the compiler refusing to render a plan that does not fit the words.

## What transfers from those builds

These are the load-bearing ideas in the shipped entries, and each one is already a
rule in this studio:

1. **Every style is computed from time inside `seek(t)`** — no CSS transitions, no
   timers, no state carried between frames.
   Remotion is the same idea: `useCurrentFrame()` in, pixels out. A component that
   mutates state over time renders fine once and breaks under `--concurrency=75%`.
2. **Springs are closed-form step responses** — a value that changes target many times
   is the sum of one spring per change, so it stays a pure function of time.
   One `spring()` per event, summed. Never a spring that retargets itself.
3. **Analyse the track with numpy, place the sound on measured peaks**, start on a
   downbeat. `scripts/make_score.py` builds the grid; `scripts/qa.py` measures the
   result. Do not "feel" a cut you can measure.
4. **Render one frame per beat before the full render.** 21 bars = 21 stills, fifteen
   minutes that save a two-hour render. `studio.py still <frame>` at every bar line.
5. **4 subframes blended for motion blur** is what separates "screen recording" from
   "film". In Remotion: render at higher fps or add a blur pass where the camera moves.
6. **The last frame is the first frame** when the piece loops. For a 15-second reel
   this is free polish; for an explainer it is irrelevant — decide deliberately.

## The banned list is the direction

Every strong entry spends as much text on what it refuses as on what it wants:
"bouncy easing, particle bursts, glows, gradients on UI chrome, mismatched icon
strokes, dead time, anything that looks like a template."

Copy that habit literally. A direction that does not ban anything is a mood board;
one that bans three specific things is a style.

## Using this in a session

1. Write `film/brief.md` from `film/brief.template.md` (six blocks, filled).
2. Pin two corpus cards that answer "who did this well and what exactly am I
   borrowing" — `python scripts/corpus.py add ...`.
3. Only then touch `film/film.json`.

The gate is cheap and it is the difference between a film with a point of view and a
generic montage with Arabic text.

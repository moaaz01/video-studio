# <film title> — brief

> Six blocks, in this order, one page. Copy this file to `film/brief.md` and fill it
> before writing a single beat. If a block is empty, the film is not ready — and the
> empty block is usually the reason the first cut felt generic.

## `<inputs>` — what must be known before anything is drawn

- **Product / what it is:**
- **Audience — the one person:**
- **The one promise (a claim the product actually keeps):**
- **The one action (exactly one: handle, store link, site):**
- **Aspect + length:** 16:9 → 9:16, <n> s
- **Language / voice:** Arabic (MSA), vocalised script, brand name spoken in English
- **Assets given:** screenshots / app repo path / brand kit / nothing
- **Facts I may print:** (numbers, names, features that exist — everything else is off limits)
- **Facts I must not print:** (no invented ratings, users, awards, "الأول", "الأفضل")

## `<direction>` — the feel, and what is banned

- **Direction:** (one of the twelve in `references/visual-direction.md`)
- **Two references, cited:** (cards pinned with `scripts/corpus.py`)
- **Three moves that define it:** motion / type / colour — one line each
- **Banned in this film:** (at least three specific things — easings, effects, words)
- **What the audience should feel at 0 s / 10 s / last frame:**

## `<structure>` — the clock

| bars | time | kind | what happens (one line) | the value it lands |
|---|---|---|---|---|
| 0–3 | 0.0–6.0 | hook | | |
| 3–8 | 6.0–16.0 | device | | |
| 8–13 | 16.0–26.0 | device | | |
| 13–17 | 26.0–34.0 | stat | | |
| 17–21 | 34.0–42.0 | cta | | |

One bar = 2.000 s at 120 BPM = 60 frames. Never plan in frames; the compiler will
refuse a plan the words do not fit.

## `<build>` — how it stays reproducible

- Tokens from `film/ui-source.json` (scanned): colours / type / dp
- Copy from the app's own string table: yes / no — where
- Every style is a pure function of `frame` — no state, no timers, no randomness
- Audio: grid built by `make_score.py`, VO measured by `voice.py`, foley on the beat
- Stills at every bar line before the full render: yes

## `<gotchas>` — the three things that will look cheap

1.
2.
3.

## `<start>` — the first action

> Read this brief back as five sentences, name the direction, and show the beat table
> on the clock. Only then write `film/film.json`.

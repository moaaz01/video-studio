# Intake — what the agent must ask before a film exists

The first failure mode of a product film is not taste; it is an invented fact. A
logo redrawn from memory, a price that is not real, a screenshot that never
existed — the audience checks, and the film is thrown away. The intake makes the
missing information visible and **blocking**.

## The gate

```bash
python scripts/studio.py intake init --format explainer --slug my-reel
python scripts/studio.py intake questions --format explainer
# ask the user, fill film/intake.json
python scripts/studio.py intake check --intake film/intake.json
python scripts/studio.py intake brief --intake film/intake.json
```

`check` exits 1 while any required answer or asset is missing. `brief` refuses to
write a brief from an incomplete intake unless `--allow-missing` is passed.

## What is asked

**Every film:** product name, one-liner, the one person, the promise, 3–7 true
proof points, one action, contact/end card, language, platforms, aspect, duration,
brand accent, font, voice provider, music mode, website/repo, notes.

**Explainer:** number hook, 3–7 points (one line each), twist, CTA keyword,
freebie, card types, voice tone, captions.

**Kinetic:** launch claim, tempo, genre, visual mode, end-card text, SFX kit.

The full prompts live in `scripts/intake.py` (`COMMON`, `EXPLAINER`, `KINETIC`).
Do not paraphrase a question into something narrower; ask it as written, in one
batch, numbered, with a default where one exists.

## Assets are slots, not suggestions

| slot | what to ask for | required |
|---|---|---|
| `logo` | SVG preferred, transparent PNG accepted | kinetic; optional elsewhere |
| `product_shot` | 1–3 real product photos | if the film shows the product |
| `screenshot` | 1–3 real app/site screens | if the film shows the UI |
| `key_art` | 1–2 images ≥ 2048 px wide | if `visual_mode` is `type+art` |
| `font` | brand TTF/OTF/WOFF2 | optional |

Put delivered files under `public/assets/<slug>/` and record the **repo-relative**
path in `film/intake.json`. The checker rejects absolute paths, `..`, empty files
and unknown extensions: a public repository must not contain a local path.

If the user has no real UI, do not invent it. Choose a type-only/card form, or ask
for a screenshot/export. If the user has no logo, use a wordmark set in the studio
font and say so; do not trace a logo from a low-res image.

## No invention, in one list

- No invented prices, ratings, user counts, awards, "الأول", "الأفضل".
- No invented screens, strings, colours or font families.
- No invented customer quotes or testimonials.
- No claim that the product cannot keep.
- Numbers come from the user, the app's own data, or the film's measured output.

## The brief

`intake brief` writes the six-block `film/brief.md`:

1. `<inputs>` — product, audience, promise, action, aspect/length, language, assets,
   facts allowed, facts forbidden.
2. `<direction>` — the direction to choose, references to pin, banned moves.
3. `<structure>` — the clock.
4. `<build>` — tokens, voice, music, platform, pure-function rule.
5. `<gotchas>` — the three things that will look cheap.
6. `<start>` — the first action.

The brief is the contract; the intake is its source of truth. If the user changes
a fact, change the intake first, then re-run `brief --force`.

## Agent script

> I will ask the intake questions in one batch. Please answer the required ones;
> for assets, give me the files or a repo path. I will not write a beat until
> `intake check` passes, and I will show you the director's treatment before the
> first render.

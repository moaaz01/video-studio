# Explainer Reel — voice first, one card per sentence

**Use when** the audience must understand a mechanism, a list, or a change in how
something works — a SaaS feature, a course lesson, a "7 tools" reel, a product
walkthrough. It is not a launch trailer: the voice leads, the type follows, the
card proves the sentence.

This form is the studio's rebuild of the Claude explainer-reel workflow. The
original guide is a beginner path (Claude Code + HyperFrames + ElevenLabs). Here
the same craft is expressed in `film.json`, measured VO, safe-area gates and the
Remotion engine, so it can be reproduced and audited.

## 1. Intake — ask before writing

Run `studio.py intake questions --format explainer` and ask the user for:

- the product/service and the one person it is for;
- the **number hook** (7 tools, 3 reasons, 5 mistakes);
- **3–7 points**, one short line each;
- the **CTA keyword** and the **freebie** the viewer gets;
- brand accent, logo, real screenshots/product images;
- language/dialect, voice provider, platform(s), duration.

`intake check` must pass before a beat is written. If the user has no real
screenshots, the cards can be checklists/counters/windows — but the film must not
invent a UI. Ask for the real thing or choose a type-only card.

## 2. Script — the shape

| Part | Rule | Example |
|---|---|---|
| Hook | a number + a promise, one sentence | «ستة أسباب تجعل الفيديو بالكود مختلفاً.» |
| Twist | optional turn after the hook | «السادس صنع هذا الفيديو.» |
| Points | 3–7, one idea per sentence, 8–16 words | «ملف واحد يحمل النص والإيقاع والصوت.» |
| CTA | one keyword + one concrete freebie | «اكتب «قالب» وسأرسل لك ملف البداية.» |

- **90–170 words ≈ 40–60 s** (110–160 is the sweet spot). One idea per sentence; one sentence per beat.
- Read it aloud. If a sentence needs a breath in the middle, split it.
- Write acronyms as words (`HTML`, not `H T M L`).
- The headline is the **spoken** sentence, not a summary of it.
- The card is the **object** the sentence names: a checklist, a window, a counter,
  a comparison, a quote, a real image. It never repeats the headline.

## 3. Voice — one sentence at a time

```bash
# Fish (default; free tier works)
python scripts/studio.py voice --provider fish

# ElevenLabs (optional; word-level timestamps)
python scripts/studio.py voice --provider elevenlabs --voice-id <id>
```

- Generate **one clip per sentence**, never one long take. Cutting a long take
  clips the ends of words; per-sentence takes are the fix.
- The manifest (`src/generated/vo.json`) stores the measured duration and, when the
  provider returns it, a `words` array. `make_timeline.py` turns that into
  `data.words`; without timestamps it uses a measured-duration character-weight
  estimate and marks `wordSource: "estimated"`.
- Re-run `studio.py timeline --strict` after voice. The compiler refuses a beat
  whose measured speech + 0.35 s air does not fit.
- `voice_check.py` (Fish ASR) proves the take still says the scripted words.

## 4. Picture — the card grammar

The `Explainer` scene renders one headline (word by word, as spoken) and one card
from `beat.data.card`:

| `card.type` | Use for | Data |
|---|---|---|
| `checklist` | a list of facts/steps | `title`, `rows[]` |
| `window` | a real app/browser window | `title`, `rows[]` |
| `counter` | a number that lands | `value`, `label`, `sub` |
| `steps` | a 3-step mechanism | `rows[{n,title,sub}]` |
| `compare` | before/after, real/invented | `left{label,rows}`, `right{label,rows}` |
| `quote` | a customer sentence | `quote`, `by` |
| `image` | a real screenshot/product photo | `src`, `caption` |
| `statement` | a hero number or one word | `value`, `label`, `sub` |

- `data.keyword` is the word in `line1` painted in the brand accent.
- Every string is supplied by the intake/user; the scene invents nothing.
- Keep type inside the middle 80% of the frame; Reels/TikTok chrome covers the
  edges. `studio.py safe <still> --preset reels --strict` decides.
- 9:16 is the primary canvas; the same timeline also renders 16:9, 4:5 and 1:1.

## 5. Sound — voice on top, music far below

- VO is the loudest layer; SFX next; the bed lowest.
- The studio's `Soundtrack` ducks the bed under every measured VO line. Do not
  hand-animate a second duck.
- Every pop/tick/whoosh must match something on screen; no random whooshes.
- Original bed is the default (`studio.py score`); an external track is optional
  and must be licensed.

## 6. Gates

```bash
python scripts/studio.py timeline --strict
python scripts/studio.py format explainer --film film/film.json --strict
python scripts/studio.py still 150
python scripts/studio.py safe out/qa/still_150.png --preset reels --strict
python scripts/studio.py captions          # cue JSON + wide/vertical SRT
python scripts/studio.py render 9x16 16x9 4x5 1x1
python scripts/studio.py motion out/film_9x16.mp4 --profile explainer --strict
python scripts/studio.py qa --stills 8
```

- `format explainer --strict` requires measured VO and 110–160 words.
- `motion --profile explainer` catches a parked card (hold > 1.2 s).
- `safe --strict` catches copy drifting into the Reels chrome.
- `qa` probes the delivered MP4; never trust the encoder log.

## 7. Mistakes that make it look like a template

| Mistake | Fix |
|---|---|
| Words appear before they are said | reveal from `data.words`; the compiler supplies them |
| One long voice take, clipped words | one clip per sentence; `voice.py` / `voice_elevenlabs.py` already do this |
| Music louder than the voice | let `Soundtrack` duck; re-level and re-probe |
| Text near the edges | middle 80%; `safe --preset reels --strict` |
| Rendering before preview frames | `still` at 1:1 and `safe` first; a fix is faster than a render |
| A card that repeats the sentence | the card is the object, not the subtitle |
| A copy of someone's style/mascot | borrow the layout, keep your own character and palette |

## 8. Copy-paste prompt for an agent

> Read `references/formats/explainer-reel.md` and `references/intake.md`. Ask me
> the intake questions for an explainer reel, one batch, and wait. Then write a
> 45–55 s Arabic script with a number hook, 3–7 points and a keyword CTA; one
> sentence per beat. Generate the voice one sentence at a time, compile
> `timeline --strict`, show me three stills at 1:1 plus the safe-area check, and
> do not render the MP4 until I say render. After the render, measure
> `format explainer --strict` and `motion --profile explainer`.

## 9. Files

- Template: `references/templates/explainer-reel.json`
- Scene: `src/scenes/Explainer.tsx`
- Compiler: `scripts/make_timeline.py` (`format: "explainer"`, `data.words`)
- Gates: `scripts/format_check.py explainer`, `scripts/motion_audit.py`
- Voice: `scripts/voice.py` (Fish), `scripts/voice_elevenlabs.py` (optional)

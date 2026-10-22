# StudyAI — «من أول صفحة لآخر امتحان» — brief

Second film for the official channel: the same product, spoken in Shami, cut for
sound-on short-form. Built in `projects/studyai-shami/`; the studio itself stays the
engine.

## `<inputs>` — what must be known before anything is drawn

- **Product / what it is:** StudyAI — Arabic-first study app. Upload a PDF/DOCX/PPTX,
  then chat with it, get an Arabic summary, page-cited quizzes, diagrams and a planner.
  Distributed on Telegram (`t.me/studyai0`), not a store.
- **Audience — the one person:** a Syrian/Lebanese university student, 19–24, revising
  on a phone at 1 a.m., fluent in Arabic, allergic to MSA voice-over that sounds like a
  news bulletin.
- **The one promise (a claim the product actually keeps):** ارفع ملزمتك، واسأل،
  وافهم — وكل جواب مع رقم الصفحة. (Upload, ask, understand; every answer cites a page.)
- **The one action (exactly one):** open Telegram → `t.me/studyai0`, download free.
  Secondary, smaller: WhatsApp `+90 552 855 2420`, Telegram `t.me/StudyA_1`.
- **Aspect + length:** 16:9 hero → 9:16, 4:5, 1:1; 42.00 s (21 bars @ 120 BPM).
- **Language / voice:** Arabic (Shami), lightly vocalised so the TTS reads MSA words
  correctly; brand name spoken in English ("StudyAI").
- **Assets given:** the app's source tree at
  `<APP>/android` — `res/values-ar/strings_*.xml` (the real Arabic
  copy), `ui/theme/*.kt` (palette, type, spacing); no device and no screenshots.
- **Facts I may print:** only what the app source proves — upload, chat with document,
  Arabic summary, page-cited quiz, diagram, planner/agent; free on Telegram.
- **Facts I must not print:** user counts, ratings, awards, "الأول/الأفضل", prices,
  store badges, any screen element that does not exist in the app.

## `<direction>` — the feel, and what is banned

- **Direction:** `#device` primary — the phone is the hero and the UI is the argument;
  `#launch` energy in the grade and the cut (look `vivid-launch`: bloom 0.7,
  camera 1.25, 180° motion blur, grain 0.04).
- **Two references, cited:**
  1. *StudyFetch Calendar 2.0 — the calendar decides what to study* (whatships):
     open on the student's real question, let the UI enter as the answer.
  2. *Gemini study notebooks* (whatships): name the before/after state, never list features.
  3. *Shape morphing through UI states* (prompt-motion): one element can morph instead
     of cutting — borrowed for the phone entrance and the wipe.
  Gate: `python scripts/corpus.py check --min 2` → 3 cards, PASS.
- **Three moves that define it:** motion = one phone, one continuous camera settle, wipes
  only on the beat; type = Tajawal 800 at display size, Shami copy, no letterspacing;
  colour = paper emerald/ink, never a store-blue gradient.
- **Banned in this film:** bounce easings, emoji-as-UI, fake cursors, "أفضل تطبيق",
  any English word on screen except the brand and `PDF`/`DOCX`, VFX glitch transitions.
- **What the audience should feel at 0 s / 10 s / last frame:** at 0 s — "someone is
  talking to me, not at me"; at 10 s — "that is a real app and it cites pages"; at the
  last frame — "I can open this on Telegram right now".

## `<structure>` — the clock

| bars | time | kind | what happens (one line) | the value it lands |
|---|---|---|---|---|
| 0–3 | 0.0–6.0 | hook | the claim alone: understood once, from first page to exam | comprehension, not rereading |
| 3–8 | 6.0–16.0 | device | phone enters on the Home screen; upload is the first action | "my file becomes a lesson" |
| 8–13 | 16.0–26.0 | device | the agent answers, page citation on screen | trust: every answer is anchored |
| 13–17 | 26.0–34.0 | stat | the count lands on 3 | the method is only three steps |
| 17–21 | 34.0–42.0 | cta | wordmark, free download, Telegram handle, contacts | one action |

One bar = 2.000 s at 120 BPM = 60 frames. The compiler refuses a plan the words do not fit.

## `<build>` — how it stays reproducible

- Tokens from `film/ui-source.json` (scanned from the app): palette, Tajawal, dp scale.
- **Copy from the app's own string table: yes** — `scripts/app_strings.py` extracts 38
  keys from `values-ar/strings_*.xml` into `src/generated/studyai-ar.json`; the screen
  component only renders `t('key')`, and `--check` is the fidelity gate.
- Every style is a pure function of `frame` — no state, no timers, no randomness.
- Audio: bed from the timeline (`scripts/make_bed.py`), VO measured by `scripts/voice.py`,
  one mastering pass (`scripts/master_audio.py`), foley on cuts.
- Stills at every bar line before the full render: yes (`out/qa`, copies in `output/`).

## `<gotchas>` — the three things that will look cheap

1. Shami words next to MSA tashkeel can look inconsistent — vocalise only the MSA words,
   never the dialect ones, and keep a comma where the voice should breathe.
2. The Home screen has more content than the demo mock: if it is crowded the phone reads
   as a screenshot instead of a product — keep 20 dp margins and one hero card.
3. A page citation that looks like decoration — it must sit inside the answer card,
   in the app's own `صفحة %1$s` label, or the promise evaporates.

## `<start>` — the first action

Read back as five sentences; direction `#device` + `#launch` grade; 21 bars, five beats,
Shami VO; copy lifted from the app's strings; the only action is Telegram. Then write
`projects/studyai-shami/film.json`.

# Worked example — the StudyAI promo (118 s, Arabic, Telegram-distributed)

This is the film the studio was built on. It is documented here because the useful
part of a template is knowing what "finished" measured, and what the first cut got
wrong.

**Deliverables** (rendered 2026-10, `out/`):

| File | Picture | Duration | Size | Peak | RMS | Clipped |
|---|---|---|---|---|---|---|
| `StudyAI_Promo_1080p.mp4` | 1920×1080 @ 30 | 118.016 s | 53.5 MB | −2.15 dBFS | −22.21 | 0 |
| `StudyAI_Promo_Vertical.mp4` | 1080×1920 @ 30 | 118.016 s | 16.7 MB | −2.15 dBFS | −22.21 | 0 |
| `StudyAI_Promo_Thumbnail_1280x720.png` | still @ 20.2 s | — | 0.48 MB | — | — | — |
| `StudyAI_Promo_Cover_9x16.png` | still @ 112.6 s (end card) | — | 0.55 MB | — | — | — |

Both masters: `yuv420p`, BT.709, H.264 CRF 15, no black stretches ≥ 0.10 s.

## Brief

- **Product**: StudyAI — Arabic-first study app: upload a PDF/DOCX/PPTX, then chat,
  summarise into a print-native Arabic PDF, take page-targeted quizzes, read
  diagrams. Android, Arabic.
- **Audience**: Arab university students who already study from PDFs on a phone.
- **Promise**: from a page to understanding, without re-reading it twice.
- **One action**: install from Telegram (`t.me/studyai0`) — the app is *not* on a
  store, so the handle is the call to action, repeated on the end card.
- **Aspects**: 16:9 (YouTube, Telegram, X) and 9:16 (Reels, Shorts, Stories).
- **Language**: Arabic, voice-over fully vocalised (tashkeel); brand name spoken
  in English.

## Structure (7 beats, 3540 frames)

| # | Beat | s | Job |
|---|---|---|---|
| 1 | Hook | 0–12 | the problem, named in one idea |
| 2 | Device | 12–34 | the real app, first screen |
| 3 | Feature | 34–62 | upload → chat, on the real UI |
| 4 | Feature | 62–88 | summary + quiz, citing the page |
| 5 | Proof | 88–102 | numbers that are true, traced to the app |
| 6 | Persona | 102–112 | who it is for, one line |
| 7 | CTA | 112–118 | the handle, the contacts, the small print |

## What made it work

1. **The UI was the source of truth.** Screens were rebuilt from the app's own
   Compose code and tokens (`ui/theme/Type.kt`, spacing, palette) at `412×915 dp`,
   not redrawn from a screenshot. A viewer can hold the phone next to the video and
   find nothing different — the original requirement, word for word.
2. **One score composed to the cut.** 120 BPM at 30 fps → one bar = 60 frames, so
   every cut lands on a bar line. The score was written as data (a map), then
   levelled; the delivered mix was measured on the MP4, not on the bus.
3. **Foley as punctuation, not decoration.** 42 one-shots, deduplicated within
   0.45 s, a whoosh placed 0.10 s *before* each cut, low-end only once per beat.
4. **Arabic was set properly.** Word-level reveals (never per-letter), no
   letter-spacing, no italics, bidi isolation for the Latin handle and phone number,
   Tajawal for UI, Amiri for the "printed" moments.
5. **Both aspects were re-composed**, not cropped: 9:16 uses a card at 668 px with a
   caption plate, safe from the top 220 px and bottom 320 px that platforms cover.

## What the first cut got wrong

- **Vertical haze**: a bottom scrim bled grey into the 9:16 frame. Removed — the
  gradient was fighting the paper palette.
- **Android status bar** appeared inside the "screen", which broke the illusion:
  the app in the film had a status bar the app does not draw. Gated behind a
  `StatusCtx` and removed from every shot.
- **Cuts too polite**: 0.6 s transitions read as a slideshow. Cut to
  wipe-or-dissolve only, 12 frames, centred on the bar.
- **Thumbnail pulled at 18 s**, catching the tagline mid-mask. Re-extracted at
  20.2 s when the line is fully revealed — the lesson: choose a still by the
  *content's* settle time, not by "a nice moment".

## Reuse

The engine, tokens and components in this repo are that film's engine, genericised:
`src/theme.ts` is the same palette, `src/components/Phone.tsx` the same device
frame, `scripts/make_score.py` the same score engine. What is *not* here is the
product: StudyAI's screens, strings, numbers and contacts live in that project.
Copy `src/brand.ts` and `src/components/DemoUI.tsx`, and build the real screens.

Distribution facts for this product (kept here as data for the end card):
Telegram `t.me/studyai0` · WhatsApp `+90 552 855 2420` · Telegram support
`t.me/StudyA_1`.

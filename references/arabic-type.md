# Arabic type in motion

Arabic is a connected script: every rule below exists because a Latin default
breaks the join, the baseline, or the reading direction. Treat them as compile
errors, not preferences.

## The five hard rules

1. **`dir="rtl"` + `lang="ar"`** on every Arabic block. Without it, digits, mixed
   Latin and punctuation reorder unpredictably.
2. **No `letterSpacing`.** Any positive tracking tears the cursive joins
   (`letter-spacing` inserts gaps *between glyphs*). Set `letterSpacing: 0`
   explicitly and never animate it.
3. **No `text-transform`, no italics, no faux-bold.** Arabic has no case; fake
   obliques ruin the baseline. Use real weights.
4. **No letter-by-letter reveal.** Animate by **word** or **phrase**. Per-letter
   masks expose isolated forms and read like a barcode.
5. **Tashkeel stays attached.** Never split a word containing diacritics across
   spans; each span re-shapes its letters and the harakat land wrong.

## Direction and mixed content

- Punctuation follows the paragraph direction: `…` and `،` sit at the logical end,
  which is visually on the left.
- A Latin token inside Arabic (`StudyAI`, `t.me/studyai0`) keeps its own internal
  LTR order and is bidi-isolated: wrap it in a span with `unicodeBidi: 'isolate'`
  so the surrounding number or dot cannot steal it.
- Numbers: Western digits (`0-9`) by default for a modern product; Arabic-Indic
  (`٠-٩`) only when the product itself uses them. Pick one per film and apply it
  everywhere, including counters.
- A URL or handle in the end card is Latin and LTR — lay it out as its own block,
  never inline inside a sentence.
- Fractions/percent: `48 صفحة` (number first, RTL flow puts it on the right).
  Do not hand-reverse the string.

## Type scale

- Sizes are for **one** film, set once: caption 40/68, kicker 26, body 34–40,
  display 96–180. Two weights of one Arabic family (e.g. Tajawal 500 + 800, or
  Noto Kufi + Naskh) cover a whole film.
- Line height 1.3–1.45 for Arabic (the script has deeper ascenders/descenders than
  Latin). Below 1.25 the lines collide.
- Measure by **words per line**, not characters: 3–6 words per line at display
  size; 8–14 at body size.
- Never justify. Right-align or centre.

## Fonts

- Ship the font files (or `@remotion/fonts` with local files) — a missing font
  silently falls back and the whole film reads wrong. Verify by rendering one
  known string per family.
- Kufi for UI/labels (geometric, matches a modern product); Naskh for editorial or
  long-form. Sans-serif Arabic (Tajawal, IBM Plex Sans Arabic, Noto Sans Arabic)
  is the safe default for app films.
- Latin companion: pair a neo-grotesque (Inter/Manrope) with the Arabic sans so the
  brand name in Latin and Arabic sit on the same optical size.

## Reading and timing

- **Reading speed:** ~9–12 Arabic words/second at a glance, but only ~3–4 when
  the words are new. Budget 0.35 s per short word, 0.55 s per long one.
- A caption must be readable in one fixation: if you cannot read it in one look at
  a 1:1 crop, it is too long.
- Beat length ≥ reading time + 0.4 s. VO-driven beats: beat ≥ line + 0.35 s.
- Animations finish before the read starts: entrance ≤ 0.4 s, then hold.

## Layout

- Arabic reads right→left, so the *first* thing on the right is the anchor: put the
  icon/brand on the right, secondary on the left.
- Caps for Latin only. Arabic has no uppercase — if you need emphasis, use weight,
  size, or colour, never "uppercase".
- Keep a strict margin: 6–8 % of width. Arabic's descenders need more bottom air
  than Latin.
- In vertical (9:16), the caption plate sits **below** the UI, never over it.

## Cheat sheet for reviewing a still

| Symptom | Cause |
|---|---|
| Letters look separated / barcode | `letterSpacing` or per-letter animation |
| Text drifts left although `text-align: right` | missing `dir="rtl"` on the container |
| A dot or number jumps to the wrong side | missing `unicodeBidi: isolate` on Latin span |
| Harakat sit on the wrong letter | word split across spans |
| Lines touch | `lineHeight < 1.25` |
| Bold looks synthetic | faux-bold on a family lacking 700 |

## Verification

`scripts/qa.py --arabic` scans the built sources and the rendered frames for the
classic corruption signatures (`U+00E2 U+20AC`, `U+00C3`, `U+FFFD`, cp1256 mojibake such as `U+00D8`/`U+00D9` pairs,
`U+0638 U+2026`) and fails the gate on any hit. A file that survives a PowerShell round-trip
but not this scan is still broken.

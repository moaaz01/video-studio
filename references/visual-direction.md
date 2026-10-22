# Visual directions

Pick **one** direction before writing a single frame. A film that mixes three
directions looks like a template; a film with one direction and varied content
looks designed. This page is the chooser: match the brief, take the tokens,
keep the signature moves.

## How to choose (in 60 seconds)

1. Read the brief's verb. *Launch* → Launch. *Understand/see how* → Diagram or
   Editorial. *Trust/wait* → Editorial. *Feel* → Kinetic or Atmosphere. *Use it* →
   Product UI or Device.
2. Count how much of the runtime must show the real product. **> 50 %** → Device
   or Product UI, everything else supports. **< 25 %** → Kinetic/Editorial with
   product as evidence.
3. Name the emotion in one word (calm, hype, smart, premium, warm). It picks the
   palette temperature and the cut rate.
4. Confirm the *action* is visible in the last 3 seconds, in the direction's own
   vocabulary.

**Score directions** (1–5) on: product-fidelity fit · emotion fit · asset cost ·
Arabic fit · duration fit. Take the highest total; a tie breaks toward the
direction that shows the product, because trust is the harder problem.

| Direction | id | Signature move |
|---|---|---|
| Device film | `#device` | the phone *is* the frame; UI at 1:1 |
| Product UI film | `#ui-film` | UI parts detach and rearrange as graphics |
| Launch trailer | `#launch` | hard cuts on the kick, full-bleed type |
| Kinetic type | `#kinetic` | words as the only object, mass and speed |
| Data / stat | `#data` | one number, counted and landed |
| Diagram / schematic | `#diagram` | mechanism drawn link by link |
| Editorial / paper | `#editorial` | ink on paper, rules, stamps, margins |
| Atmosphere / particle | `#atmosphere` | depth, bloom, drifting particles |
| Character / mascot | `#character` | a small figure reacts for us |
| Code / terminal | `#code` | real text streaming as texture |
| Chart theatre | `#chart` | charts that grow into the argument |
| Photo / collage | `#photo` | real imagery, torn edges, tape |

---

## `#device` — device film

- **When:** the app is the product and the audience will compare it to their own
  phone. The safest, most credible choice for an app launch.
- **Palette:** product's own tokens; ground behind the device is one flat tone
  (or a single soft vignette). Never a competing gradient.
- **Type:** product type for UI, display face for the few captions. Captions
  outside the device, never on top of the UI.
- **Motion:** device drifts 6–14 px, screen scrolls *internally* (dp-accurate),
  UI elements animate inside the screen only. Camera moves are 1.0→1.03 scale
  over a whole beat, never per-cut.
- **Structure:** hook (claim) → device enters → 3–5 feature beats, one screen
  each → end card (icon, name, one action).
- **Sound:** UI clicks on real interactions, one whoosh per cut, bed at 55–65 %.
- **Fail mode:** shrinking the UI below legibility; cropping the screen so the
  tab bar or status bar is missing. The phone must show a *whole* screen.

## `#ui-film` — product UI film

- **When:** the UI language itself is the story (a design-forward product, a
  redesign, a dashboard). The UI is shown but not necessarily on a device.
- **Palette:** the product's surface colours + one accent that is *not* in the
  product (the film's own voice).
- **Type:** product's real type scale, quoted at 1.5–3× size, with the product's
  own labels reused verbatim.
- **Motion:** crops and re-frames of real UI (no invented screens), elements lift
  off the surface with a 12 px shadow, layouts morph by swapping slots.
- **Structure:** one screen per 2.5–3.5 s; every beat changes one variable.
- **Fail mode:** re-drawing the UI in a different style "to make it cinematic".

## `#data-film` — Cobalt Ledger

- **When:** the product's economics are the argument: sourcing, margin, automatic
  repricing, payment coverage, setup speed. A phone alone cannot explain it; a data
  scene can.
- **Palette:** cobalt/navy `#0B1730`, ink `#040814`, ivory `#F3F7FF`, ice
  `#9CC8FF`, champagne `#F2A93B` (money only). Not green; the product's teal stays
  inside its own UI.
- **Type:** Tajawal 700/800 for headlines, IBM Plex Sans Arabic for body, Reem Kufi
  only inside the phone. Whole words, 1.28–1.35 line-height, no tracking.
- **Motion:** 120 BPM, one data event per bar; maskline/flood/iris hand-offs; one
  champagne ledger line that becomes the setup path, the source graph and the ticket
  perforation. Glass cards, not floating screenshots.
- **Structure:** 24 bars — open 3, setup 4, store 5, sources 5, owner 4, finale 3.
  Each scene is a pure function of frame; stills at every beat before render.
- **Fail mode:** a product card covering the headline, a price panel covering the
  sub, unlabelled example numbers, a video-model UI with fake Arabic, or a CTA that
  says «السعر على الخاص».
- **Start from:** `references/templates/cobalt-ledger.json`,
  `references/PLAYBOOK-cobalt-ledger.md`, `references/prompt-packs/cobalt-ledger.md`.

## `#launch` — launch trailer

- **When:** something ships, the audience already wants it, the job is hype.
- **Palette:** one saturated field + one light; high contrast, low mid-tones.
- **Type:** condensed heavy display, full-bleed, 3 words max per beat.
- **Motion:** cuts on the 120 BPM kick, 6–12 frame wipes, flash frames at 0.6–0.9
  opacity, 1.05 scale punch-ins. Rhythm over smoothness.
- **Structure:** 6–10 beats of 1.5–3 s, no beat explaining — the accumulation is
  the argument; final card holds 3 s.
- **Fail mode:** running it past 30 s (the form dies at length) or slowing the cut
  rate in the middle.

## `#kinetic` — kinetic type

- **When:** the message is a sentence, a statistic, or a claim with no product
  surface worth showing.
- **Palette:** one background, one ink, one accent used once.
- **Type:** two weights of one family; size is the only variable that changes
  (72 → 320 px in one beat is a legitimate move).
- **Motion:** word-level entrances with mask reveals, tracking tightened by
  scale, line breaks used as punctuation. Arabic: reveal by *word* or *phrase*,
  never by letter.
- **Structure:** 3–5 words per beat, one idea per beat, beat length = reading time
  of the line aloud + 0.3 s.
- **Fail mode:** animating every word equally so nothing is emphasised.

## `#data` — one number

- **When:** the claim is quantitative and the number is the emotional payload.
- **Palette:** dark field so the figure glows; the accent only on the number.
- **Type:** the number at 30–45 % of frame height, label at 18–22 px beneath.
- **Motion:** count-up (integer only), a settle bounce, then the unit lands last;
  the ring/bar fills with the same easing family.
- **Structure:** context (2 s) → count (2.5 s) → implication (2.5 s).
- **Fail mode:** three numbers on one beat; a number that means nothing to the
  viewer's life.

## `#diagram` — schematic

- **When:** explaining a mechanism (how it works, what happens to your file).
- **Palette:** paper or near-black; one stroke colour, one fill tint.
- **Type:** small caps labels, monospaced microcopy for identifiers.
- **Motion:** draw-on strokes (dash offset), nodes appear then links connect;
  the camera walks the diagram, never orbits it.
- **Structure:** nodes → links → result; 3–7 nodes max per beat.
- **Fail mode:** diagram density that needs pausing; labels smaller than 14 px.

## `#editorial` — ink on paper

- **When:** credibility is the job — institutional, academic, premium, thoughtful.
- **Palette:** warm paper, near-black ink, one stamp/tape accent (never a
  gradient). Grain at 4–7 %.
- **Type:** a serif display + a humanist sans for text; Arabic: Naskh-based.
- **Motion:** slow 24–34 frame entrances, rules that wipe in, stamps that land
  with a 1-frame overshoot, tape that lifts. Nothing bounces.
- **Structure:** title → claim → evidence → stamp → action; margins are the design.
- **Fail mode:** paper texture so strong it reads as a filter.

## `#atmosphere` — particle / depth

- **When:** the product is abstract (AI, data, security) or the beat is a
  transition into another direction.
- **Palette:** deep field + two accent glows, additive blending.
- **Type:** light weights, generous tracking only on Latin; Arabic stays normal.
- **Motion:** parallax layers at 0.4×/1×/1.8×, bloom, drifting motes, camera
  dollies. Use 2–4 s at a time, never as a whole film.
- **Fail mode:** particles as a substitute for a message.

## `#character` — mascot / figure

- **When:** the product needs warmth and the brand has (or can accept) a figure.
- **Palette:** flat friendly colours, single outline weight, no gradients.
- **Motion:** 2-frame hold poses, anticipation before every action, blinks.
- **Fail mode:** a character that reacts to nothing; poses that don't match the VO.

## `#code` — terminal / text as texture

- **When:** developer audience, or "AI doing work" shown literally.
- **Palette:** near-black, one phosphor colour, 2 px caret.
- **Type:** monospace, one size, real syntax colours from the product's theme.
- **Motion:** typing at 3–5 chars/frame bursts with pauses, scroll by line, never
  smooth-ease the text.
- **Fail mode:** fake code, fake errors, or code that scrolls faster than reading.

## `#chart` — chart theatre

- **When:** the trend or the comparison is the argument.
- **Motion:** one series animates, the rest are context; axis labels arrive after
  the shape, value callouts land last.
- **Fail mode:** animating five series at once; 3D charts; decoy lines.

## `#photo` — collage

- **When:** real people/places/objects carry the credibility.
- **Motion:** ken-burns 1.0→1.06 over a beat, tape/paper borders, halftone at
  8–12 %. Photos must be cleared for use; never random web images.
- **Fail mode:** mixing photographic realism with a flat-illustration beat by beat.

---

## Cross-direction rules

- **One direction, three moves.** Within a direction, vary *content*, not
  vocabulary: same easing family, same two transitions, same type scale.
- **The product is always allowed.** Even in `#kinetic`, one 0.6 s product proof
  buys more trust than another adjective.
- **Aspect is a re-frame, not a rescale.** 9:16 gets a card layout, bigger type,
  fewer words — not the 16:9 shrunk and letterboxed.
- **Direction survives muting.** If the emotion disappears with the sound off, the
  direction was carried by the score, not the design.

## Mining new directions

When the brief does not fit any row, build the direction from evidence instead of
inventing it: collect 3–5 reference films of the same genre, name their shared
moves (palette, cut rate, type scale, transition vocabulary), and only then write
it down as a new row here. Sources and how to read them:
`references/reference-sources.md`.

# Motion grammar

Motion is a language with grammar. A film reads as "designed" when it obeys one
grammar consistently, and as "made in a tool" when every scene invents its own.

## The clock

- **Everything is on a grid.** 120 BPM → 1 bar = 2.0 s = 60 frames @30 fps.
  A cut lands on a frame that is a multiple of 60 (or 30 for half-bars).
- **Beat map before animation.** Decide how many beats, their lengths in bars, and
  what each beat proves. Then animate inside the beat. Never "animate until it
  looks done".
- **Frame budget per element:** entrance 18–30 frames, mid-move 12–18, exit 10–16.
  Anything slower is a slideshow; anything faster is a glitch.
- **Holds are content.** A 0.5 s hold after a landing is what makes the landing
  read. If nothing holds, nothing lands.

## Easing

One family per film, and only two curves:

| use | curve | feel |
|---|---|---|
| entrances, reveals, moves | `outExpo` / `outQuart` | arrives fast, settles |
| exits, reversals | `inExpo` / `inOutQuart` | leaves without ceremony |
| springs (UI, pops, stamps) | `damping 12–18, stiffness 90–160, mass 0.7–1.2` | tactile |

Rules: `linear` only for mechanical loops (scan lines, marquees, progress ticks);
never `easeInOut` on an entrance (it starts slow and reads as lag); never two
different curves on one object's translate and opacity.

## The universal entrance

`opacity + lift + scale + blur`, applied as one unit:

```
y: +18px → 0      s: 0.96 → 1      blur: 10px → 0      o: 0 → 1
```

Small distances (8–24 px) read expensive; 200 px slides read cheap. Exit is the
same move at 0.4× distance and 0.6× duration, reversed.

## Cuts

A cut is a **hand-off**, not a curtain. The outgoing beat leaves while the next
arrives on the same axis — both scenes are full-size for ~10 frames, so the eye
reads one continuous move and never sees a blank frame.

The vocabulary (`style.transitions`, one word per bar line, cycled):

| word | move |
|---|---|
| `whip` | the two scenes slide on a skewed axis with a leak and a kiss of flash |
| `slide` | a clean push, outgoing right, incoming left (RTL reading direction) |
| `blur` | defocus crossfade: incoming sharpens in, outgoing softens out |
| `flash` | light bloom across the seam; the swap happens in the flash |
| `flood` | the incoming scene is revealed inside an expanding shape (a circle from the object just tapped); the outgoing frame scales and blooms under it |
| `iris` | a circular iris from the centre; no translation, only aperture |
| `maskline` | a gold perforation line sweeps the frame and the new scene is revealed behind it |

A film gets **two or three** of these, no more. Rules:

- Never a solid wipe or dip-to-paper: an opaque panel across the frame is a blank
  cream frame at the seam, the single most "primitive" artefact a cut can make.
- Never chain fades; a cross-dissolve says "I could not decide".
- Don't change axis per cut — the move repeats so it reads as grammar.
- A cut must carry *energy*: the incoming scene is already mid-entrance when the
  bar lands (8-frame pre-roll), the outgoing is still settled. Cutting between two
  static frames reads as a slideshow.

Spice, once or twice per film: *match-cut* (same object, new context), *punch-in*
(scale 1.0→1.06 across the cut), *flash frame* (2 frames at 85 % white).

## Camera

- A camera move spans a **beat**, not a cut: 1.0 → 1.03–1.06 scale, +6–14 px drift.
- Parallax: background 0.4×, subject 1×, foreground 1.6–1.8×.
- Respected depth reads as production value; orbits and 3D spins read as a 2010
  template unless there is real 3D content.
- A camera that moves on every cut makes the whole film feel handheld.

## Text motion

- Reveal by **mask** (a clip that wipes across the line) or by **lift** — never both.
- **Emphasis** = one word changes weight/colour/size, at the moment the VO stresses
  it. If everything animates, nothing is emphasised.
- Counters count integers, settle once, and stop 1 frame before the label appears.
- Line breaks are punctuation: break where the sentence breathes.

## Sound-sync

- Every cut carries a whoosh; every structural cut a low thud.
- SFX precede the visual by 1–3 frames (sound leads picture, never the reverse).
- A drop lands with the picture change, not after it.
- Silence before a reveal is a sound design choice: cut the bed, then hit.

## Rhythm design

A 2-minute promo's energy is a curve, not a constant:

```
intro (sparse, 10-15%) → groove (steady) → lift → full → breakdown (drop out)
→ build (2 beats of riser) → drop (dense) → hold / resolve (last 8-12%)
```

Put the two biggest moments at ~55 % and ~85 % of runtime. A film that peaks at
15 s has nowhere to go; a film that never drops out never earns its drop.

## Aspect re-framing

| 16:9 | 9:16 |
|---|---|
| side-by-side (device + copy) | stacked: device card, copy below |
| 3-line captions | 2 lines, bigger type |
| wide diagrams, timelines | one node at a time |
| text 40–68 px | 68–120 px |

Vertical is not a crop — it is a second edit. Same script, same clock, same
direction; different composition.

## Anti-patterns

| Smell | Fix |
|---|---|
| Everything fades in | Cut in, hold, cut out |
| Bounce on every element | Spring only for tactile objects (stamps, buttons) |
| Continuous zoom on the whole film | One camera move per beat, max |
| Motion that pauses when the music continues | Either freeze the score or keep moving |
| Different easing per scene | One family, two curves |
| Animated background competing with text | Panels, not particles, behind type |

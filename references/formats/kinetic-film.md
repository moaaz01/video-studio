# Kinetic Film — the cut is the argument

**Use when** the product is a game, a launch, a developer tool, or any claim that
is more fun to *see* than to explain. No VO is required: the words are the picture,
the music is the clock, and the ground flips carry the energy.

This is the studio's Arabic-first rebuild of the Scenario kinetic-film skill. The
original engine is a web page of scene blocks rendered with Playwright. Here the
same grammar is a `film.json` + a Remotion scene, so it shares the studio's
timeline, score, QA and multi-aspect export. The measured energy targets are the
same; the text is shaped by this renderer's constraints (see §4).

## 1. Intake — the facts and the assets

Run `studio.py intake questions --format kinetic` and ask for:

- product/game name, the launch claim, 3–5 **true** proof points;
- logo (SVG preferred), key art / product shots / real screenshots;
- tempo (150–175 BPM for a teaser, 120–128 for a calmer brand film);
- palette (bg / paper / accent / hot / ink) or a brand accent to derive it;
- end-card wordmark, tagline, URL/handle;
- platform(s) and duration.

If the user has no key art, the film can be **type-only**; do not generate a fake
product shot. If the claim is a number, it must come from the user or from the
film's own measured output (`{lines}`, `{frames}`, `{seconds}`), never invented.

## 2. Beat sheet — write the words first

| Film | Length | Tempo | Beats |
|---|---|---|---|
| teaser / social cut | 15–25 s | 160–175 BPM | 45–70 |
| launch film | 30–45 s | 160–175 BPM | 80–130 |
| calmer brand film | 25–40 s | 120–128 BPM | 50–80 |

- **One idea per beat or half beat.** A phrase of 4–8 words fills 4–9 beats.
- A shot is 0.3–0.7 s; at 160 BPM one beat is 0.375 s.
- A turn every 3–4 phrases: a denial, a number, a gag, a reveal.
- End on the name, then hold: the logo card is the only place the film may rest.

In this studio a `beat` is a scene of `bars` 4/4 bars. A kinetic scene is normally
**2 bars = 8 beats**, with 8 shots at `at: 0..7`; the last shot ends on the beat,
so nothing parks. A 24 s film at 160 BPM is 16 bars = 8 scenes.

## 3. The shot grammar

`src/scenes/Kinetic.tsx` reads `beat.data.shots[]`:

| `style` | What it does | Text |
|---|---|---|
| `slam` | huge word, scale-down entrance, flash/shake | one line |
| `punch` | bigger scale, ring + rays | one line |
| `stack` | kicker first, then the word + accent bar | `[kicker, word]` |
| `split` | small line, then the big accent line | `[small, big]` |
| `pair` | two lines from opposite sides | `[line1, line2]` |
| `cut` | hard cut, RGB split, rotation | one line |
| `image` | real picture with tint + push, words over it | `src`, `text` |
| `logo` | end card: wordmark, tagline, small, URL | `data.logo` |

Shot fields: `at` (beats, relative), `ground` (`bg`/`paper`/`accent`/`hot`/`ink`
or hex), `color`, `fx` (`hit`/`punch`/`beat`/`none`), `in`
(`cut`/`whipX`/`whipY`), `cue`, `gain`, `size`, `second`, `src`, `tint`.

- **Ground flips on phrase changes.** Three grounds are enough: dark `bg`, brand
  `accent`, light `paper`. The type colour follows the ground.
- **Transitions are moves.** `whipX`/`whipY` slide the background; the type
  enters with a position/font-size move. No fades except the logo's small lines.
- **Sound on every cut.** The compiler flattens each shot's `cue` into the beat's
  `sfx`; `Soundtrack` adds a whoosh on every beat cut. Hits must sit above the bed.
- **A custom sound for the film's own joke** beats another generic impact.

## 4. Arabic type in this renderer

The studio's kinetic scene is deliberately conservative:

- **One direct SVG `<text>` node per frame.** Chromium in this renderer mis-shapes
  Arabic when a frame contains several large text nodes, any `<tspan>`, or any
  geometric transform on the text. The scene therefore shows one line at a time
  and animates `x`, `y`, `font-size` and `opacity` — never a `transform`.
- **Kinetic beats skip the global Camera/BeatShell** (`Film.tsx`): those wrappers
  transform the whole scene, which is exactly what breaks large Arabic. The
  kinetic scene owns its background move and cuts; the type stays outside every
  transform.
- **Words, not letters.** No letter-by-letter reveals, no `letterSpacing`, no
  `text-transform`. Arabic is shaped as a whole word.
- A `stack` or `split` shows the kicker first, then cuts to the big word; the two
  are not on screen at once. That is both a renderer constraint and a stronger
  one-idea-per-beat rule.

## 5. Energy targets (measured on the delivered MP4)

| Measure | Target | Gate |
|---|---|---|
| still frames (under 1.5% changing) | ≤ 40% before the end card (picture-led) | `motion_audit --profile kinetic` |
| still frames, type-only cut | ≤ 60% before the end card | `motion_audit --profile kinetic-type` |
| longest still stretch | ≤ 0.60 s before the end card | both |
| median optical flow | ≥ 2.5 px/frame at 1920 (picture-led) | `kinetic`, when OpenCV is installed |
| hard cuts | 9–13 per 10 s is the reference range | reported, not gated |

Without OpenCV the tool falls back to `median_change ≥ 1.0` and says so. The
still/hold gates always run.

## 6. Build, mix, check

```bash
python scripts/studio.py timeline --film references/templates/kinetic-launch.json --strict
python scripts/studio.py score                 # bed at the film's BPM
python scripts/studio.py still 37
python scripts/studio.py format kinetic --film references/templates/kinetic-launch.json --strict
python scripts/studio.py render 16x9 9x16 1x1 4x5
python scripts/studio.py motion out/film_1080p.mp4 --profile kinetic --end-card 3 --strict
# type-only cut: use --profile kinetic-type (same hold, looser still)
python scripts/studio.py qa --stills 8
```

- The studio's score engine composes at the film's BPM (160 for the template); no
  external track is required. A generated/external track is optional; put it in
  `public/audio/score/` and level it, or use Scenario MCP to generate one at the
  exact tempo (see §7).
- 4K is optional. 1080p CRF 10 / png for the hero, CRF 15–16 for social, H.264
  Level 4.2 at 1080p; keep 4K at Level 5.2 and under 1 GB.
- The end card is the only place a hold is allowed; pass `--end-card` to exclude it.

## 7. Optional: Scenario MCP for music, SFX and key art

The kinetic skill's paid layer is optional here. If the user wants a generated
track or a custom sound kit:

1. Use the Scenario MCP `recommend` → `model_schema_get` → `model_run` (dry run
   first, tell the user the price, wait for a go) flow from the original skill.
2. Ask for the **exact BPM** and an instrumental; measure the result with the
   original `beat_grid.py` if you use it, or keep the studio's exact-tempo bed.
3. Save SFX as `public/audio/sfx/<name>.wav`; the compiler checks every cue.
4. Save pictures under `public/assets/<slug>/`; reference them from
   `shot.src` as `assets/<slug>/<file>` and inspect at 100% for brand marks.
5. Never put a local absolute path or an API key in the film JSON.

## 8. Mistakes

| Mistake | Fix |
|---|---|
| A shot parks for seconds | fill all 8 beats; the last shot must end on the beat |
| A phrase needs two headlines | split it into two shots |
| Arabic letters tumble | animate words/phrases only |
| Every cut is a different effect | one cut vocabulary per film; variety from content |
| Type shrinks below ~200 px | split the phrase; `fit` is a safety net, not a plan |
| A number with no source | take it from the user or the film's own measured output |
| Music stops but the picture rests | put the logo hit on the stop; let the end card be the rest |

## 9. Files

- Template: `references/templates/kinetic-launch.json`
- Scene: `src/scenes/Kinetic.tsx`
- Compiler: `scripts/make_timeline.py` (`format: "kinetic"`, `data.shots`)
- Gates: `scripts/format_check.py kinetic`, `scripts/motion_audit.py`
- The original Scenario skill is a local reference; it is not part of this public repository.

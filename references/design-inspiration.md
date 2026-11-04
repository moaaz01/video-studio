# Design inspiration — where to look, and how to turn a look into data

A film looks like cheap AI when every frame is a centred word on a flat colour.
It looks designed when it has **depth** (a ground that moves, layers at different
distances), **one accent** that the eye lands on, **rhythm** (things enter,
hold and leave), and **a system** (one palette, one type scale, one cut vocabulary).
The engine has all four (`references/formats/visual-forms.md#gfx-pro`). This page
is where you find the taste to feed it.

## Where to look

| Source | Use it for | What to take | What never to take |
|---|---|---|---|
| [Dribbble](https://dribbble.com/search/motion-graphics) | motion shots, UI animation, data cards | layout, palette ratios, the entrance verb | the artwork, the illustration, the logo |
| [Behance](https://www.behance.net/search/projects?search=motion%20design) | full brand and broadcast packages | how one system flexes across 10 frames | a whole package |
| [Awwwards](https://www.awwwards.com/websites/animation/) | award-level web motion | grounds, grain, text reveals, scroll rhythm | code or assets |
| [Motionographer](https://motionographer.com/) | broadcast and title design | pacing, transitions, the "one idea per shot" discipline | footage |
| [Godly](https://godly.website/) / [Land-book](https://land-book.com/) | modern product landing pages | gradients, glass, type pairing | brand marks |
| [Mobbin](https://mobbin.com/) | real app UI patterns | card, chart and badge anatomy | another company's screens in your film |
| [Cosmos](https://www.cosmos.so/) / [Savee](https://savee.it/) | mood boards | palette and texture direction | images |
| [LottieFiles](https://lottiefiles.com/) | micro-animations | timing curves, icon motion | files without a licence that allows it |
| [Kinetic Typography (Vimeo)](https://vimeo.com/search?q=kinetic%20typography) | type in motion | type scale contrast, hold lengths | the typeface if unlicensed |
| [Information is Beautiful](https://informationisbeautiful.net/) | data storytelling | how one number becomes a picture | their charts |
| [The Pudding](https://pudding.cool/) | explanatory data essays | the reveal order of a chart | their data |
| [Coolors](https://coolors.co/) / [Realtime Colors](https://www.realtimecolors.com/) | building a palette | bg / bg2 / ink / accent / accent2 ratios | — |
| [Google Fonts (Arabic)](https://fonts.google.com/?subset=arabic) | Arabic display faces | a pairing with Tajawal | — (OFL; check each) |
| [whatships.com](https://whatships.com/) · [prompt-motion.com](https://prompt-motion.com/) | already pinned in the corpus | see `reference-sources.md` | — |

**Rule:** we borrow **moves** (a reveal, a ratio, a rhythm), never **assets**. Every
borrowed move is pinned as a card, so the film can say where its taste came from:

```bash
python scripts/studio.py refs add --url <shot url> --title "<what it is>" \
  --move "glass card stacks with 0.5 s stagger over a moving grid" --why "depth without clutter"
python scripts/studio.py refs check --min 2
```

## From a reference to data

| You saw | Write this |
|---|---|
| a dark gradient that slowly shifts | `"backdrop": "mesh"` + a dark `palette` |
| a perspective grid floor (synthwave, tech) | `"backdrop": "grid"` |
| floating particles / dust | `"backdrop": "flow"` |
| contour lines, maps, calm science | `"backdrop": "topo"` |
| an LED / dot matrix wave | `"backdrop": "dots"` |
| diagonal light sweeps (keynote) | `"backdrop": "beams"` |
| frosted cards stacked in depth | `card` layers with rising `z` (0, 0.6, 1.2) and a 0.3 s stagger |
| a number that glows | `counter` + `"glow": true` |
| a headline with a colour gradient | `text` + `"fx": "gradient"` |
| a highlighter sweep under a phrase | `text` + `"fx": "marker"` |
| a chart that draws itself | `line` (time series, left → right), `bars`, `donut`, `progress` |
| an element that leaves before the next one | `"out": <seconds>` |

## Palettes (`src/look/palettes.ts`)

| name | for | mood |
|---|---|---|
| `midnight-amber` | data stories, default | night blue, warm signal |
| `electric-indigo` | tech, AI | violet depth, pink counterpoint |
| `emerald-gold` | money, heritage | deep green, gold |
| `ocean-cyan` | space, earth, science | cold ocean, sun accent |
| `sunset-plum` | body, mind, people | plum dusk, coral |
| `mono-red` | urgency, editorial | black, white, one red |
| `sand-ink` | calm daylight explainers | paper, ink, terracotta |
| `paper-cobalt` | clean product, finance | off-white, cobalt, orange |

One palette per film (or per series pillar). `accent2` is the rare counterpoint:
one element per frame at most.

## The ten checks against "cheap AI"

1. The ground moves (a backdrop), and nothing sits on a flat fill.
2. One accent per frame. If two things glow, neither does.
3. Type has scale contrast: the hook is at least 3× the label.
4. Layers enter in a stagger (0.12–0.5 s), never all at once.
5. Something leaves (`out`) before the next idea arrives.
6. Depth: at least two `z` values in a card or shape beat.
7. Numbers are real and sourced. A chart with sample data says so on screen.
8. Western digits (`123`) everywhere: the project rule, enforced by tests.
9. No generated image carries letters; the renderer sets every word.
10. Check a 1:1 still before the render, in both 9:16 and 16:9.

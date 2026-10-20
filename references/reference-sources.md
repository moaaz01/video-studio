# Reference sources — and how each one is actually wired in

A reference you cannot query is decoration. Each source below has a command that
turns it into a decision, so "I looked at some references" becomes "here is the card,
here is the move, here is the source".

## The three sources you were given

### [prompt-motion.com](https://prompt-motion.com/) — the prompt craft

A curated collection of motion pieces made with an agent, **with the prompts and
skills behind them published**. Verified taxonomy and volume on the homepage:

| tag | entries | feeds |
|---|---|---|
| product-ui | 102 | `ui-film`, `device` |
| kinetic-type | 98 | `kinetic` |
| music | 51 | `launch`, `atmosphere` |
| shapes | 44 | `kinetic`, `atmosphere` |
| particles | 43 | `atmosphere`, `launch` |
| charts | 33 | `data`, `chart` |
| diagrams | 31 | `diagram` |
| characters | 27 | `character` |
| photos | 23 | `photo`, `editorial` |
| phone | 22 | `device` |
| code | 21 | `code` |

```powershell
python scripts/corpus.py motion                 # the table above, from the script
python scripts/corpus.py motion product-ui      # one tag, and which direction it feeds
```

What to take: **the anatomy of the prompt**, not the composition.
See [`prompt-anatomy.md`](prompt-anatomy.md) — six labelled blocks, one banned list,
and four build rules (time-pure styles, closed-form springs, measured audio peaks,
one still per beat).

### [whatships.com](https://whatships.com/) — what already shipped

A curated directory of startup launch videos from X, with a **public machine-readable
catalog** (their own `llms.txt` points at it):

| endpoint | use |
|---|---|
| `https://whatships.com/search-index.json` | 2 652 published entries: title, company · category, slug, poster, search text |
| `https://whatships.com/videos/{slug}/` | one launch: description, duration, tags, and the original X link |
| `https://whatships.com/openapi.json` | read-only catalog API, no auth |

```powershell
python scripts/corpus.py whatships "notion"
python scripts/corpus.py whatships "dev tool" --limit 5
```

Cite the original X post, not the re-upload (their terms, and it is simply correct).
What to take: **the shape of a launch film** — how a 30-second film introduces a
product, where the logo lands, how the CTA is said out loud. Not the frames.

### [github.com/morluto/rea](https://github.com/morluto/rea) — reverse engineering as truth

`rea` (v6.7.0, `npx rea-agents`, MIT) is an MCP toolkit for inspecting how an app
actually behaves: **Android APKs, Android devices (screen captures, display density,
logs), web pages (screenshots), native binaries, JS/Electron**. For this studio the
Android and web surfaces are the ones that matter, because they turn "match the UI"
from an act of memory into an act of measurement.

```powershell
python scripts/ui_source.py --rea        # prints the exact commands for this machine
```

Which resolves to:

```powershell
npx -y rea-agents@latest inspect-adb-display <serial> --format json
npx -y rea-agents@latest capture-adb-screen <serial> --output-directory references/corpus/evidence/<slug>
npx -y rea-agents@latest decode-android-resources app-release.apk --locale ar --format json
npx -y rea-agents@latest capture-web-screenshot <cdp-endpoint> <targetId>
npx -y rea-agents@latest doctor
```

Verified on this machine: CLI `6.7.0` runs, `doctor` reports host ok; deep native
engines (Hopper/Ghidra/IDA) are **not** installed and are not needed here; the
device commands need `adb` (present, 1.0.41) and a phone on the cable.
The full loop — scan, capture, rebuild, compare at 1:1 — is
[`fidelity-pipeline.md`](fidelity-pipeline.md).

## The other source: the product's own code

Before any external reference, there is the project itself:

```powershell
python scripts/ui_source.py --dir <app repo>
```

That writes `film/ui-source.json` — screens, routes, every string in every locale,
colour tokens, font families — and the film is built against **that**, not against
memory. Run on the StudyAI Android project it reports `com.studyai.app`, 100 screens,
6 routes, 40 strings × 2 locales, 50 colours, and the Tajawal family — which is why
the demo film sets Tajawal and the app's `Paper` tokens, not a guess.

## Sources I added, because they raise the ceiling

These are not decoration either — each one is a concrete capability the studio was
missing or doing by hand. Verified on 2026-10-20.

### Toolchain and craft, upstream

| Source | What it is | What it changed here |
|---|---|---|
| [Remotion docs/resources](https://www.remotion.dev/docs/resources) | the official index of templates, components, effects, integrations and examples | the reference for every engine decision: `spring()`, `interpolate()`, motion blur, fonts, Lottie, Skia, three.js. Read this before inventing an effect |
| [Remotion Elements + Prompts](https://remotion.dev/elements) / [remotion.dev/prompts](https://remotion.dev/prompts) | production components and prompt templates maintained by Remotion | the shape of a component prompt: what to specify so the render is reproducible |
| [OpenFilm](https://github.com/openfilm/openfilm) (MIT, `npx -y openfilm@latest`) | an agent-first film format: one `film.html`, `frame(t)` pages, a real browser editor, `openfilm look` for verification | independent confirmation of the one rule this studio also enforces: **the same `t` must always draw the same picture**, and the QA step must draw frames twice, in shuffled order, to prove it. Its `look` idea is the same bet as `qa.py --stills` |
| [Remotion Bits](https://remotion-bits.dev/) · [Onda](https://onda.video/) · [remocn](https://remocn.dev) · [snapcn](https://snapcn.dev) | component libraries: transitions, UI-shaped components, motion blocks | where to look before hand-rolling a transition; `snapcn` in particular ships software-looking components, which is what a device beat needs |
| [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | agent skill with 106 shot recipes and 161 motion previews for product films | the shot vocabulary a director reaches for; useful when a brief says "cinematic" and the storyboard is three cards in a row |
| [remotion-qa](https://github.com/GroMarketing/remotion-qa) · [audio-bed-check](https://github.com/oo-pibe/audio-bed-check) | measurement tools: sound-off readability, dead air, text under Reels UI; LUFS speech-over-bed separation, CI exit codes | validates the gates in `qa.py` and suggests two additions worth keeping: **dead-air after the text is read**, and **speech-over-bed separation in LU** rather than a naked peak |

### Music and sound, licensed for commercial work

| Source | Use |
|---|---|
| [Mixkit free stock music](https://mixkit.co/free-stock-music/) | royalty-free beds, explicitly free for commercial use; the same source the prompt-motion entries cite. Our score engine is procedural (no licensing at all), but a licensed bed is the honest fallback when the brief wants a real track |
| [Freesound](https://freesound.org/) | foley and texture, check the licence per sound (CC0 vs CC-BY) |

The studio's default stays procedural: `scripts/make_score.py` writes the bed and the
foley from numpy, so nothing in a delivered film depends on someone else's licence.
Sources are for when the brief *needs* a specific track, and then the licence is part
of the delivery checklist.

### Arabic type

| Source | Use |
|---|---|
| [Google Fonts — Arabic](https://fonts.google.com/?subset=arabic) | the pool the app already draws from: Tajawal (shipped here), IBM Plex Sans Arabic, Noto Kufi/Naskh, Cairo, Rubik |
| [Noto Naskh Arabic](https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic) | the text face for long-form Arabic; already bundled for print-style beats |
| the app's own `res/font/` | **the truth for a product film**: whatever the app ships is what the film sets — the scan reports it (`studio.py ui --dir`) |

### What I deliberately did not add

AI video generators (Runway, Sora-style text-to-video, stock-footage sites). They
produce footage, not a designed product film, cannot match a real UI, and cannot be
re-rendered when a string changes. This studio's whole advantage is that the film is
code: deterministic, diffable, and rebuildable in a minute.

## The standing rule

No reference enters a film without a card:

```powershell
python scripts/corpus.py add --url <url> --title "<name>" --source <source> \
    --direction <direction> --move "<the one technique>" --why "<what it buys this film>"
python scripts/corpus.py check --min 2      # the phase-2 gate
python scripts/corpus.py list
```

Cards live in [`corpus/`](corpus/). Pinned examples ship with the skill so the format
is obvious: `twoclipping-5cba86` (a time-pure UI morph), and a launch entry pulled
from whatships.

---

Attribution: works referenced remain their creators' — quote the prompt, cite the
original post, link the entry. Never re-upload or re-post someone's film as a
deliverable.

# video-studio

A production environment for making **Arabic-first product films** — the kind that
show a real app, real screens and real copy, cut to a beat, with a generated
soundtrack and a synthesised voice — packaged as a **portable Agent Skill** so any
coding agent can pick it up and use it.

It is not a template with placeholders. It is a small studio with an opinion:

- **Fidelity is the rule.** If the app has a screen, the film shows *that* screen,
  same type, same spacing, same Arabic. No invented UI, no fake dashboards.
- **Arabic is designed, not styled.** Word-level reveals, no letter-spacing, no
  italics, bidi isolation, vocalised voice-over.
- **Sound is composed to the cut**, not laid over it: a 120 BPM bed, foley on
  transitions, voice measured before the timeline is compiled.
- **Gates before praise.** Every master is probed for peak/RMS/clipping, black
  stretches and corrupted Arabic before anyone says "done".

```
 Brief ─▶ Direction ─▶ Script ─▶ Voice ─▶ Build ─▶ Mix ─▶ QA ─▶ Masters
                        film.json  Fish    Remotion  wav    ffprobe  16:9 · 9:16
```

---

## ابدأ من هنا (60 ثانية)

```powershell
cd video-studio
npm install
pip install -r requirements.txt   # numpy · scipy · pillow
.\install.ps1                 # يربط المهارة بكل وكلاء الذكاء الاصطناعي على الجهاز
python scripts/studio.py doctor
python scripts/studio.py render    # يخرج الفيلم التجريبي 16:9 و 9:16
```

ثم قل للوكيل: «اصنع فيديو تسويقي للتطبيق الفلاني» — ستُحمَّل المهارة تلقائيًا.
المهارة تعمل بالعربية والإنجليزية، والنسخة الافتراضية من الفيلم عربية بالكامل.

---

## Install as a skill

The repo *is* the skill: `SKILL.md` at the root is the entry point, the rest is
the environment it needs. Link it where your agent looks for skills:

| Agent | Discovery path | Install |
|---|---|---|
| **DeepSeek Harness** | `~/.dsh/skills/video-studio/SKILL.md` | `.\install.ps1 -Targets dsh` |
| **Claude Code / claude.ai skills** | `~/.claude/skills/video-studio/SKILL.md` | `.\install.ps1 -Targets claude` |
| **opencode** | `~/.config/opencode/skills/…` or `.opencode/skills/…` | `.\install.ps1 -Targets opencode` |
| **OpenClaw** (and anything else on the Agent Skills standard) | `~/.agents/skills/video-studio/SKILL.md` | `.\install.ps1 -Targets agents` |
| **Hermes Agent** | `~/.hermes/skills/video-studio/SKILL.md` | `.\install.ps1 -Targets hermes` |

Python deps are declared in [`requirements.txt`](requirements.txt) (numpy, scipy, pillow);
`studio.py doctor` names any that are missing. `./install.sh` does the same on macOS/Linux. Links are junctions/symlinks, so
editing this folder updates the skill everywhere with no copy step.

If your agent has no skill loader, point it at [`AGENTS.md`](AGENTS.md) — it is
the same protocol written as a plain instruction file.

The repo intentionally sets `"private": true` in `package.json`: it is a skill +
a Remotion project, distributed by clone/link, not by `npm publish`. That flag is
what stops an accidental publish of the film's build. Remove it only if you ever
decide to ship the engine as a package.

---

## Verify the local install

Installing is one command, and proving it is another:

```powershell
.\install.ps1            # junction, all five discovery paths
.\install.ps1 -Verify    # links + frontmatter + every file an agent reads, through the link
python scripts/install_check.py   # same check, any OS, exit 1 on any gap
```

```
agent                    link   state         detail
DeepSeek Harness         yes    ok            video-studio, 10 files visible
Claude Code              yes    ok            video-studio, 10 files visible
opencode                 yes    ok            video-studio, 10 files visible
OpenClaw / Agent Skills  yes    ok            video-studio, 10 files visible
Hermes Agent             yes    ok            video-studio, 10 files visible
```

The check reads *through* each link, so a stale copy, a broken junction or a
half-installed skill fails instead of passing on the installer's word.

## What the agent gets

**A protocol** — [`SKILL.md`](SKILL.md): eight phases, each with an exit gate, and
six non-negotiables that override any aesthetic preference.

**Knowledge it would otherwise have to guess** — [`references/`](references/):

| File | Answers |
|---|---|
| [`brief-recipes.md`](references/brief-recipes.md) | What shape does this request actually want? (5 recipes) |
| [`visual-direction.md`](references/visual-direction.md) | Which of 12 looks, and *why* — with fail-modes |
| [`reference-sources.md`](references/reference-sources.md) | How to mine prompt-motion / whatships / rea without copying |
| [`motion-grammar.md`](references/motion-grammar.md) | Easing, entrances, cuts, camera, rhythm |
| [`arabic-type.md`](references/arabic-type.md) | The five hard rules of Arabic on screen |
| [`audio-and-voice.md`](references/audio-and-voice.md) | Fish Audio wiring, VO rules, score engine, mix targets |
| [`platform-specs.md`](references/platform-specs.md) | Sizes, safe areas, encode settings, measured render speeds |
| [`qa-gates.md`](references/qa-gates.md) | The exact commands that decide "done" |

**A working engine** — Remotion + React 19 + TypeScript:

```
src/theme.ts            design tokens (paper/ink palette, type scale, phone geometry)
src/brand.ts            the only file that changes between clients
src/components/         Phone · Surfaces · Overlays · Text · Ico · Brand · DemoUI
src/lib/                animation + RTL/bidi helpers
src/scenes/             Hook · Device · Stat · Cta  (the four beats every film needs)
src/film/Film.tsx       timeline-driven assembler, one film → 16:9 and 9:16
film/film.json          the film's whole structure: beats, bars, copy, VO lines
film/README.md          how to write a beat; why the demo master is silent by design
scripts/                studio.py · make_timeline.py · voice.py · make_score.py · qa.py
public/fonts            Tajawal (UI) · Amiri + Noto Naskh (print-native) — OFL
public/audio/sfx        42 one-shots, foley table in the audio reference
```

**A voice** — [`scripts/voice.py`](scripts/voice.py) speaks to **Fish Audio**
(`POST /v1/tts`, `s2.1-pro-free` by default), writes a measured manifest, and
survives the API's placeholder WAV headers. Arabic, English, anything the model
handles; `prosody.speed` 0.92–1.06 for Arabic.

```powershell
copy .env.example .env      # paste FISH_API_KEY
python scripts/studio.py voice      # film.json VO lines -> public/audio/vo + vo.json
python scripts/studio.py timeline --strict   # beats must fit the measured speech
```

---

## The four beats

Every film in this studio is assembled from four beat types, because every product
film answers four questions: *why look? what is it? does it work? what now?*

| Beat | Question | Direction | Exit gate |
|---|---|---|---|
| `hook` | why look? | `#kinetic` on ink | one idea, readable in 1.2 s |
| `device` | what is it? | `#device` on paper | the screen is the real screen |
| `stat` | does it work? | `#data` on ink | every number traced to a source |
| `cta` | what now? | `#launch` on emerald | the handle is the largest type |

Add scenes freely — `src/film/Film.tsx` maps `beat.kind` to a component; the
timeline carries the copy, so a new scene needs no changes to the script layer.

---

## Commands

```powershell
python scripts/studio.py doctor              # python deps · node · remotion · fonts · key · timeline
python scripts/studio.py new my-film         # scaffold film/my-film.json + six-block brief
python scripts/studio.py ui --dir <app>      # scan the real project -> film/ui-source.json
python scripts/studio.py refs whatships "<product>"   # what already shipped
python scripts/studio.py refs add --url ... --move ... --why ...
python scripts/studio.py refs check --min 2  # phase-2 gate: references are pinned
python scripts/studio.py timeline --strict   # compile film/film.json -> src/generated/timeline.json
python scripts/studio.py voice               # Fish Audio, measured
python scripts/studio.py score               # 120 BPM bed + foley, levelled to -1.4 dBFS
python scripts/studio.py still 502           # one frame at 1:1 for eyeballing Arabic
python scripts/studio.py looks               # one frame in every look: the client picks
python scripts/studio.py storyboard          # out/storyboard/sheet.png, panels + VO
python scripts/studio.py advise              # measured review: time, contrast, rhythm, cta
python scripts/mcp_server.py                 # the studio as MCP tools (stdio, no SDK)
python scripts/studio.py render 16x9 9x16    # masters
python scripts/studio.py qa --stills 8       # gates + contact sheets
npm run dev                                  # Remotion Studio, live preview
```

Measured on an i5-12450H / 16 GB: **~3 fps** at 1080p (a 2-minute film ≈ 20 min),
4K ≈ 0.156 fps. Vertical costs about the same as horizontal.

---

## Where the quality comes from

Four inputs, each with a command, so none of them is a vibe:

| Input | Command | Produces |
|---|---|---|
| the product itself | `studio.py ui --dir <app>` | `film/ui-source.json`: real screens, strings, colours, fonts |
| the pixels on a real device | `ui_source.py --rea` then REA + adb | captured screens + the real density -> dp |
| what already shipped | `studio.py refs whatships "<product>"` | matching launch films with original X links |
| the prompt craft | `studio.py refs motion product-ui` | the corpus taxonomy + pinned cards with the exact move |

And the rule that keeps them honest: `studio.py refs check --min 2` fails the phase-2
gate until the references you borrowed are written down as cards. See
[`references/reference-sources.md`](references/reference-sources.md) for the full
source list (including the Remotion resource index, OpenFilm, Mixkit and the Arabic
type pool), [`references/fidelity-pipeline.md`](references/fidelity-pipeline.md) for the
capture loop, and [`references/prompt-anatomy.md`](references/prompt-anatomy.md) for why
the brief has six blocks.

## Looks, storyboards, and a critic

A film gets **one look**, declared in `film/film.json` as `"look": "cinema-warm"`
(or `paper-clean`, `ink-noir`, `vivid-launch`). It is a grade, grain, vignette,
bloom and optional letterbox — applied to the whole composite, deterministic, and
free. [`references/cinematic-look.md`](references/cinematic-look.md) explains the
presets and the rules.

Three commands turn opinion into evidence:

```powershell
python scripts/studio.py looks        # the same frame in every look -> out/looks/
python scripts/studio.py storyboard   # the whole film on one sheet with the VO text
python scripts/studio.py advise       # 42.0s · score 85 · MUST 0 · SHOULD 3
```

`advise` reads the theme tokens, so contrast is computed rather than guessed; it
measures each beat's copy against its duration, flags two device beats in a row,
checks the CTA is reachable, validates the look name and re-derives the frame
count from the bar grid. `--strict` exits non-zero on any MUST, which is how it
goes into CI. `--json` is how an agent reads it.

## Use it from any agent (MCP)

[`scripts/mcp_server.py`](scripts/mcp_server.py) is a dependency-free MCP server
over stdio (JSON-RPC 2.0, protocol `2025-06-18`). It exposes eight tools —
`studio_doctor`, `app_scan`, `refs_search`, `film_advise`, `storyboard`, `still`,
`render`, `qa` — so an agent can *call* the studio, not just read about it:

```powershell
claude mcp add video-studio -- python D:/deepseek-workspace/video-studio/scripts/mcp_server.py
```

The split is deliberate: `SKILL.md` carries judgement, MCP carries execution. See
[`docs/ROADMAP-v2.md`](docs/ROADMAP-v2.md) for where this is going.

## Rules the studio will not break

1. **The film must match the product** — and it is *measured*: scan the project,
   capture the device, compare at 1:1. Real screens, strings, tokens.
2. **No invented proof.** No fake stats, logos, ratings or users.
3. **Arabic is set, not decorated.** `dir="rtl"`, no letter-spacing, no italics.
4. **Muted-safe.** Every claim that matters also exists as text.
5. **Sound is composed** to the cut — never a track laid on top.
6. **Borrowed taste is cited** — two pinned cards minimum, each with the move and the source.
7. **Gates before praise** — measured numbers on the delivered file, not on the source.

---

## Worked example

The 118-second StudyAI promo (16:9 + 9:16, Telegram distribution, vocalised
Arabic VO) is documented in [`examples/studyai/`](examples/studyai/) — brief, beat
sheet, measurements, and what the first cut got wrong. It is the reference for
what "done" looks like, not a template to copy.

## CI

`.github/workflows/ci.yml` runs the type check, the Python syntax pass, the strict
timeline compile, the Arabic scan, the corpus gate and a Remotion bundle on every push. It needs
GitHub Actions minutes: on an account whose minutes/spending limit is exhausted,
every run in every repo dies at startup (`startup_failure`, 0 jobs, ~1 s) — that is
billing talking, not the workflow. Everything the gates check also runs locally:

```powershell
npx tsc --noEmit
python scripts/make_timeline.py --strict
python scripts/qa.py --arabic-only
python scripts/corpus.py check --min 3      # references are committed, so this works offline
python scripts/studio.py qa --stills 8      # on rendered masters
```

## License

MIT for the code and docs. Bundled fonts are SIL OFL (Tajawal, Amiri, Noto Naskh
Arabic) — keep their licences with any redistribution. Audio one-shots in
`public/audio/sfx` are generated in-repo by `scripts/make_score.py` and are MIT
with everything else.

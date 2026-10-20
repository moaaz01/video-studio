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
python scripts/studio.py voice               # Fish Audio lines -> public/audio/vo + measured vo.json
python scripts/studio.py score               # compose the bed from the timeline (RMS -19.9 dBFS, peak -3.0)
python scripts/studio.py bed                 # the composer alone, with --json measurements
python scripts/studio.py still 502           # one frame at 1:1 for eyeballing Arabic
python scripts/studio.py looks               # one frame in every look: the client picks
python scripts/studio.py storyboard          # out/storyboard/sheet.png, panels + VO
python scripts/studio.py advise              # measured review: time, contrast, rhythm, cta
python scripts/studio.py eval                # three golden briefs must compile and score >= 90
python scripts/studio.py lut                 # palette -> grade curves + .cube LUTs, verified
python scripts/studio.py safe out/qa/vert_device.png --preset reels --strict   # platform UI bands
python scripts/studio.py captions            # burned captions JSON + wide/vertical SRT, checked
python scripts/studio.py shotlist film/brief.md --out film/plan.json   # brief -> plan + shots
python scripts/studio.py provenance --strict # every declared capture matches its hash
python scripts/mcp_server.py                 # the studio as MCP tools (stdio, no SDK)
python scripts/mcp_selftest.py               # 11 wire checks: protocol, 15 tools, 7 resources, live calls
python scripts/studio.py render 16x9 9x16    # masters
python scripts/studio.py master             # one audio gain stage; video stream copied
python scripts/studio.py qa --stills 8 --require-audio   # gates, contact sheets, and a silence check
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

## A written brief becomes a shot list, not a guess

`scripts/shotlist.py` compiles a short Arabic brief into a plan the engine can
render: beats on the 120 BPM grid, keepable copy, a hook under 4.5 s, and a CTA
whose last line carries the download handle the brief already states.

```powershell
python scripts/studio.py shotlist examples/shotlist/brief-device.md --out film/plan.json
python scripts/studio.py shotlist examples/shotlist/brief-device.md --shots-out out/shots.md
```

The rules are code, not prose: 15-22 bars, hook <= 4.5 s, no two adjacent beats
of the same kind, a reading budget imported from the same constants `advise.py`
uses (never copied), and a stat beat only if the brief states a number. It
reviews its own output before writing it: the fixture scores **95/100, MUST 0**
and compiles to **32.00 s / 960 frames / 16 bars**.

## Captures are declared, not assumed

`scripts/provenance.py` reads `film/ui-source.json` and verifies every capture a
film claims to use: the file exists, its SHA-256 matches the record, its beat
exists in `film.json`, and its package is the one the scanner read. With no
captures declared it says so plainly ("every screen in this film is a
reconstruction") instead of pretending. The procedure for capturing a real
device beat lives in [`docs/CAPTURE.md`](docs/CAPTURE.md).

## Captions are generated, timed, and checked

`scripts/captions.py` reads the same `film.json` the renderer reads and writes
`src/generated/captions.json` (frame-timed cues for both aspect families) plus
`out/captions/wide.srt` and `out/captions/vertical.srt`. `Captions.tsx` picks the
active cue from the frame alone, so a still is pixel-identical to the video frame.

```powershell
python scripts/studio.py captions                      # generate + assert
python scripts/studio.py captions --check              # re-read the SRT and verify it
```

The gate is arithmetic, not taste: cues are monotonic with a 2-frame gap, line
length is capped at 34 (wide) / 22 (vertical) non-space characters, long VO is
split into consecutive cues rather than shrunk, and SRT timestamps are
`HH:MM:SS,mmm`. Social masters (9:16, 4:5, 1:1) ship with captions burned in;
the wide film stays clean unless `--props '{"captions":true}'`.

## The film has a voice and a score

Sound is generated, not licensed. Three layers, all derived from the compiled
timeline so the picture and the soundtrack cannot drift apart:

```powershell
python scripts/studio.py voice                  # film.json vo lines -> Fish Audio -> vo.json
python scripts/studio.py timeline --strict      # re-fit the beats to the measured speech
python scripts/studio.py score                  # compose the bed -> public/audio/score/music.wav
python scripts/studio.py qa --require-audio     # fail a silent master
```

- **The bed** (`scripts/make_bed.py`) is additive synthesis: four detuned sine
  stacks per chord (G6 → Fmaj7 → C → Am7, one chord per four bars), a soft sub
  pulse on beats 1 and 3, filtered-noise shimmers on the stat and the end card.
  It reads `fps`, `frames`, `bpm` and every beat start from `timeline.json`, so a
  re-cut re-scores itself. Measured: **42.00 s, 48 kHz stereo, RMS -19.9 dBFS,
  peak -3.0 dBFS, 0 clipped samples.**
- **The voice** is Fish Audio TTS (`s2.1-pro-free`), fully vocalised Arabic and
  measured on return: 5 lines, **18.16 s of speech**. The voice prints the brand
  name in English and reads the copy as written. `FISH_API_KEY` lives in `.env`
  or the environment and is never tracked; `public/audio/vo/` and
  `public/audio/score/` are gitignored because they regenerate.
- **`Soundtrack.tsx`** places each line on its beat from `vo.json`, ducks the bed
  -6 dB inside every measured window, and puts original foley on the cuts
  (`whoosh_rtl`, `stamp_thud` on the stat, `ui_chirp` on the CTA).

It is mounted once at the film root, next to the grade and captions, so every
composition — wide, vertical, 4:5, square — carries the same mix. The control
render (`--frames=0-90`) reports `acodec: aac, arate: 48000, ach: 2`.

Final loudness is a separate, measured pass — the picture is never re-rendered
to change the mix:

```powershell
python scripts/studio.py master                 # every master in out/
python scripts/studio.py master out/film_9x16.mp4 --target -1.5
```

`master_audio.py` measures peak/RMS with the same probes the QA gate uses,
re-encodes the audio stream only (`-c:v copy`, AAC 192k, faststart), and rejects
its own output if it clips, overshoots the target by more than 0.5 dB or changes
the duration. Measured on the vertical master: peak -5.63 → **-1.51 dBFS**, RMS
-24.46 → **-20.35 dBFS**, 0 clipped. Picture frames are bit-identical because the
video stream is copied, not encoded.

## Every aspect is a layout, not a crop

`Studio16x9`, `Studio9x16`, `Portrait4x5` (1080x1350) and `Square1x1` (1080x1080)
render the same compiled film. The 4:5 and 1:1 masters are not crops of the wide
one: `Device` recomputes the phone card from the canvas, so the Arabic copy is
never clipped and the UI stays at its real scale.

The vertical master also lays itself out inside the Reels/Shorts/Stories safe
box (top 150 px, bottom 300 px at 1920). That is measured, not asserted:

```powershell
python scripts/safe_area.py out/qa/vert_device.png out/qa/vert_cta.png --preset reels
# before: 35.2% of the frame's corner energy sat under the platform UI
# after:   0.0% / 3.5%            (a synthetic control still fails at 11.8%)
```

The checker counts corner-energy (`|dL/dx| * |dL/dy|`), which type and icons
produce and a ruled-paper background or a vignette do not; the verdict is the
share of that energy sitting in the platform bands. It is a heuristic and is
documented as one — but it fails a deliberately bad frame, which a bounding-box
list never would.

## Looks, storyboards, and a critic

The grade is not a CSS approximation: `scripts/lut.py` reads the app's palette
(`src/theme.ts`), builds a per-channel transfer curve plus a saturation scalar,
and writes `src/generated/grade.json`. The film applies it as a real
`feComponentTransfer` filter — same maths, three checkpoints:

```powershell
python scripts/lut.py                       # curves + public/luts/*.cube (33^3), verified
npx remotion still src/index.ts GradeLab out/qa/grade_lab.png --frame=1
# the 16 patches must match grade.json within 1 code value (measured 0.46 mean)
```

White is protected on purpose: the paper surfaces belong to the app, so the
curve works the midtones and leaves 251 where the app says 251 (before this,
the CSS grade pushed them to 255 — a fidelity bug dressed as a look).

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

Thirteen tools and seven resources published over stdio JSON-RPC. Resources are
how an agent reads the studio's *state* without rendering anything:

| resource | what it is |
| --- | --- |
| `studio://film` | the plan: beats, bars, copy, vo |
| `studio://timeline` | the compiled timeline the compositions read |
| `studio://grade` | palette-derived curves + saturation |
| `studio://captions` | frame-timed cues for both aspect families |
| `studio://ui-source` | the real app's screens and strings (the fidelity source) |
| `studio://roadmap` | what this studio admits, plans and refuses |
| `studio://skill` | `SKILL.md`, the operating manual |

```text
tools: studio_doctor app_scan refs_search film_advise storyboard still render qa
       captions safe shotlist grade evals
```

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

## Verified status (v2.1.0)

Every number below was read from the delivered files or from a gate's own output
on this machine — not from a log line that says it probably worked.

| Master | picture | duration | peak | RMS | clipped | audio |
|---|---|---|---|---|---|---|
| `out/film_1080p.mp4` | 1920x1080 | 42.01 s | -1.51 dBFS | -20.35 dBFS | 0 | AAC 48 kHz stereo |
| `out/film_9x16.mp4` | 1080x1920 | 42.01 s | -1.51 dBFS | -20.35 dBFS | 0 | AAC 48 kHz stereo |
| `out/film_4x5.mp4` | 1080x1350 | 42.01 s | -1.51 dBFS | -20.35 dBFS | 0 | AAC 48 kHz stereo |
| `out/film_1x1.mp4` | 1080x1080 | 42.01 s | -1.51 dBFS | -20.35 dBFS | 0 | AAC 48 kHz stereo |

All four are mastered from one mix (`+4.13 dB`), so the loudness matches across
aspects; the audio gain is applied without re-encoding a single frame.

| Gate | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `make_timeline --film film/film.json --vo src/generated/vo.json --strict` | 21 bars, 1260 frames, 42.00 s, exit 0 |
| `captions --check` | 10 cues agree with `captions.json` @ 30 fps |
| `advise --strict` | 0 MUST (3 SHOULD, documented) |
| `evals` | 3/3 briefs, scores 100 / 100 / 95 |
| `safe_area.py --preset reels --strict` | device 0.0 %, CTA 3.5 % — PASS |
| `provenance --strict` | no captures declared (honest reconstruction) |
| `corpus check --min 3` | 3 pinned cards — PASS |
| `qa --require-audio` | 4/4 masters, 0 black, 0 clipped, Arabic scan clean |
| `mcp_selftest.py` | 11/11 checks over the wire (15 tools, 7 resources) |

Voice: 5 lines, 18.16 s of measured speech, fully vocalised Arabic.
Bed: 42.00 s, 48 kHz, RMS -19.9 dBFS, peak -3.0 dBFS, 0 clipped samples.

## CI

`.github/workflows/ci.yml` runs the type check, the Python syntax pass, the strict
timeline compile, the Arabic scan, the corpus gate and a Remotion bundle on every push. It needs
GitHub Actions minutes: on an account whose minutes/spending limit is exhausted,
every run in every repo dies at startup (`startup_failure`, 0 jobs, ~1 s) — that is
billing talking, not the workflow. Everything the gates check also runs locally:

```powershell
npx tsc --noEmit
python scripts/make_timeline.py --strict
python scripts/advise.py --strict           # no MUST on the shipped film
python evals/run_evals.py --min-score 90    # three golden briefs still pass
python scripts/qa.py --arabic-only
python scripts/corpus.py check --min 3      # references are committed, so this works offline
python scripts/studio.py qa --stills 8      # on rendered masters
```

## License

MIT for the code and docs. Bundled fonts are SIL OFL (Tajawal, Amiri, Noto Naskh
Arabic) — keep their licences with any redistribution. Audio one-shots in
`public/audio/sfx` are generated in-repo by `scripts/make_score.py` and are MIT
with everything else.

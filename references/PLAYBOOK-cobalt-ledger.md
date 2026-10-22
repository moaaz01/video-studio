# Playbook — Cobalt Ledger (48 s feature film)

This is the recipe that produced `projects/cobalt-store-launch`. Start here; do not
rebuild the grammar from zero. Copy the film/style, replace the product facts and the
copy, and keep the gates.

## What it is

A 48-second, 24-bar, 120 BPM Arabic product film that explains the **economics** of a
Telegram digital-products store: setup, payments, multi-source sourcing, margin,
automatic repricing, owner control. Cobalt/navy stage, silver chrome, ivory Tajawal
headlines, one champagne ledger line. Saffron is money only.

**Files that make it:**

| file | role |
|---|---|
| `film/film.json` | the current film, 6 beats / 24 bars |
| `film/style.json` | `cobalt-atelier` + `cobalt` + 4 cuts |
| `projects/cobalt-store-launch/{brief.md,PROMPT-PACK.md}` | the direction and the prompt pack |
| `src/store/setup.tsx` | the wizard board |
| `src/store/sources.tsx` | the source graph + automatic repricing |
| `src/store/scenes.tsx` | open/store/admin + payments row |
| `src/store/finale.tsx` | contact ticket |
| `src/store/atelier.tsx` | chrome ribbon, sphere, lattice, monoliths |
| `src/components/Surfaces.tsx` | `cobalt` ground |
| `src/look/looks.ts` | `cobalt-atelier` look |
| `scripts/make_bed.py` | the 48 s `souk-drop` arrangement |
| `references/templates/cobalt-ledger.json` | the reusable template card |
| `references/prompt-packs/cobalt-ledger.md` | the prompt pack, in the studio |

## The 24-bar clock

| bars | time | kind | job |
|---|---|---|---|
| 0–3 | 0–6 | `open` | the shop is his, inside Telegram |
| 3–7 | 6–14 | `setup` | wizard: identity → currency → payments → sources → products → launch; `≈ 15 دقيقة` |
| 7–12 | 14–24 | `store` | buyer path + payment methods around the phone |
| 12–17 | 24–34 | `sources` | 3 sources → cheapest → 15% margin → source rise → auto price |
| 17–21 | 34–42 | `admin` | orders, profit, notifications, broadcast |
| 21–24 | 42–48 | `finale` | contact ticket; no price |

## Build order (copy this)

```bash
# 1. choose the template and the copy
cp film/film.json film/film.json.bak
# edit beats, bars, Arabic copy, data; keep the 24-bar sum

# 2. compile + gate the copy
python3 scripts/studio.py timeline --strict

# 3. voice: Fish drama-3 + a Damascene reference
python3 scripts/studio.py voice
python3 scripts/voice_check.py --script film/vo.json --manifest src/generated/vo.json \
  --threshold 0.90 --json out/qa/vo-asr-check.json
python3 scripts/studio.py timeline --strict   # after measured durations

# 4. score + captions
python3 scripts/make_bed.py --style souk-drop --report out/audio/score-report.json
python3 scripts/captions.py --film film/film.json --vo src/generated/vo.json
python3 scripts/captions.py --check

# 5. stills at every bar line, 1:1, before any render
#    (Windows Node; WSL cannot load the Windows @rspack binding)
cmd.exe /c "node_modules\\.bin\\remotion.cmd still src/index.ts Studio16x9 out\\qa\\c_240.png --frame=240 --overwrite"

# 6. render the three masters
cmd.exe /c "node_modules\\.bin\\remotion.cmd render src/index.ts Studio16x9 out\\masters\\film_16x9.mp4 --scale=1 --codec=h264 --crf=14 --x264-preset=medium --pixel-format=yuv420p --color-space=bt709 --image-format=jpeg --concurrency=8 --overwrite"
# repeat Studio9x16 and Square1x1

# 7. master audio, QA, package
python3 scripts/master_audio.py out/masters/film_16x9.mp4 out/masters/film_9x16.mp4 out/masters/film_1x1.mp4
python3 scripts/qa.py --files out/masters/film_16x9.mp4 out/masters/film_9x16.mp4 out/masters/film_1x1.mp4 --stills 8 --require-audio
python3 scripts/advise.py film/film.json --strict
python3 scripts/package_project.py --project projects/cobalt-store-launch --stills out/delivery/cobalt/stills/*.png
```

## Gates that actually caught defects

1. **`timeline --strict`** caught the CTA at 6.7 s inside a 6.0 s beat. Shorten the
   screen copy or add a bar; never let the voice run past the bar line.
2. **ASR 0.90** caught the old Fish take on «متجرك» / «بث إشعارات». The delivered
   drama-3 take is **6/6, worst 0.985**; keep the report.
3. **1:1 still inspection** caught the source product card covering the headline, the
   price panel covering the sub, and the alert under the frame. Do not judge from a
   0.2-scale contact sheet.
4. **`qa.py`** caught nothing in the final cut, but it is the only proof of peak,
   RMS, black frames and Arabic encoding. Run it on the delivered MP4s.
5. **`templates.py --check`** caught the 4-cut template and the non-CTA ending. A
   template may not promise more than the engine can draw.

## Pitfalls, in the order they bite

- **Negative `sec` in a scene.** A scene is pre-rolled by 8 frames, so `sec` starts
  at −0.27. Any `CARD_STYLES[Math.floor(sec/2.15)]` needs `Math.max(0, …)` or it
  crashes at the transition. This happened; it is fixed in `design.tsx`.
- **Blank screen at a cut.** A screen mounted at `at(0)` has not entered when the bar
  line lands. Pre-roll the screen content by ~16 frames (`t + 16`) so the header,
  categories and price are already alive at the cut.
- **The scene is above the outgoing one only inside its clip.** A maskline/iris
  transition is a wipe: the outgoing headline remains outside the clip. Keep the
  incoming scene's data at least one text-line below the seam.
- **The data scene is three columns, not a phone.** Product centre, sources left,
  price right. The price panel must start **after** the headline's right edge; the
  product top must start **after** the sub's last line. Check all three aspects.
- **The alert is transient.** In 9:16 it sits near the platform UI band. Keep the
  price change visible in the price panel even if the toast is covered.
- **ElevenLabs library voices are blocked on the free API.** `rPNcQ53R703tTmtue1AT`
  (Mazen Lawand) returns `402 paid_plan_required`; a free plan cannot use library
  voices via the API. Do not spend credits retrying. Fish `drama-3` with the
  Damascene reference is the endorsed fallback. A paid plan or $5 of credits is the
  only switch.
- **Windows Node, not WSL.** `@rspack/binding` is Windows-native here. Render with
  `cmd.exe` and Windows paths; WSL `npx` fails.
- **Do not say «السعر على الخاص».** The approved CTA is «للمزيد من التفاصيل أو
  لمتجرك — تواصل معنا على الخاص.» The ticket foot is «… · التفاصيل على الخاص».
- **The source numbers are an example.** Label the product card «مثال»; never present
  $8.20 / $9.43 as a live quote. Payment names and setup steps are the app's own.

## The Opus-style prompt

The full code-film prompt is in `references/prompt-packs/cobalt-ledger.md`. The
short version:

> Build a 48 s, 24-bar, 120 BPM Arabic data film in Remotion. Cobalt/navy stage,
> ivory Tajawal 700/800, IBM Plex Sans Arabic body, one champagne ledger line, glass
> data cards. Six beats: open 3, setup 4, store 5, sources 5, admin 4, finale 3.
> Show the real setup steps, the real payment methods, three sources with a cheapest
> route, a 15% margin and an automatic price rise; label the numbers «مثال». End on
> the two contacts and «التفاصيل على الخاص», never a price. Every scene is a pure
> function of frame; check a still at every beat before rendering.

## Reference cards

Pinned in `references/corpus/`:

- `awesome-opus-5-5-videos-code-rendered-motion-prompts.md`
- `zero-opus-5-5-ui-motion-showreel-prompt.md`
- `dia-a-brand-painted-by-hand.md`
- `elevenlabs-brand-kit-campaigns-stay-on-brand.md`
- `haditype-showreel-whole-word-arabic-kinetic-type.md`
- `one-take-flood-handoff-photo-print.md`
- `sahi-scale-reveal-macro-to-context.md`
- `beat-locked-120-bpm-ugc-with-event-per-bar.md`

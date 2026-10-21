# StudyAI — «بتفهمها مرّة وحدة»

The second film for the official StudyAI channel: 42 seconds, spoken in Levantine
Arabic (Shami), cut for sound-on short-form, and drawn entirely from the app's real
string table and palette. This folder is the deliverable; the studio in the repo
root is the engine that made it.

- **One action:** open Telegram → `t.me/studyai0` (free, Android).
- **Aspects:** 16:9 · 9:16 · 4:5 · 1:1 — 1080-class, 30 fps, 1260 frames, 42.00 s.
- **Look and cut:** `premium-warm` on `paper-glow`, camera energy without haze.
  The beats hand over to each other — `whip` / `slide` / `blur`, 8-frame pre-roll,
  10-frame overlap — and every cut carries foley (`whoosh_rtl`), with a
  `riser_short` intro, `card_pop` accents and per-beat cues declared in `film.json`.
  Contract: `style.json`; presets: `references/cinematic-look.md` in the repo root.
- **Voice:** Fish Audio clone `shami-m-deep`
  (`e2328a22742c40888b891ba66fc114fe`), speed 0.95, five lines,
  **25.769 s of speech (61 % of the runtime)**. The clone is made from the client's
  own recorded probe (`audio/voices/shami-m-deep.wav`), so the voice rights sit with
  the client; ASR gate 5/5 lines ≥ 0.90, worst 0.954.

## Delivered masters (measured, not estimated)

| aspect | file | picture | duration | size | peak | RMS | clipped |
|---|---|---|---|---|---|---|---|
| 16:9 | `output/studyai-shami-16x9-1080p.mp4` | 1920×1080 | 42.01 s | 92.4 MB | −1.62 dBFS | −20.74 dBFS | 0 |
| 9:16 | `output/studyai-shami-9x16-1080p.mp4` | 1080×1920 | 42.01 s | 90.1 MB | −1.62 dBFS | −20.74 dBFS | 0 |
| 4:5 | `output/studyai-shami-4x5-1080p.mp4` | 1080×1350 | 42.01 s | 22.3 MB | −1.62 dBFS | −20.74 dBFS | 0 |
| 1:1 | `output/studyai-shami-1x1-1080p.mp4` | 1080×1080 | 42.01 s | 18.1 MB | −1.62 dBFS | −20.74 dBFS | 0 |

The two hero masters are encoded at **CRF 10 / `slow` / PNG frames** so the grain and
motion blur survive the encoder; the 4:5 and 1:1 teasers are **CRF 16 / `medium`**.
All four carry yuv420p + BT.709, 30 fps, and the same one-pass audio master
(**+3.14 dB**, AAC 48 kHz stereo). QA on the encoded files: no black frames,
0 clipped samples, Arabic scan clean, `qa --require-audio` green. The wave is
deliberately dynamic (VO peaks, music −9 dB under speech, −6 dB further ducked),
so RMS sits low while every word is above the bed.

## What is here

| path | what it is |
|---|---|
| `brief.md` | the six-block decision record: promise, audience, direction, banned moves, clock |
| `film.json` | the film's source of truth — beats, copy, `screen` routing, `emphasis`, per-beat `sfx`, voice |
| `style.json` | the cut contract: template · look · motion · background · transitions · sfx |
| `vo-script.json` | the exact lines sent to Fish, with the voice parameters |
| `output/` | the four finals + `stills/` (PNG). The masters are **not committed** — see below |
| `assets/` | every file the film consumed: VO wavs, music bed, compiled `timeline.json`, `vo.json`, `captions.json`, `grade.json`, app strings, both ASR reports |
| `manifest.json` | machine-written: durations, codecs, loudness, sizes, SHA-256 for everything above |
| `SHA256SUMS` | the same hashes as a plain file, verifiable with `sha256sum -c` |
| `film/` (repo root) | the studio's demo film — untouched by this project |

## Reproduce it, end to end

```bash
# 0) from the repo root, with .env holding FISH_API_KEY
python scripts/make_timeline.py --film projects/studyai-shami/film.json --strict
python scripts/voice.py     --script projects/studyai-shami/vo-script.json   # costs Fish credits; skip to reuse assets/vo
python scripts/voice_check.py --script projects/studyai-shami/vo-script.json # ASR round-trip gate
python scripts/make_bed.py  --json
python scripts/captions.py  --film projects/studyai-shami/film.json          # --check only verifies
python scripts/lut.py                                                        # grade.json + .cube
npx remotion render src/index.ts Studio16x9 out/masters/film_16x9.mp4 \
  --codec=h264 --crf=10 --x264-preset=slow --pixel-format=yuv420p \
  --color-space=bt709 --image-format=png --concurrency=75% --overwrite
#   … Studio9x16 with the same flags; Portrait4x5 / Square1x1 at --crf=16
python scripts/master_audio.py --target -1.5               # one measured gain pass
python scripts/qa.py --files out/masters/film_*.mp4 --stills 4 --require-audio
python scripts/package_project.py --project projects/studyai-shami --stills ...
```

The pipeline runs from global state (`src/generated/`, `public/audio/`, `out/`), so a
project is only reproducible after `package_project.py` has copied that state into
`assets/`. Render the demo film again afterwards with
`python scripts/make_timeline.py --film film/film.json` if you switch back.

## Audio

- Music bed composed from the same timeline (`scripts/make_bed.py`): **42.00 s, −19.9 dBFS
  RMS, peak −3.0 dBFS, 0 clipped samples** — the composer asserts its own level.
- VO is measurable, not hand-tuned: `assets/vo.json` holds the duration of every line,
  `scripts/make_timeline.py` refuses a beat whose VO does not fit with 0.35 s of air.
- **No-AI-glitch gate:** every delivered line is transcribed back with Fish ASR
  (`scripts/voice_check.py`); Arabic orthography is normalised, then character
  similarity and word count are compared against the script. 5/5 lines pass
  (threshold 0.90, worst 0.954, word delta 0) — `assets/vo-asr-check.json`.
- **End-to-end check on the mix itself:** each line was cut out of the finished 16:9
  master and transcribed; 5/5 land at 0.927–0.992 (`assets/vo-asr-master.json`). The
  worst line is `b02`, where the music masks the doubled ل in `خَلِّي` and the ASR
  writes `خلت`; the raw line is clean. This is a proxy for intelligibility, not for
  accent — the accent was approved by ear on the probe.
- Mastering is a single measured gain pass over all four masters; video is copied, never
  re-encoded (`-c:v copy`), and the pass is rejected if it clips, overshoots, or changes
  duration.

## Captions

`assets/captions.json` (+ `assets/captions/{wide,vertical}.srt`): **5 wide cues** and **8 vertical cues**, frame-timed from the
measured VO. The 9:16 master has them burned in; the wide master and the 4:5 / 1:1
teasers ship clean, because the strip would sit on the copy. The vertical plate's bottom
inset is **0.175 h (336 px of 1920)**, so the last line clears the Reels/Shorts bottom
UI band instead of hiding under it — `safe_area.py --preset reels --strict` passes on the
delivered vertical stills. Burned captions drop tashkeel (the diacritics are a TTS hint,
not display type) and keep `ملفك` / `يلخص` readable as whole words. SRTs for both aspect
families ship in `assets/captions/`.

## Honesty / provenance

- **The screens are reconstructions, not device captures.** No Android device was
  attached (`adb devices` empty) and the app was mid-build, so
  `src/components/StudyAIScreen.tsx` rebuilds the Home and Agent screens from the app's
  own resources: every visible Arabic string is pulled from
  `android/app/src/main/res/values-ar/strings_*.xml` by `scripts/app_strings.py`
  (38 keys, 0 missing), and the palette/type/spacing come from the app's Compose theme
  and `film/ui-source.json`.
- No invented numbers, ratings, awards, or store badges. The only action is the real
  Telegram distribution link, and the end card says so in plain Arabic.
- The voice is a clone of the client's own recorded Shami probe, not a stranger's public
  model; the ASR gates prove the words, and the accent itself was approved by the client
  on the raw probes (`audio/voices/` in the repo). A native-speaker spot check before
  publishing is still the honest last step.
- The finals are large (`*.mp4` is git-ignored in the studio repo by design): they live
  in `output/` on disk and are listed with hashes in `manifest.json`, so a copy can be
  verified without committing ~220 MB to git.

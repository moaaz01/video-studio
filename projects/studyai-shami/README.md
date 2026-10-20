# StudyAI — «بتفهمها مرّة وحدة»

The second film for the official StudyAI channel: 42 seconds, spoken in Levantine
Arabic (Shami), cut for sound-on short-form, and drawn entirely from the app's real
string table and palette. This folder is the deliverable; the studio in the repo root
is the engine that made it.

- **One action:** open Telegram → `t.me/studyai0` (free, Android).
- **Aspects:** 16:9 · 9:16 · 4:5 · 1:1 — 1920/1080-class, 30 fps, 1260 frames, 42.00 s.
- **Look:** `ui-daylight` (added for this film: crisp paper, mild saturation, camera
  energy instead of haze). Source in `scripts/lut.py` + `src/look/looks.ts`.
- **Voice:** Fish Audio TTS, model `s2.1-pro-free`, Levantine male reference
  `e58b89675fc345148a88d8bad896f28b`, speed 0.98, five lines, 28.54 s of speech (68 %).

## Delivered masters (measured, not estimated)

| aspect | file | picture | duration | size | peak | RMS | clipped |
|---|---|---|---|---|---|---|---|
| 16:9 | `output/studyai-shami-16x9-1080p.mp4` | 1920×1080 | 42.01 s | 64.9 MB | −1.48 dBFS | −23.77 dBFS | 0 |
| 9:16 | `output/studyai-shami-9x16-1080p.mp4` | 1080×1920 | 42.01 s | 57.1 MB | −1.48 dBFS | −23.77 dBFS | 0 |
| 4:5 | `output/studyai-shami-4x5-1080p.mp4` | 1080×1350 | 42.01 s | 42.3 MB | −1.48 dBFS | −23.77 dBFS | 0 |
| 1:1 | `output/studyai-shami-1x1-1080p.mp4` | 1080×1080 | 42.01 s | 35.1 MB | −1.48 dBFS | −23.77 dBFS | 0 |

Encoded at CRF 12, `--x264-preset=slow`, yuv420p + bt709, 30 fps; audio AAC 48 kHz
stereo after one measured gain pass. QA: no black frames, 0 clipped samples, Arabic
scan clean, `qa --require-audio` green. The wave is deliberately dynamic (VO peaks,
music −9 dB under speech, −6 dB further ducked), so RMS sits low while every word
is above the bed.

## What is here

| path | what it is |
|---|---|
| `brief.md` | the six-block decision record: promise, audience, direction, banned moves, clock |
| `film.json` | the film's source of truth — beats, copy, `screen` routing, look, voice |
| `vo-script.json` | the exact lines sent to Fish, with the voice parameters |
| `output/` | the four finals + `stills/` + `captions/` (SRT). **Not committed** — see below |
| `assets/` | every file the film consumed: VO wavs, music bed, compiled `timeline.json`, `vo.json`, `captions.json`, `grade.json`, app strings |
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
python scripts/captions.py  --film projects/studyai-shami/film.json --check
python scripts/lut.py                                                        # grade.json + .cube
python scripts/studio.py render 16x9 9x16 4x5 1x1 --crf 12 --preset slow
python scripts/master_audio.py --target -1.5               # one measured gain pass
python scripts/qa.py --files out/film_*.mp4 --stills 4 --require-audio
python scripts/package_project.py --project projects/studyai-shami --stills ...
```

The pipeline runs from global state (`src/generated/`, `public/audio/`, `out/`), so a
project is only reproducible after `package_project.py` has copied that state into
`assets/`. Render the demo film again afterwards with
`python scripts/make_timeline.py --film film/film.json` if you switch back.

## Audio

- Music bed composed from the same timeline (`scripts/make_bed.py`): **42.00 s, −19.9 dBFS
  RMS, peak −3.0 dBFS, 0 clipped samples**.
- VO is measurable, not hand-tuned: `assets/vo.json` holds the duration of every line,
  `scripts/make_timeline.py` refuses a beat whose VO does not fit with 0.35 s of air.
- **End-to-end check on the mix itself:** each line was cut out of the finished 1080p
  master and transcribed; 5/5 land at 0.968–0.990 similarity (b04 transcribes as
  «لا خطوات» although the line says «تلات خطوات» — the music masks the first
  syllable, the raw line is clean). Report: `assets/vo-asr-master.json`.
- **No-AI-glitch gate:** every delivered line is transcribed back with Fish ASR
  (`scripts/voice_check.py`); Arabic orthography is normalised, then character
  similarity and word count are compared against the script. 5/5 lines pass at ≥0.953
  similarity (threshold 0.90, word delta ≤ 1). Full report in the transcript and in
  `out/qa/vo-asr-check.json` at build time.
- Mastering is a single measured gain pass over all four masters; video is copied, never
  re-encoded (`-c:v copy`), and the pass is rejected if it clips, overshoots, or changes
  duration.

## Honesty / provenance

- **The screens are reconstructions, not device captures.** No Android device was
  attached (`adb devices` empty) and the app was mid-build, so
  `src/components/StudyAIScreen.tsx` rebuilds the Home and Agent screens from the app's
  own resources: every visible Arabic string is pulled from
  `android/app/src/main/res/values-ar/strings_*.xml` by `scripts/app_strings.py`
  (38 keys, 0 missing), and the palette/type/spacing come from the app's Compose theme
  and `film/ui-source.json`.
- No invented numbers, ratings, awards, or store badges. The only action is the real
  Telegram distribution link.
- The voice is a Fish Audio reference model described by its author as Shami; no human
  listening pass was possible in this environment. The evidence for "it says the right
  words" is the ASR round-trip above; the accent judgement itself rests on the model
  identity, and should be spot-checked by a native speaker before publishing.
- The finals are large (`*.mp4` is git-ignored in the studio repo by design): they live
  in `output/` on disk and are listed with hashes in `manifest.json`, so a copy can be
  verified without committing ~100 MB to git.

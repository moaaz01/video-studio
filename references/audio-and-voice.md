# Audio and voice

The film's sound is three layers that are built, not found: **voice**, **score**,
**foley**. They are mixed inside the composition so a re-cut moves the sound with
the picture, and they are levelled by a script so "louder" and "better" never get
confused.

## Order of work

1. Write the VO lines with the beats (`film/film.json`), one line per beat.
2. Synthesise and **measure** them (`scripts/voice.py`) — the cut is fitted to the
   real durations, never to a guess.
3. Compose the bed against the beat map (`scripts/make_score.py`), on the grid.
4. Place foley on cuts and interactions, then duck the bed under every line.
5. Level, then verify the *mixed file*, not the stems.

## Voice — Fish Audio

`scripts/voice.py` is the bridge. Endpoint, verified against the live API:

```
POST https://api.fish.audio/v1/tts
Authorization: Bearer $FISH_API_KEY
Content-Type: application/json
model: s2.1-pro-free            # or s2.1-pro for the paid ceiling

{"text": "...", "format": "wav", "sample_rate": 44100,
 "reference_id": "<voice model id, optional>",
 "prosody": {"speed": 1.0, "volume": 0, "normalize_loudness": true},
 "normalize": true, "chunk_length": 300, "latency": "normal"}
```

Returns **raw audio bytes**. Hard-won facts, each of which cost a debugging round:

- **44100 only.** `sample_rate: 48000` is rejected for `wav`
  (`Invalid sample rate 48000 for format audio/wav`). Allowed: 8000, 16000, 24000,
  32000, 44100. The studio mixes at 44.1 kHz and resamples only if a bed needs it.
- **The wav header is a placeholder.** `RIFF…size=0xFFFFFFxx`, `data…size=0xFFFFFF00`.
  `wave` then reports ~48,000 s. `voice.py` recomputes both size fields
  (`fix_wav_header`) and measures duration from the bytes present, not the header.
- **`--list-voices` may be empty.** An account with no cloned models returns
  `{"items": [], "total": 0}` and TTS still works with the default voice. A custom
  voice is a `reference_id` from the Fish web app.
- **Output is mono 44.1 kHz.** A 7.9 s Arabic line ≈ 680 KB wav.

### Key handling

The key lives in `.env` (gitignored) or `FISH_API_KEY`, never in the repo, never in
a composition. `voice.py` searches the environment, then `.env` walking up from the
repo root. If the key is missing it stops and says which two lines to run.

### Writing Arabic VO

- **Full tashkeel.** Unvocalised Arabic makes the model guess the case endings and
  it will guess wrong. Mark every word: `تَعلَّم` not `تعلم`, `مُلخَّص` not `ملخص`.
- **Punctuation is prosody.** `،` for a breath, `…` for a pause, `؟` for a lift, `.`
  for a landing. One idea per sentence; the model resets its intonation per sentence.
- **Latin brand names** stay Latin and are pronounced in English — that is the
  correct sound for a product name: `StudyAI` inside an Arabic sentence.
- **Numbers** are written as words when the digit is read ("خمس دقائق") and as
  Western digits when it is *shown* ("48 صفحة" on a card). The written and spoken
  forms may differ; that is not an inconsistency.
- **Speed 0.92–1.06.** Slower is not calmer, it is drowsy. Above 1.1 the tashkeel
  blurs.
- **Line length:** 8–16 words, or 3.0–6.5 s of speech. Longer than 7 s and the beat
  is a lecture.

### The measured manifest

`voice.py --script film/vo.json` writes `src/generated/vo.json`:

```json
[{"id": "L03", "text": "…", "wav": "audio/vo/L03.wav", "dur": 4.21, "speed": 1.0, "voice": "fish-default"}]
```

`make_timeline.py` reads `dur` and refuses a beat shorter than its line plus 0.35 s
of air. That single rule is what stops the classic "voice runs into the next cut".

## Score — composed, not licensed

`scripts/make_score.py` synthesises the whole bed from pure maths (numpy/scipy
additive + VA synthesis, no samples, no downloads). The arrangement is declarative:
`scripts/score_map.example.json` lists sections, chord plans, layer patterns and
`fx_cues`; the engine renders and reports.

Rules that make it sound composed:

- **Fixed grid.** 120 BPM, 1 bar = 2.0 s. Every cut, drop and reveal lands on a bar
  or a half-bar. Off-grid cuts are what "amateur" sounds like.
- **One idea per section.** A section changes one of: pattern, register, density.
- **Silence is an instrument.** A 0.5–1.0 s hole before the final drop is worth more
  than another layer.
- **Low end is one voice.** Bass, sub and kick share the same fundamental; a
  `bass_note` and a `sub_note` a fifth apart fight each other.
- **The duck is part of the arrangement.** The bed is written to breathe where the VO
  will sit (`depth_db` 3–4.5 dB under speech), not rescued later with a compressor.

Regenerating: `python scripts/make_score.py --map film/score.json` then
`python scripts/level_score.py` (target −21 dB in 1.5 s windows, soft knee, peak
normalise to −1.4 dBFS). **`level_score.py` always reads `music.orig.wav`** — copy
the raw render there before re-levelling or it levels an already-levelled file.

## Foley

A cut with no sound is a mistake. Minimum vocabulary for a marketing film:

| event | sound | gain |
|---|---|---|
| every cut | `whoosh_rtl` 0.10 s before the cut | 0.62–0.92 |
| big structural cut | `haptic_thud` on the cut | 0.5 |
| button / tab press | `button_click` | 0.35–0.55 |
| card appears | `card_pop` | 0.4 |
| number lands | `ding` | 0.4 |
| correct answer | `correct_chime` | 0.5 |
| reveal / drop | `sub_drop` + `riser` before | 0.7 / 0.6 |

Dedupe rule: skip a cut accent when an existing cue of the same family sits within
0.45 s, otherwise the edit machine-guns. Trim the whole foley bus to 0.5–0.6 of the
bed's perceived loudness — foley should be *felt*, not heard.

## The mix

- VO is the reference: duck the bed **under the line** (sidechain or the frame-based
  duck callback), never the whole scene.
- Peak ≤ **−1.4 dBFS** after 4× oversampling (true peak ≤ −1.0); no sample at
  |x| ≥ 0.999.
- Target RMS around **−20 to −23 dBFS** for a promo with continuous music.
- Measure the delivered MP4, not the stems — AAC can add inter-sample overs.

## Measuring without a player

`ffmpeg -f null` is disabled in this build ("Encoder not found"). Extract PCM and
measure it:

```bash
ffmpeg -y -i out/film.mp4 -vn -acodec pcm_s16le -ar 48000 -ac 2 out/qa/probe.wav
python -c "import wave,numpy as np; ..."   # peak / rms / clipped via numpy
```

`scripts/qa.py` does exactly this and prints a table per deliverable.

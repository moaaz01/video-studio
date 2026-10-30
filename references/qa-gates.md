# QA gates

A film is "done" when the delivered files pass these gates. Logs lie, encoders
report what you asked for, and a composition can look fine in Remotion Studio and
be broken in the MP4. **Probe the artifact.**

## Gate 0 — the plan is consistent

- [ ] Every beat in `film.json` is inside the timeline, contiguous, no gaps/overlaps.
- [ ] Every beat length ≥ its VO line + 0.35 s; ≥ its on-screen copy read twice.
- [ ] Cuts land on the 120 BPM grid (multiple of 30 frames at 30 fps).
- [ ] One direction, two transitions, one easing family, one type scale.
- [ ] `film/style.json` compiles: `make_timeline.py --strict` validates the look,
      the background, every transition word and every `sfx` stem.
- [ ] Captions were regenerated from *this* film (`scripts/captions.py --film
      <film>`): a stale demo cue inside a client film is a copy error, not a bug.

## Gate 0b — the form is the right form

```bash
python scripts/intake.py check --intake film/intake.json
python scripts/director.py --intake film/intake.json
python scripts/format_check.py explainer --film film/film.json --strict
python scripts/format_check.py kinetic --film film/film.json --strict
```

- Intake: every required answer and asset exists; no invented product fact.
- Director: the form/direction/clock is a proposal the user approved (or an
  override recorded in `film/treatment.json`).
- Explainer: one sentence per beat, a card per sentence, 90–170 words, measured
  VO fits, keyword and CTA present.
- Kinetic: palette, 2-bar scenes, 8 shots, one idea per shot, no parked last shot.

## Gate 1 — compiles

```bash
npx tsc --noEmit          # zero errors, zero unused imports
npx remotion compositions src/index.ts     # both aspects listed, duration correct
```

## Gate 2 — Arabic is not corrupt

```bash
python scripts/qa.py --arabic
```

Fails on `U+00E2 U+20AC`, `U+00C3`, `U+FFFD`, cp1256 `U+00D8`/`U+00D9` pairs, or any `u+FFFD` in sources **or** frames.
Corruption usually arrives through a PowerShell/`cp1256` round-trip, not through the
editor — never pass Arabic text through a shell that re-encodes.

## Gate 3 — stills read at 1:1

```bash
python scripts/qa.py --stills 8    # one still per scene, 1:1 crops
```

Read every crop by eye. Reject for: clipped diacritics, captions over UI, two
headlines fighting, text under 32 px that is meant to be read, Latin numerals mixed
with Arabic-Indic in the same film, a status bar or device chrome that should not be
there.

Then render the seams, not only the beats: one still at `cut ± 5` for every cut.
Reject if the frame is blank, if either scene is not at full size, or if the hand-off
reads as a dip to paper. That failure is invisible in beat stills and in a contact
sheet.

Below 1:1 nothing can be judged — a contact sheet is for rhythm, crops are for type.

## Gate 4 — picture integrity

```bash
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=width,height,r_frame_rate,nb_read_frames,pix_fmt,codec_name \
  -of default=nw=1 out/masters/film_16x9.mp4

ffmpeg -hide_banner -nostats -i out/masters/film_16x9.mp4 \
  -vf "blackdetect=d=0.10:pix_th=0.06:pic_th=0.98" -f null NUL
```

Expected: the intended width/height, `30/1`, `pix_fmt=yuv420p`, duration ±1 frame of
the plan, **zero `black_start` lines**. (`-f null` is disabled in some builds —
if it errors with "Encoder not found", skip the blackdetect gate rather than
faking it, and say so.)

## Gate 5 — audio

```bash
ffmpeg -y -i out/masters/film_16x9.mp4 -vn -acodec pcm_s16le -ar 48000 -ac 2 out/qa/probe.wav
```

Then, over the PCM: **peak ≤ −1.4 dBFS**, **no sample with |x| ≥ 0.999**, RMS
−20…−23 dBFS for a music-led promo, and a manual listen for: VO not buried, no
clipped sibilance, no click at a cut, no silence where a beat expects sound,
no audible loop point in the bed.

## Gate 5c — motion and the platform set

```bash
python scripts/motion_audit.py out/exports/<slug>/<slug>-9x16.mp4 --profile kinetic --end-card 3 --strict
python scripts/platforms.py export --film film/film.json --targets 9x16,16x9,1x1,4x5 --strict
```

- Kinetic: still share ≤ 40% before the end card, longest hold ≤ 0.60 s, median
  flow ≥ 2.5 px/frame (or `median_change ≥ 1.0` without OpenCV). A **type-only**
  cut uses `--profile kinetic-type` (still ≤ 60%, hold ≤ 0.60 s).
- Explainer: still share ≤ 65%, longest hold ≤ 1.20 s.
- Export: every target is the right size, audio is not clipped, and the safe-area
  verdict is PASS. The manifest is the evidence; a log is not.

## Gate 5b — the voice says the words

TTS can drop a clause or invent one and still sound fluent. Round-trip every delivered
line through ASR (`python scripts/voice_check.py --script <vo spec> --json <report>`):
normalise Arabic orthography (diacritics, alef/ya/ta-marbuta, punctuation), then require
**character similarity >= 0.90** and **word count delta <= 1** against the scripted line.
Fix the line, never the gate. This is a proxy for intelligibility, not for accent.

## Gate 6 — multi-aspect parity

- [ ] Both masters have the same frame rate, the same duration ±1 frame, the same
  script and the same clock.
- [ ] The vertical is re-composed (card layout), not the horizontal scaled.
- [ ] Nothing important sits inside the 9:16 top 220 px / bottom 320 px. Measure it,
      do not eyeball it: `python scripts/safe_area.py out/qa/final/vert_*.png --preset
      reels --strict` must be PASS (strong-edge share in the platform bands ≤ 6 %).
- [ ] Burned captions exist only where the safe band does (9:16). The 16:9 master and
      the 4:5 / 1:1 teasers ship clean; if a strip is burned in, it must not touch copy
      and its plate must sit **above** the Reels bottom band — the shipped plate's
      bottom inset is 0.175 h (336 px of 1920), so its last line clears y = 1620.

## Gate 7 — mute test

Watch the whole film with the sound off. Every beat must still say something. If a
beat only works because of the music, it has no picture and needs one.

## Gate 8 — claims

- [ ] No invented metric, rating, user count, award, or "the #1".
- [ ] Placeholder names only where the audience expects a placeholder (document
  titles, filenames).
- [ ] The call to action is real, spelled exactly as it exists (handle, URL, phone),
  and says where the thing actually comes from.
- [ ] Brand name in Latin renders as the brand writes it.

## Gate 9 — the handoff

- [ ] Files named per `platform-specs.md`, in one folder, with a thumbnail/cover.
- [ ] The project folder is produced by `scripts/package_project.py` — assets,
      masters, stills, `manifest.json`, `SHA256SUMS` — and the README states what is
      a reconstruction rather than a claim.
- [ ] `sha256sum -c SHA256SUMS` passes on the delivered folder.
- [ ] Sizes sane for the channel; duration matches the brief.
- [ ] One paragraph in the delivery note: what changed, what was measured, what is
  deliberately not there.

## Reporting

Report **measured facts**, each tied to the file it came from:

> `1080p: 1920×1080 30 fps 118.016 s 53.5 MB h264/yuv420p + AAC 48 kHz stereo; peak
> −2.15 dBFS, RMS −22.21, 0 clipped samples; blackdetect: none.`

Never report from memory or from a previous run — re-run the probe. A number you did
not measure this session is a guess with a decimal point.

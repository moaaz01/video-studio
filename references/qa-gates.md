# QA gates

A film is "done" when the delivered files pass these gates. Logs lie, encoders
report what you asked for, and a composition can look fine in Remotion Studio and
be broken in the MP4. **Probe the artifact.**

## Gate 0 — the plan is consistent

- [ ] Every beat in `film.json` is inside the timeline, contiguous, no gaps/overlaps.
- [ ] Every beat length ≥ its VO line + 0.35 s; ≥ its on-screen copy read twice.
- [ ] Cuts land on the 120 BPM grid (multiple of 30 frames at 30 fps).
- [ ] One direction, two transitions, one easing family, one type scale.

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

Below 1:1 nothing can be judged — a contact sheet is for rhythm, crops are for type.

## Gate 4 — picture integrity

```bash
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=width,height,r_frame_rate,nb_read_frames,pix_fmt,codec_name \
  -of default=nw=1 out/film_1080p.mp4

ffmpeg -hide_banner -nostats -i out/film_1080p.mp4 \
  -vf "blackdetect=d=0.10:pix_th=0.06:pic_th=0.98" -f null NUL
```

Expected: the intended width/height, `30/1`, `pix_fmt=yuv420p`, duration ±1 frame of
the plan, **zero `black_start` lines**. (`-f null` is disabled in some builds —
if it errors with "Encoder not found", skip the blackdetect gate rather than
faking it, and say so.)

## Gate 5 — audio

```bash
ffmpeg -y -i out/film_1080p.mp4 -vn -acodec pcm_s16le -ar 48000 -ac 2 out/qa/probe.wav
```

Then, over the PCM: **peak ≤ −1.4 dBFS**, **no sample with |x| ≥ 0.999**, RMS
−20…−23 dBFS for a music-led promo, and a manual listen for: VO not buried, no
clipped sibilance, no click at a cut, no silence where a beat expects sound,
no audible loop point in the bed.

## Gate 6 — multi-aspect parity

- [ ] Both masters have the same frame rate, the same duration ±1 frame, the same
  script and the same clock.
- [ ] The vertical is re-composed (card layout), not the horizontal scaled.
- [ ] Nothing important sits inside the 9:16 top 220 px / bottom 320 px.

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
- [ ] Sizes sane for the channel; duration matches the brief.
- [ ] One paragraph in the delivery note: what changed, what was measured, what is
  deliberately not there.

## Reporting

Report **measured facts**, each tied to the file it came from:

> `1080p: 1920×1080 30 fps 118.016 s 53.5 MB h264/yuv420p + AAC 48 kHz stereo; peak
> −2.15 dBFS, RMS −22.21, 0 clipped samples; blackdetect: none.`

Never report from memory or from a previous run — re-run the probe. A number you did
not measure this session is a guess with a decimal point.

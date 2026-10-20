# Platform specs

Deliver a **master** per aspect, never one file stretched everywhere. A film is
authored at one aspect and re-edited for the other; the clock and script stay, the
composition changes.

## Sizes that matter

| use | aspect | pixels | notes |
|---|---|---|---|
| YouTube / site / presentation | 16:9 | 1920×1080 | the reference master |
| Reels / Shorts / TikTok / Telegram story | 9:16 | 1080×1920 | separate cut, not a crop |
| feed post / X | 1:1 | 1080×1080 | optional third cut |
| thumbnail | 16:9 | 1280×720 | a still from the master, not a new design |
| cover | 9:16 | 1080×1920 | end card or hook still |
| 4K | 16:9 | 3840×2160 | only if the client pays for the ~6 h render |

## Safe areas

**9:16 (the demanding one).** Platform chrome eats the top and bottom:

- Top: keep ≥ 220 px clear (status/first row of UI in feeds).
- Bottom: keep ≥ 320 px clear for Reels/TikTok (caption + action rail). For
  Telegram/YouTube Shorts 120–160 px is enough — when unsure, design to 320 px.
- Right edge: Reels/TikTok action rail occupies ~120 px. Put nothing that must be
  read there.
- **Practical recipe used by this studio:** UI card inside a 668 px-wide column
  starting at y ≈ 96, caption plate below it, everything ending ≥ 260 px above the
  bottom edge.

**16:9.** 5 % margin all round (~96 px at 1080p). Keep type out of the last 40 px.

**1:1.** 8 % margin; assume the viewer is 30 cm away.

## Durations

| format | sweet spot | dies above |
|---|---|---|
| launch trailer | 20–35 s | 45 s |
| app promo / product film | 45–90 s | 120 s |
| full walkthrough | 90–140 s | 180 s |
| reel/short | 15–30 s | 45 s |
| explainer | 60–120 s | 150 s |

The audience's patience is the budget: if the runtime exceeds the sweet spot, cut a
beat — never speed up the existing ones.

## Encoding

Master, H.264 8-bit 4:2:0 BT.709:

```bash
npx remotion render src/index.ts Studio16x9 out/film_1080p.mp4 \
  --scale=1 --codec=h264 --crf=15 --x264-preset=medium \
  --pixel-format=yuv420p --color-space=bt709 --image-format=jpeg \
  --concurrency=75% --overwrite
```

- **CRF 15** for a master that will be re-encoded by a platform; CRF 18–20 for a
  single-purpose upload.
- `--concurrency` 75 % of cores for one render; if you run both aspects at once,
  split 75/25 (two 1080p renders saturate the CPU and thrash without it).
- `faststart` (`-movflags +faststart`) if the file is streamed rather than posted.
- Audio: AAC 48 kHz stereo, 192 kbps.

Measured on an 8C/12T laptop-class CPU: **~3 fps at 1080p** → a 118 s film ≈ 20 min
per master. 4K (`--scale=2`) measured 0.156 fps ≈ **6 h** — do not start it casually.

## Stills

```bash
# exact frame from the finished master (what you should do)
ffmpeg -ss 20.2 -i out/film_1080p.mp4 -frames:v 1 -vf scale=1280:720:flags=lanczos out/thumb.png
# a frame from the composition, while iterating
npx remotion still src/index.ts Studio16x9 out/qa/f.png --frame=502
```

Take cover/thumbnail frames from the **encoded deliverable**, so what the audience
sees in the thumbnail is literally in the film.

## File naming

```
<slug>_1080p.mp4        <slug>_9x16.mp4        <slug>_1x1.mp4
<slug>_thumb_1280x720.png    <slug>_cover_9x16.png
<slug>_<lang>_<aspect>_v<n>.mp4      # when versions exist
```

## Platform notes

- **Telegram** (the app-distribution channel in this studio's case): posts the file
  itself, so file size matters — a 60 s 1080p film at CRF 18–20 lands at 15–40 MB,
  which streams fine in-app. Links inside the video must be typed out as text
  (`t.me/…`), never as a QR only.
- **YouTube:** title/description are separate assets; the first 3 s decide retention;
  add the end card 8–12 s before the end so it is not cut by the end screen.
- **Reels / Shorts / TikTok:** no letterboxing, no burned-in captions the platform
  will also draw — burn the *designed* captions only.
- **X:** autoplays muted at small size; type ≥ 48 px equivalent, high contrast.

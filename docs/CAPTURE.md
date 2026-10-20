# Capturing the real app (P1-1)

The film rebuilds screens in React from `film/ui-source.json`, and that is
auditable: every string and every screen in the video traces to the Android
source. What it cannot claim is a beat where the only truth is the *running*
app — a transition mid-flight, a keyboard, a toast. Those beats should be
captured, not reconstructed.

This document is the exact procedure, and it is short on purpose: the step is
blocked here by the machine, not by the design.

## Why it is blocked on this machine

`adb devices` lists nothing (`emulator-5554` went `offline`, then disappeared).
The repository has no real screenshots of the running app outside build
artefacts, and the legacy `marketing/video/out/qa/*.png` files are stills of the
film we rendered ourselves — using them as "plates" would be a provenance lie.
So the gate is wired, the procedure is written, and no fabricated capture is
checked in.

## The procedure

```powershell
# 1. a real device or a booted emulator that adb can see as `device`, not `offline`
adb devices -l

# 2. freeze the animation clocks so a screenshot is reproducible
adb shell settings put global animator_duration_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global window_animation_scale 0

# 3. launch the app and let it settle (the version is recorded below)
adb shell am start -n com.studyai.app/.MainActivity

# 4. one screen = one screenshot, straight off the framebuffer
adb exec-out screencap -p > "film/captures/<beat-id>.png"

# 5. a moving beat = a recording at a fixed bitrate, then frames
adb shell screenrecord --bit-rate 8000000 --time-limit 20 /sdcard/<beat-id>.mp4
adb pull /sdcard/<beat-id>.mp4 "film/captures/<beat-id>.mp4"
```

A capture enters the film only after it is recorded in `film/ui-source.json`
under `captures[]`, next to the screens it replaces:

```json
{
  "id": "cap-b03-answer",
  "beat": "b03-device",
  "method": "screencap",
  "file": "film/captures/b03-device.png",
  "sha256": "…",
  "package": "com.studyai.app",
  "version_name": "1.0.0",
  "commit": "…",
  "device": "Pixel 7 / Android 14",
  "taken_at": "2026-10-21T09:00:00+03:00"
}
```

## The gate

```powershell
python scripts/provenance.py            # verify every declared capture
python scripts/provenance.py --strict   # exit 1 if any capture is missing or altered
```

It checks four things and prints a table: the file exists, its SHA-256 matches
the manifest, the beat id exists in `film/film.json`, and the package is the one
`ui_source.py` scanned. A capture that drifts from its record fails the build —
the same rule as a screen that cannot trace to source.

## What a captured beat still has to satisfy

A capture is a source of truth, so it does not get a pass on quality: it is
composited inside the same phone frame (`src/scenes/Device.tsx`), it passes the
same `advise.py` reading-time and contrast checks (the copy is still ours), and
it is tagged in the film as `screen.source = "capture:<id>"` so a reviewer can
see which beats are reconstruction and which are recorded evidence.

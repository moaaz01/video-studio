#!/usr/bin/env python3
"""Master the delivered audio: one gain stage, video untouched, measured.

The picture is rendered once at a fixed mix; the final loudness is a mastering
decision, not a re-render. This stage re-encodes the audio stream only (-c:v copy)
to a peak target, so a quiet mix reaches streaming loudness without touching a
frame, and it fails loudly if the result clips or the peak overshoots.

    python scripts/master_audio.py                      # every master in out/
    python scripts/master_audio.py out/film_9x16.mp4    # one file
    python scripts/master_audio.py --target -1.5 --json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import qa  # noqa: E402  the same probes the QA gate trusts

ROOT = pathlib.Path(__file__).resolve().parents[1]
FFMPEG = qa.FFMPEG
DEFAULT_TARGET = -1.5  # dBFS peak, leaving room for lossy re-encode overshoot
MAX_GAIN = 9.0
MIN_GAIN = 0.5


def masters() -> list[pathlib.Path]:
    return sorted(p for p in (ROOT / "out").glob("film_*.mp4") if p.is_file())


def master(path: pathlib.Path, target: float) -> dict:
    before_probe = qa.probe(path)
    before = qa.loudness(path) or {}
    peak = before.get("peak_db")
    if peak is None:
        return {"file": path.name, "status": "no audio stream"}
    gain = min(MAX_GAIN, target - float(peak))
    if gain < MIN_GAIN:
        return {"file": path.name, "status": "already at target", "gain_db": 0.0,
                "peak_before": peak, "rms_before": before.get("rms_db")}

    tmp = path.with_suffix(".mastering.mp4")
    cmd = [
        str(FFMPEG), "-y", "-hide_banner", "-nostats", "-i", str(path),
        "-af", f"volume={gain:.2f}dB",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", str(tmp),
    ]
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode != 0:
        shutil.rmtree(tmp, ignore_errors=True)
        return {"file": path.name, "status": "ffmpeg failed", "stderr": (done.stderr or "")[-400:]}

    after_probe = qa.probe(tmp)
    after = qa.loudness(tmp) or {}
    ok = (
        after.get("clipped", 1) == 0
        and after.get("peak_db") is not None
        and after["peak_db"] <= target + 0.5
        and after_probe["duration"] is not None
        and abs(float(after_probe["duration"]) - float(before_probe["duration"])) < 0.05
    )
    if not ok:
        tmp.unlink(missing_ok=True)
        return {"file": path.name, "status": "rejected", "gain_db": gain,
                "peak_before": peak, "peak_after": after.get("peak_db"),
                "clipped_after": after.get("clipped")}

    tmp.replace(path)
    return {
        "file": path.name,
        "status": "mastered",
        "gain_db": round(gain, 2),
        "peak_before": peak,
        "peak_after": after.get("peak_db"),
        "rms_before": before.get("rms_db"),
        "rms_after": after.get("rms_db"),
        "clipped_after": after.get("clipped", 0),
        "size_mb": after_probe.get("size_mb"),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="one audio mastering pass over the masters")
    ap.add_argument("files", nargs="*", type=pathlib.Path)
    ap.add_argument("--target", type=float, default=DEFAULT_TARGET, help="peak target in dBFS")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    files = args.files or masters()
    if not files:
        print("no masters in out/ - render first (studio.py render)")
        sys.exit(1)

    rows = [master(f if f.is_absolute() else ROOT / f, args.target) for f in files]
    if args.json:
        print(json.dumps(rows, indent=2))
        return
    print(f"{'file':26s} {'status':16s} {'gain':>6s} {'peak: before':>13s} {'after':>7s} {'rms':>7s}")
    failed = 0
    for row in rows:
        if row["status"] not in ("mastered", "already at target"):
            failed += 1
        print(f"{row['file']:26s} {row['status']:16s} "
              f"{row.get('gain_db', 0):+6.2f} "
              f"{row.get('peak_before', float('nan')):+13.2f} "
              f"{str(row.get('peak_after', '-')):>7s} "
              f"{str(row.get('rms_after', '-')):>7s}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

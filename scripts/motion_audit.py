#!/usr/bin/env python3
"""Measure whether a cut actually moves: still frames, holds, cuts, motion.

The kinetic-film references keep under a quarter of their frames still and never
hold a shot longer than 0.4–0.7 s. This tool measures those numbers on the
delivered MP4 — not on the plan — and fails a film that parks.

    python scripts/motion_audit.py out/exports/reel/reel-9x16.mp4 --profile kinetic --strict
    python scripts/motion_audit.py film.mp4 --profile explainer --end-card 2.5
    python scripts/motion_audit.py film.mp4 --json

Optical flow is used when `opencv-python-headless` is installed; without it the
still/hold/cut gates still run and the flow column says n/a.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import qa  # noqa: E402

W, H = 320, 180
STILL_AREA = 0.015
CUT_AREA = 0.45


def decode(path: pathlib.Path, fps: float):
    ff = qa.FFMPEG
    if not ff:
        sys.exit("ffmpeg not found (install it or npm install)")
    cmd = [ff, "-v", "error", "-i", str(path), "-vf", f"fps={fps},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    try:
        while True:
            buf = proc.stdout.read(W * H)
            if len(buf) < W * H:
                break
            yield np.frombuffer(buf, np.uint8).reshape(H, W)
    finally:
        proc.stdout.close()
        proc.wait()


def audit(path: pathlib.Path, profile: str, bpm: float, end_card: float) -> dict:
    probe = qa.probe(path)
    fps = float(probe.get("fps") or 30)
    rows = []
    prev = None
    flow_ok = True
    try:
        import cv2  # type: ignore
    except ImportError:
        cv2 = None  # type: ignore
        flow_ok = False

    for frame in decode(path, fps):
        if prev is None:
            prev = frame
            continue
        diff = cv2.absdiff(frame, prev) if cv2 is not None else np.abs(frame.astype(np.int16) - prev.astype(np.int16)).astype(np.uint8)
        area = float((diff > 24).mean())
        change = float(diff.mean())
        luma = float(frame.mean())
        dl = abs(luma - float(prev.mean()))
        flow = 0.0
        if cv2 is not None:
            f = cv2.calcOpticalFlowFarneback(prev, frame, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            mag = np.hypot(f[..., 0], f[..., 1])
            mask = (diff > 10) | (cv2.Laplacian(frame, cv2.CV_16S) != 0)
            flow = float(mag[mask].mean() * 1920 / W) if mask.any() else 0.0
        rows.append({"area": area, "change": change, "luma": luma, "dl": dl, "flow": flow})
        prev = frame

    if not rows:
        sys.exit(f"no frames decoded from {path}")

    n = len(rows)
    A = np.array([r["area"] for r in rows])
    C = np.array([r["change"] for r in rows])
    F = np.array([r["flow"] for r in rows])
    DL = np.array([r["dl"] for r in rows])
    still = A < STILL_AREA
    cut_mask = (A > CUT_AREA) & ((DL > 18) | (A > 0.6))

    # holds are measured before the end card, where a logo is allowed to rest
    limit = int(round((n / fps - max(0.0, end_card)) * fps)) if end_card > 0 else n
    limit = max(1, min(n, limit))
    runs: list[int] = []
    count = 0
    for value in still[:limit].tolist():
        if value:
            count += 1
        else:
            if count:
                runs.append(count)
            count = 0
    if count:
        runs.append(count)

    summary = {
        "file": path.name,
        "profile": profile,
        "fps": round(fps, 3),
        "seconds": round(n / fps, 2),
        "frames": n,
        "still_share": round(float(still[:limit].mean()), 3),
        "still_share_full": round(float(still.mean()), 3),
        "longest_hold_s": round(max(runs) / fps, 2) if runs else 0.0,
        "holds_over_0_6s": sum(1 for r in runs if r / fps > 0.6),
        "cuts": int(cut_mask.sum()),
        "cuts_per_10s": round(float(cut_mask.sum()) / (n / fps) * 10, 2),
        "flips": int((DL > 40).sum()),
        "median_change": round(float(np.median(C)), 2),
        "mean_area": round(float(A.mean()), 3),
        "median_flow": round(float(np.median(F)), 2) if cv2 is not None else None,
        "p90_flow": round(float(np.percentile(F, 90)), 1) if cv2 is not None else None,
        "flow_available": flow_ok,
    }

    gates = []
    if profile == "kinetic":
        gates = [
            ("still_share", summary["still_share"], 0.40, "<="),
            ("longest_hold_s", summary["longest_hold_s"], 0.60, "<="),
        ]
        if cv2 is not None:
            gates.append(("median_flow", summary["median_flow"], 2.5, ">="))
        else:
            gates.append(("median_change", summary["median_change"], 1.0, ">="))
    elif profile == "kinetic-type":
        # A type-only cut can be still between hard cuts; the hold and cut rate are
        # the honesty gates. Picture-led kinetic films must pass `kinetic`.
        gates = [
            ("still_share", summary["still_share"], 0.60, "<="),
            ("longest_hold_s", summary["longest_hold_s"], 0.60, "<="),
            ("median_change", summary["median_change"], 0.80, ">="),
        ]
    elif profile == "explainer":
        gates = [
            ("still_share", summary["still_share"], 0.65, "<="),
            ("longest_hold_s", summary["longest_hold_s"], 1.20, "<="),
            ("median_change", summary["median_change"], 0.8, ">="),
        ]

    summary["gates"] = [{"name": n, "value": v, "limit": l, "op": o,
                         "pass": (v <= l if o == "<=" else v >= l)} for n, v, l, o in gates]
    summary["pass"] = all(g["pass"] for g in summary["gates"])
    return {"summary": summary, "per_second": [
        {"s": i, "area": round(float(A[i * int(fps):(i + 1) * int(fps)].mean()), 3),
         "change": round(float(C[i * int(fps):(i + 1) * int(fps)].mean()), 2),
         "still": round(float(still[i * int(fps):(i + 1) * int(fps)].mean()), 2)}
        for i in range(int(n // fps))
    ]}


def main() -> None:
    ap = argparse.ArgumentParser(description="measure motion/holds/cuts on a delivered MP4")
    ap.add_argument("video")
    ap.add_argument("--profile", choices=["kinetic", "kinetic-type", "explainer", "any"], default="any")
    ap.add_argument("--bpm", type=float, default=120.0)
    ap.add_argument("--end-card", type=float, default=0.0, help="seconds of logo/end card excluded from the hold gate")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true", help="exit 1 if a profile gate fails")
    args = ap.parse_args()

    path = pathlib.Path(args.video)
    if not path.is_file():
        sys.exit(f"not a file: {path}")
    result = audit(path, args.profile, args.bpm, args.end_card)
    s = result["summary"]
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"{s['file']} · {s['seconds']}s · {s['fps']} fps · profile {s['profile']}\n")
        print(f"still share      {s['still_share'] * 100:5.1f}%  (full {s['still_share_full'] * 100:.1f}%)")
        print(f"longest hold     {s['longest_hold_s']:5.2f}s   ({s['holds_over_0_6s']} holds > 0.6s)")
        print(f"cuts / 10s       {s['cuts_per_10s']:5.2f}   ({s['cuts']} cuts, {s['flips']} flips)")
        print(f"median change    {s['median_change']:5.2f}")
        if s["flow_available"]:
            print(f"median flow      {s['median_flow']:5.2f} px/frame @1920")
        else:
            print("median flow      n/a (pip install opencv-python-headless for the flow gate)")
        if s["gates"]:
            print("\ngates:")
            for g in s["gates"]:
                print(f"  {'PASS' if g['pass'] else 'FAIL'}  {g['name']} = {g['value']} {g['op']} {g['limit']}")
        print(f"\n{'PASS' if s['pass'] else 'FAIL'}  motion audit")
    if args.strict and not s["pass"]:
        sys.exit(1)


if __name__ == "__main__":
    main()

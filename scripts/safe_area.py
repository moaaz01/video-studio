#!/usr/bin/env python3
"""Where the platform will draw on top of the film.

A safe-area check that measures the rendered pixels instead of trusting a
designer's bounding boxes: text and icons are the high-frequency content, so we
count strong edges inside the bands where Reels/Shorts/Stories paint their own
UI, and compare that against the whole frame.

    python scripts/safe_area.py out/qa/vert_device.png --preset reels
    python scripts/safe_area.py out/qa/*.png --preset feed --strict
    python scripts/safe_area.py --preset reels --json

Presets are fractions of the canvas height (top and bottom), measured from the
platform documentation at a 1080-wide basis:

  feed    1:1 and 4:5 in the timeline: no overlay bands, only the 4% margin
  reels   top 150 / bottom 300 of 1920  (caption, actions, progress)
  shorts  top 100 / bottom 260
  story   top 250 / bottom 250

This is a heuristic, and it says so: an edge is not always type, and a gradient
can fake one. The verdict is a fraction of the frame's strong-edge energy, not a
claim about legibility. Use it to catch a layout drifting into the UI zone.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import numpy as np
from PIL import Image

PRESETS = {
    "feed": (0.0, 0.0, 0.04),
    "reels": (150 / 1920, 300 / 1920, 0.04),
    "shorts": (100 / 1920, 260 / 1920, 0.04),
    "story": (250 / 1920, 250 / 1920, 0.04),
}

CORNER_FLOOR = 400       # |dL/dx| * |dL/dy|; ~20 levels in both directions
ENERGY_SHARE_WARN = 0.06  # of the frame's total corner energy
MARGIN_SHARE_WARN = 0.06  # outside the 4% margin
DENSITY_WARN = 0.004     # of the band's pixels


def edge_response(img):
    """Corner-like response: |dL/dx| * |dL/dy|.

    A ruled-paper background, a vignette or a horizontal rule all produce a
    gradient in one direction only, so the product is nearly zero. Type and
    icons produce both, which is what makes this a text proxy rather than a
    "stuff near the edge" counter.
    """
    a = np.asarray(img.convert("L"), dtype=np.int16)
    gx = np.abs(np.diff(a, axis=1))[:-1, :]
    gy = np.abs(np.diff(a, axis=0))[:, :-1]
    return gx * gy


def measure(img, preset: str) -> dict:
    top_f, bottom_f, margin = PRESETS[preset]
    w, h = img.size
    resp = edge_response(img)
    strong = resp >= CORNER_FLOOR
    top_px = int(top_f * h)
    bottom_px = int(bottom_f * h)
    m = int(margin * min(w, h))

    total = int(strong.sum())
    band = strong[:top_px, :].sum() + strong[h - bottom_px :, :].sum() if (top_px or bottom_px) else 0
    band_pixels = (top_px + bottom_px) * w
    share = float(band) / total if total else 0.0
    density = float(band) / band_pixels if band_pixels else 0.0

    # the margin check works even for feed formats, where there is no UI band
    inner = strong[m : h - m, m : w - m]
    outer_pixels = w * h - inner.size
    outer = total - int(inner.sum())
    margin_share = outer / total if total else 0.0
    margin_density = outer / outer_pixels if outer_pixels else 0.0

    # density is reported for context; the share is the decision, because it
    # answers the only question that matters: how much of what the viewer must
    # read would be painted over?
    band_warn = share > ENERGY_SHARE_WARN
    margin_warn = margin_share > MARGIN_SHARE_WARN
    return {
        "file": "",
        "size": [w, h],
        "preset": preset,
        "bands_px": [top_px, bottom_px],
        "margin_px": m,
        "edge_energy_share": round(share, 4),
        "band_density": round(density, 5),
        "margin_energy_share": round(margin_share, 4),
        "verdict": "WARN" if (band_warn or margin_warn) else "PASS",
        "reasons": [r for r, hit in (("band", band_warn), ("margin", margin_warn)) if hit],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="measure platform safe areas on rendered stills")
    ap.add_argument("stills", nargs="+", help="rendered PNGs")
    ap.add_argument("--preset", default="reels", choices=sorted(PRESETS))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true", help="exit 1 on any WARN")
    args = ap.parse_args()

    rows = []
    for name in args.stills:
        path = pathlib.Path(name)
        if not path.is_file():
            sys.exit(f"not a file: {path}")
        row = measure(Image.open(path), args.preset)
        row["file"] = str(path)
        rows.append(row)

    if args.json:
        print(json.dumps({"preset": args.preset, "stills": rows}, indent=2))
    else:
        print(f"safe area · preset {args.preset} (top/bottom bands as a share of height)\n")
        print(f"{'file':34s} {'size':11s} {'bands':>10s} {'band%':>7s} {'margin%':>8s}  verdict")
        for r in rows:
            print(f"{pathlib.Path(r['file']).name:34s} {r['size'][0]}x{r['size'][1]:<5d} "
                  f"{r['bands_px'][0]:>4d}/{r['bands_px'][1]:<5d} {r['edge_energy_share']*100:6.1f}% "
                  f"{r['margin_energy_share']*100:7.1f}%  {r['verdict']}")

    warns = [r for r in rows if r["verdict"] == "WARN"]
    if warns:
        print("\nwarnings:")
        for r in warns:
            print(f"  - {pathlib.Path(r['file']).name}: {r['edge_energy_share']*100:.1f}% of corner energy "
                  f"in the {args.preset} UI bands, {r['margin_energy_share']*100:.1f}% outside the "
                  f"{r['margin_px']}px margin")
    if args.strict and warns:
        sys.exit(1)


if __name__ == "__main__":
    main()

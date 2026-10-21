#!/usr/bin/env python3
"""Grade from the brand's own palette, not a borrowed .cube.

One definition, three artefacts:

  src/generated/grade.json   per-channel transfer curves + saturation, read at
                             render time by an SVG feComponentTransfer filter
  public/luts/<look>.cube    3D LUT (33^3) with the same math, for the day
                             HTML-in-canvas lands and `lut()` can grade the DOM
  stdout                     a verification table

The warmth is derived from the palette, not from taste: highlights lean toward
the parchment token, shadows toward the ink token. That is why the film's grade
and the product's screens agree.

    python scripts/lut.py                 # regenerate json + cubes, verify
    python scripts/lut.py --json-only
    python scripts/lut.py --size 17       # smaller cube for quick tests
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CURVE_POINTS = 17
CUBE_SIZE = 33

# Palette anchors (mirror src/theme.ts; asserted against it below).
INK = (0x1A, 0x2A, 0x36)
PARCHMENT = (0xF1, 0xE9, 0xDC)


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def palette() -> dict[str, tuple[int, int, int]]:
    """Read the app's palette so the grade cannot drift from the product."""
    text = (ROOT / "src" / "theme.ts").read_text(encoding="utf-8")
    out = {}
    for name in ("ink", "parchment", "emeraldLit", "emerald"):
        import re

        m = re.search(rf"{name}:\s*'(#[0-9A-Fa-f]{{6}})'", text)
        if not m:
            sys.exit(f"palette token {name} not found in src/theme.ts")
        out[name] = hex_rgb(m.group(1))
    return out


LOOKS = {
    # contrast: how far toward a filmic S-curve; gamma: midtone lift;
    # lift/gain: floor and ceiling; sat: saturation; warm: highlight tint strength
    #
    # gain is 1.0 wherever the film shows a paper-white product surface: the
    # whites belong to the app, so the grade protects them and works the midtones.
    "cinema-warm": {"contrast": 0.22, "gamma": 1.00, "lift": 0.008, "gain": 1.00, "sat": 0.97, "warm": 0.6},
    "paper-clean": {"contrast": 0.08, "gamma": 1.00, "lift": 0.002, "gain": 1.00, "sat": 1.00, "warm": 0.2},
    "ink-noir": {"contrast": 0.34, "gamma": 0.98, "lift": 0.010, "gain": 0.97, "sat": 0.88, "warm": -0.3},
    "vivid-launch": {"contrast": 0.24, "gamma": 1.00, "lift": 0.004, "gain": 1.00, "sat": 1.15, "warm": 0.45},
    # UI-first launch film: crisp paper, mild saturation, no crush — the phone screen
    # must read as the product, not as a graded photograph of it.
    "ui-daylight": {"contrast": 0.10, "gamma": 1.00, "lift": 0.004, "gain": 1.00, "sat": 1.06, "warm": 0.18},
    # Hero launch look: richer contrast and a warm key, paper whites protected so
    # the app screen still reads as the product (graded, not Instagram-filtered).
    "premium-warm": {"contrast": 0.18, "gamma": 0.995, "lift": 0.005, "gain": 1.005, "sat": 1.10, "warm": 0.30},
}


def clamp(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def smoothstep(x: float) -> float:
    return x * x * (3 - 2 * x)


def rolloff(y: float, knee: float = 0.93, strength: float = 0.05) -> float:
    """Filmic shoulder: keep highlights from clipping flat."""
    if y <= knee:
        return y
    over = (y - knee) / (1 - knee)
    return knee + (1 - knee) * (over - strength * over * over)


def transfer(x: float, look: dict, channel: int, pal: dict) -> float:
    """The whole grade, one scalar in and one out, monotonic by construction."""
    y = clamp(x)
    y = clamp(y + look["contrast"] * (smoothstep(y) - y))
    y = clamp(y ** (1.0 / look["gamma"]))
    y = clamp(look["lift"] + (look["gain"] - look["lift"]) * y)
    y = rolloff(y)

    # warmth: highlights lean to parchment, shadows to ink, per channel
    warm = look["warm"]
    parch, ink = pal["parchment"], pal["ink"]
    for token, weight in ((parch, 1.0), (ink, 0.45)):
        delta = ((token[channel] - 128) / 128.0) * warm * weight
        # strongest in the upper midtones, gentle at both ends
        y = clamp(y + delta * 0.035 * (y * (1 - y)) * 4)
    return y


def curves_for(name: str, pal: dict, points: int = CURVE_POINTS) -> list[list[float]]:
    look = LOOKS[name]
    return [
        [round(transfer(i / (points - 1), look, c, pal), 6) for i in range(points)]
        for c in range(3)
    ]


def is_monotonic(values: list[float]) -> bool:
    return all(b >= a - 1e-9 for a, b in zip(values, values[1:]))


def write_json(names: list[str], pal: dict) -> pathlib.Path:
    payload = {}
    for name in names:
        curves = curves_for(name, pal)
        for c, channel in enumerate("rgb"):
            if not is_monotonic(curves[c]):
                sys.exit(f"{name}.{channel} curve is not monotonic - the grade would posterise")
        payload[name] = {"curves": {"r": curves[0], "g": curves[1], "b": curves[2]}, "saturate": LOOKS[name]["sat"]}
    dest = ROOT / "src" / "generated" / "grade.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return dest


def write_cube(name: str, pal: dict, size: int = CUBE_SIZE) -> pathlib.Path:
    look = LOOKS[name]
    curves = curves_for(name, pal)

    def sample(curve: list[float], x: float) -> float:
        pos = x * (len(curve) - 1)
        lo = int(pos)
        hi = min(lo + 1, len(curve) - 1)
        f = pos - lo
        return curve[lo] * (1 - f) + curve[hi] * f

    sat = look["sat"]
    lines = [f'TITLE "{name}"', f"LUT_3D_SIZE {size}", "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"]
    lum = (0.2126, 0.7152, 0.0722)
    for b in range(size):
        for g in range(size):
            for r in range(size):
                rgb = [r / (size - 1), g / (size - 1), b / (size - 1)]
                out = [sample(curves[c], rgb[c]) for c in range(3)]
                y = sum(w * v for w, v in zip(lum, out))
                out = [clamp(y + (v - y) * sat) for v in out]
                lines.append(" ".join(f"{v:.6f}" for v in out))
    dest = ROOT / "public" / "luts" / f"{name}.cube"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return dest


def verify(names: list[str], pal: dict, cube_lines: dict[str, int]) -> None:
    print(f"{'look':14s} {'curve mid':>9s} {'curve high':>10s} {'gray cast':>10s} {'monotonic':>9s} {'cube':>7s}")
    ok = True
    for name in names:
        curves = curves_for(name, pal)
        mid = curves[1][CURVE_POINTS // 2]
        high = curves[1][-1]
        gray = [curves[c][CURVE_POINTS // 2] for c in range(3)]
        cast = max(gray) - min(gray)
        mono = all(is_monotonic(curves[c]) for c in range(3))
        ok = ok and mono and 0.15 < mid < 0.85
        print(f"{name:14s} {mid:9.4f} {high:10.4f} {cast:10.4f} {str(mono):>9s} {cube_lines[name]:7d}")
    ink_ratio = (pal["ink"][2] - pal["ink"][0]) / 255
    print(f"\npalette: ink {pal['ink']} parchment {pal['parchment']} emerald {pal['emerald']}")
    print(f"shadow direction: {'cool (blue over red by ' + format(ink_ratio, '.3f') + ')' if ink_ratio > 0 else 'warm'}")
    if not ok:
        sys.exit("grade verification failed")


def main() -> None:
    ap = argparse.ArgumentParser(description="generate the palette-derived grade")
    ap.add_argument("--size", type=int, default=CUBE_SIZE, help="LUT_3D_SIZE (default 33)")
    ap.add_argument("--json-only", action="store_true", help="skip the .cube files")
    args = ap.parse_args()

    pal = palette()
    names = list(LOOKS)
    dest = write_json(names, pal)
    print(f"curves -> {dest.relative_to(ROOT)} ({CURVE_POINTS} points per channel)")
    counts: dict[str, int] = {}
    if not args.json_only:
        for name in names:
            cube = write_cube(name, pal, args.size)
            counts[name] = args.size**3
            print(f"cube   -> {cube.relative_to(ROOT)} ({args.size}^3 = {counts[name]} entries)")
    else:
        counts = {name: 0 for name in names}
    verify(names, pal, counts)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render the same beat in several looks, so the client chooses from pictures.

    python scripts/looks.py                      # 2 beats x every look -> out/looks/
    python scripts/looks.py --frame 200 --looks cinema-warm,ink-noir

This is the "advise with real frames" step: the frames are the film itself, not a
moodboard scraped from the internet, so what is chosen is what ships.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "out" / "looks"


def looks_available() -> list[str]:
    src = ROOT / "src" / "look" / "looks.ts"
    text = src.read_text(encoding="utf-8")
    import re

    return re.findall(r'"([a-z-]+)":\s*\{', text)


def run(cmd: list[str]) -> int:
    print("$ " + " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=ROOT)


def main() -> None:
    ap = argparse.ArgumentParser(description="look variants as real frames")
    ap.add_argument("--frame", type=int, action="append", default=None)
    ap.add_argument("--looks", default=None, help="comma separated, default all")
    args = ap.parse_args()

    npx = shutil.which("npx")
    if not npx:
        sys.exit("npx not found - install Node 18+")
    OUT.mkdir(parents=True, exist_ok=True)

    frames = args.frame or [200]
    names = (args.looks.split(",") if args.looks else looks_available())
    made: list[tuple[str, int, pathlib.Path]] = []
    for name in names:
        for frame in frames:
            dest = OUT / f"{name}-f{frame}.png"
            props = json.dumps({"look": name})
            cmd = [npx, "remotion", "still", "src/index.ts", "Studio16x9", str(dest), f"--frame={frame}", f"--props={props}", "--overwrite"]
            if run(cmd) != 0:
                sys.exit(f"look {name} frame {frame} failed")
            made.append((name, frame, dest))

    print(f"\n{len(made)} frame(s) in {OUT.relative_to(ROOT)}:")
    for name, frame, dest in made:
        print(f"  {name:14s} frame {frame:4d}  {dest.relative_to(ROOT)}")
    print("\nshow these, ask which one, then set film.look and re-render.")


if __name__ == "__main__":
    main()

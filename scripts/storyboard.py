#!/usr/bin/env python3
"""Render the storyboard sheet, and optionally one still per beat.

The sheet is produced by Remotion, not by an image library, so the Arabic in the
panels is shaped exactly as the film will shape it: what the client annotates is
what ships.

    python scripts/storyboard.py                # out/storyboard/sheet.png
    python scripts/storyboard.py --panels       # + one still per beat
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "out" / "storyboard"


def run(cmd: list[str]) -> int:
    print("$ " + " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=ROOT)


def main() -> None:
    ap = argparse.ArgumentParser(description="storyboard sheet from the engine")
    ap.add_argument("--film", default="film/film.json")
    ap.add_argument("--panels", action="store_true", help="also render one still per beat")
    ap.add_argument("--frame", type=int, default=45, help="composition frame used for the sheet")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    npx_bin = shutil.which("npx")
    if not npx_bin:
        sys.exit("npx not found - install Node 18+")
    npx = [npx_bin, "remotion"]

    sheet = OUT / "sheet.png"
    cmd = [*npx, "still", "src/index.ts", "Storyboard", str(sheet), f"--frame={args.frame}", "--overwrite"]
    if run(cmd) != 0:
        sys.exit("storyboard sheet failed")

    if args.panels:
        film = json.loads((ROOT / args.film).read_text(encoding="utf-8"))
        fps = film.get("fps", 30)
        for b in film.get("beats", []):
            local = int(max(1, min(float(b.get("dur", 0)) - 3, 40)))
            frame = int(b.get("start", 0)) + local
            dest = OUT / f"panel-{b.get('id', 'beat')}.png"
            if run([*npx, "still", "src/index.ts", "Studio16x9", str(dest), f"--frame={frame}", "--overwrite"]) != 0:
                sys.exit(f"panel {b.get('id')} failed")
            print(f"  panel {b.get('id')} at frame {frame} ({(frame / fps):.2f}s)")

    print(f"\nstoryboard: {sheet.relative_to(ROOT)} ({sheet.stat().st_size // 1024} KB)")
    print("annotate this, not a memory of the film.")


if __name__ == "__main__":
    main()

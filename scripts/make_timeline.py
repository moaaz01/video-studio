#!/usr/bin/env python3
"""Compile `film/film.json` into the timeline the composition reads.

The film's whole structure lives in one small JSON file: beats, copy, bars, voice
lines. This script is the compiler — it turns bars into frames, checks the plan
against the rules (grid, reading time, VO fit), and writes
`src/generated/timeline.json`, which is the only thing Remotion imports.

    python scripts/make_timeline.py                 # film/film.json -> src/generated/timeline.json
    python scripts/make_timeline.py --film other.json --strict
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
KINDS = {"hook", "device", "stat", "cta"}
TONES = {"ink", "paper", "emerald"}
# Reading budget: new words are slow, filler is fast. Arabic UI copy averages
# ~0.42 s per word when it must be read at a glance.
SEC_PER_WORD = 0.42
VO_TAIL = 0.35  # air after a line, before the cut


def words(s: str | None) -> int:
    return len([w for w in (s or "").split() if w.strip()])


def load_vo(path: pathlib.Path) -> dict[str, float]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(x["id"]): float(x.get("dur") or 0.0) for x in data}


def main() -> None:
    p = argparse.ArgumentParser(description="compile film.json -> timeline.json")
    p.add_argument("--film", default="film/film.json")
    p.add_argument("--out", default="src/generated/timeline.json")
    p.add_argument("--vo", default="src/generated/vo.json", help="measured VO manifest")
    p.add_argument("--strict", action="store_true", help="warnings become errors")
    a = p.parse_args()

    film = json.loads((ROOT / a.film).read_text(encoding="utf-8"))
    fps: int = film.get("fps", 30)
    bpm: int = film.get("bpm", 120)
    bar_frames = round(fps * 240 / bpm)  # 4/4 bar, 60 frames at 120 BPM / 30 fps
    vo = load_vo(ROOT / a.vo)

    problems: list[str] = []
    warnings: list[str] = []
    beats_out = []
    cursor = 0

    for i, b in enumerate(film.get("beats", [])):
        bid = b.get("id") or f"b{i + 1:02d}"
        kind = b.get("kind")
        if kind not in KINDS:
            problems.append(f"{bid}: kind {kind!r} not in {sorted(KINDS)}")
            kind = "hook"
        tone = b.get("tone", "paper")
        if tone not in TONES:
            problems.append(f"{bid}: tone {tone!r} not in {sorted(TONES)}")
        bars = float(b.get("bars") or 0)
        if bars <= 0:
            problems.append(f"{bid}: needs a positive `bars`")
            bars = 2
        dur = int(round(bars * bar_frames))
        seconds = dur / fps

        # reading time for the copy that actually appears
        shown = [b.get("line1"), b.get("line2"), b.get("kicker")]
        if kind == "stat":
            shown.append((b.get("stat") or {}).get("label"))
        need = words(" ".join(s for s in shown if s)) * SEC_PER_WORD
        if need > seconds:
            warnings.append(f"{bid}: copy needs ~{need:.1f}s but the beat is {seconds:.1f}s")

        # voice must fit with air to spare
        lines = b.get("vo") or []
        vo_total = sum(vo.get(f"{bid}-{j + 1}", 0.0) for j in range(len(lines)))
        if vo_total and vo_total + VO_TAIL > seconds:
            problems.append(
                f"{bid}: VO {vo_total:.2f}s + {VO_TAIL}s air > beat {seconds:.2f}s "
                f"(add bars or shorten the line)"
            )

        beats_out.append({
            "id": bid,
            "kind": kind,
            "tone": tone,
            "start": cursor,
            "end": cursor + dur,
            "dur": dur,
            "kicker": b.get("kicker") or "",
            "line1": b.get("line1") or "",
            "line2": b.get("line2") or "",
            "stat": b.get("stat"),
            "screen": b.get("screen"),
            "vo": lines,
        })
        cursor += dur

    total = cursor
    if total % bar_frames:
        warnings.append(f"total {total} frames is not a whole number of bars ({bar_frames})")

    tl = {
        "fps": fps,
        "look": film.get("look"),
        "width": film.get("width", 1920),
        "height": film.get("height", 1080),
        "bpm": bpm,
        "frames": total,
        "beats": beats_out,
    }
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(tl, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # report
    print(f"{'beat':16s} {'kind':7s} {'bars':>4s} {'sec':>6s} {'frames':>7s} {'words':>6s} {'vo(s)':>6s}")
    for b in beats_out:
        n = words(" ".join(x for x in (b["kicker"], b["line1"], b["line2"]) if x))
        vt = sum(vo.get(f"{b['id']}-{j + 1}", 0.0) for j in range(len(b["vo"])))
        print(f"{b['id']:16s} {b['kind']:7s} {b['dur'] / bar_frames:4.0f} {b['dur'] / fps:6.2f} "
              f"{b['dur']:7d} {n:6d} {vt:6.2f}")
    print(f"\ntotal {total} frames = {total / fps:.2f}s = {total / bar_frames:.0f} bars @ {bpm} BPM")

    for w in warnings:
        print(f"WARN  {w}")
    for pr in problems:
        print(f"FAIL  {pr}")
    if problems:
        sys.exit(1)
    if warnings and a.strict:
        sys.exit(1)
    print(f"\nwrote {a.out}")


if __name__ == "__main__":
    main()

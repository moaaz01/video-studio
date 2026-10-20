#!/usr/bin/env python3
"""Golden briefs: prove that a good plan compiles and scores before any render.

Three briefs cover the studio's three shapes (device film, launch/kinetic,
Arabic editorial). Each one must:

  1. satisfy the schema (a film the engine can actually read),
  2. compile through `make_timeline.py --strict` (beats fit the 120 BPM grid),
  3. pass the measured design review with no MUST and a score at or above the floor.

    python evals/run_evals.py            # table, exit 1 on any failure
    python evals/run_evals.py --json
    python evals/run_evals.py --min-score 95
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import advise as advisor  # noqa: E402

KINDS = {"hook", "device", "stat", "cta"}
TONES = {"ink", "paper", "emerald"}
FPS = 30
BPM = 120


def schema_errors(film: dict) -> list[str]:
    errors: list[str] = []
    for key in ("fps", "width", "height", "bpm", "beats"):
        if key not in film:
            errors.append(f"missing top-level '{key}'")
    beats = film.get("beats") or []
    if not beats:
        errors.append("no beats")
    seen_ids: set[str] = set()
    for i, b in enumerate(beats):
        where = f"beat[{i}]"
        if not b.get("id"):
            errors.append(f"{where}: no id")
        elif b["id"] in seen_ids:
            errors.append(f"{where}: duplicate id {b['id']}")
        seen_ids.add(b.get("id", ""))
        if b.get("kind") not in KINDS:
            errors.append(f"{where}: kind {b.get('kind')!r} not in {sorted(KINDS)}")
        if b.get("tone") not in TONES:
            errors.append(f"{where}: tone {b.get('tone')!r} not in {sorted(TONES)}")
        bars = b.get("bars")
        if not isinstance(bars, (int, float)) or bars <= 0:
            errors.append(f"{where}: bars must be a positive number")
        if not isinstance(b.get("vo"), list) or not b.get("vo"):
            errors.append(f"{where}: no vo lines (a silent beat reads as a slate)")
    declared = film.get("frames")
    if declared:
        grid = sum(float(b.get("bars", 0)) for b in beats) * (240.0 / float(film.get("bpm", BPM))) * float(film.get("fps", FPS))
        if abs(grid - float(declared)) > 0.5:
            errors.append(f"frames {declared} disagrees with the bar grid ({grid:.0f})")
    return errors


def compiles(brief: pathlib.Path) -> tuple[bool, str]:
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "timeline.json"
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "make_timeline.py"), "--film", str(brief), "--out", str(out), "--strict"],
            cwd=ROOT, capture_output=True, text=True,
        )
        text = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode == 0 and out.is_file(), text.strip().splitlines()[-1] if text.strip() else ""


def main() -> None:
    ap = argparse.ArgumentParser(description="score the golden briefs")
    ap.add_argument("--min-score", type=int, default=90)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    briefs = sorted((ROOT / "evals" / "briefs").glob("*.json"))
    if not briefs:
        sys.exit("no briefs in evals/briefs")

    rows = []
    failed = 0
    for brief in briefs:
        film = json.loads(brief.read_text(encoding="utf-8"))
        errors = schema_errors(film)
        ok_compile, note = compiles(brief) if not errors else (False, "skipped: schema")
        report = advisor.advise(brief) if not errors else {"score": 0, "counts": {"MUST": 0}, "seconds": 0}
        reasons = list(errors)
        if not errors and not ok_compile:
            reasons.append(f"timeline did not compile: {note}")
        if not errors and report["counts"]["MUST"]:
            reasons.append(f"{report['counts']['MUST']} MUST finding(s)")
        if not errors and report["score"] < args.min_score:
            reasons.append(f"score {report['score']} < floor {args.min_score}")
        status = "PASS" if not reasons else "FAIL"
        if reasons:
            failed += 1
        rows.append({
            "brief": brief.name,
            "beats": len(film.get("beats", [])),
            "seconds": report.get("seconds", 0),
            "score": report.get("score", 0),
            "compiles": ok_compile,
            "status": status,
            "reasons": reasons,
        })

    if args.json:
        print(json.dumps({"floor": args.min_score, "briefs": rows}, ensure_ascii=False, indent=2))
    else:
        print(f"golden briefs (floor {args.min_score})\n")
        print(f"{'brief':28s} {'beats':>5s} {'sec':>6s} {'score':>5s} {'compiles':>8s}  status")
        for r in rows:
            print(f"{r['brief']:28s} {r['beats']:5d} {r['seconds']:6.1f} {r['score']:5d} {str(r['compiles']):>8s}  {r['status']}")
            for reason in r["reasons"]:
                print(f"    - {reason}")
        print(f"\n{len(rows) - failed}/{len(rows)} briefs pass")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()

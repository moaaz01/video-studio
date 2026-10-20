#!/usr/bin/env python3
"""Verify that every declared capture is the file it claims to be.

A capture is evidence: it must exist, hash to the record in
`film/ui-source.json`, belong to a beat that the film really has, and come from
the package the scanner saw. If any of that drifts, the film is citing something
it cannot prove, so the check fails instead of warning.

    python scripts/provenance.py
    python scripts/provenance.py --strict
    python scripts/provenance.py --json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load(path: pathlib.Path) -> dict:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def check(root: pathlib.Path = ROOT) -> dict:
    source = load(root / "film" / "ui-source.json")
    film = load(root / "film" / "film.json")
    captures = source.get("captures") or []
    beats = {beat.get("id") for beat in film.get("beats", [])}
    package = source.get("package")

    rows = []
    for entry in captures:
        rel = entry.get("file") or ""
        path = root / rel
        problems = []
        if not rel:
            problems.append("no file recorded")
        elif not path.is_file():
            problems.append("file missing")
        else:
            recorded = (entry.get("sha256") or "").lower()
            actual = sha256(path)
            if recorded and recorded != actual:
                problems.append(f"sha256 mismatch ({recorded[:12]}.. != {actual[:12]}..)")
            if not recorded:
                problems.append("no sha256 recorded")
        beat = entry.get("beat")
        if beat and beat not in beats:
            problems.append(f"beat {beat!r} is not in film.json")
        if package and entry.get("package") and entry["package"] != package:
            problems.append(f"package {entry['package']!r} != scanned {package!r}")
        rows.append(
            {
                "id": entry.get("id", "?"),
                "beat": beat or "-",
                "method": entry.get("method", "-"),
                "file": rel or "-",
                "problems": problems,
            }
        )
    return {"declared": len(rows), "rows": rows, "ok": all(not row["problems"] for row in rows)}


def main() -> None:
    ap = argparse.ArgumentParser(description="verify declared app captures")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any capture is unproven")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    report = check()
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        if not report["declared"]:
            print("no captures declared — every screen in this film is a reconstruction")
            print("documented procedure: docs/CAPTURE.md")
        else:
            print(f"captures · {report['declared']} declared\n")
            print(f"{'id':28s} {'beat':16s} {'method':12s} file")
            for row in report["rows"]:
                mark = "ok" if not row["problems"] else "FAIL"
                print(f"{row['id']:28s} {row['beat']:16s} {row['method']:12s} {row['file']}  [{mark}]")
                for problem in row["problems"]:
                    print(f"    - {problem}")
    if args.strict and not report["ok"]:
        sys.exit(1)


if __name__ == "__main__":
    main()

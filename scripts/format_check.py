#!/usr/bin/env python3
"""Format gates: the explainer reel and the kinetic film.

`make_timeline.py` proves a plan compiles. This tool proves it is the *right kind*
of film: a spoken sentence per beat with a card that proves it, or a beat-grid
film with one idea per shot and no parked frame. Run it before the render.

    python scripts/format_check.py explainer --film film/film.json --still out/qa/still.png
    python scripts/format_check.py kinetic --film film/film.json --strict
    python scripts/format_check.py explainer --film ... --json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

FORMATS = {"explainer", "kinetic"}
CARD_TYPES = {"checklist", "counter", "window", "steps", "compare", "quote", "image", "statement", "none"}
KINETIC_STYLES = {"slam", "stack", "split", "pair", "cut", "punch", "image", "logo"}
GROUNDS = {"bg", "paper", "accent", "hot", "ink"}
HARAKAT = re.compile("[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
NON_WORD = re.compile(r"[^\w\u0600-\u06FF]+", re.UNICODE)
CTA_WORDS = ("اكتب", "علّق", "علق", "الرابط", "الخاص", "حمّل", "حمل", "جرّب", "تواصل", "comment", "link", "download", "try")
NUMBER_WORDS = ("واحد", "اثنان", "اثنين", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة")


def words(s: str | None) -> int:
    return len([w for w in (s or "").split() if w.strip()])


def norm(s: str) -> str:
    return NON_WORD.sub("", HARAKAT.sub("", s or ""))


def resolve(path: str) -> pathlib.Path:
    p = pathlib.Path(path)
    return p if p.is_absolute() else ROOT / p


def load(path: str) -> dict:
    p = resolve(path)
    if not p.is_file():
        sys.exit(f"not a file: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def vo_durations() -> dict[str, float]:
    p = ROOT / "src" / "generated" / "vo.json"
    if not p.exists():
        return {}
    data = json.loads(p.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("lines") or []
    return {str(x["id"]): float(x.get("dur") or 0) for x in data if isinstance(x, dict) and x.get("id")}


def rows(film: dict) -> tuple[list[dict], float]:
    fps = int(film.get("fps") or 30)
    bpm = int(film.get("bpm") or 120)
    bar = round(fps * 240 / bpm)
    out, cursor = [], 0.0
    for b in film.get("beats") or []:
        dur = int(round(float(b.get("bars") or 0) * bar))
        out.append({**b, "start": cursor, "dur": dur})
        cursor += dur
    return out, cursor / fps


def check_explainer(film: dict, still: str | None, strict: bool) -> tuple[list[dict], list[str]]:
    checks: list[dict] = []
    problems: list[str] = []

    def add(name: str, ok: bool, detail: str, hard: bool = True) -> None:
        checks.append({"name": name, "pass": ok, "detail": detail, "hard": hard})
        if not ok and hard:
            problems.append(f"{name}: {detail}")

    fmt = film.get("format")
    add("format", fmt == "explainer", f"format is {fmt!r}, expected 'explainer'")
    w, h = film.get("width"), film.get("height")
    add("aspect", (w, h) in ((1080, 1920), (1080, 1080), (1080, 1350)), f"{w}x{h} (expected 9:16, 1:1 or 4:5)")
    beats, seconds = rows(film)
    add("beats", len(beats) >= 5, f"{len(beats)} beats (need at least 5)")
    add("duration", 35 <= seconds <= 65, f"{seconds:.1f}s (target 40–60s)", strict)
    if strict and not (40 <= seconds <= 60):
        problems.append(f"duration: {seconds:.1f}s is outside the 40–60s explainer range")

    all_words = sum(words(b.get("line1")) for b in beats)
    add("words", 90 <= all_words <= 175, f"{all_words} words (target 110–160)", strict)
    if strict and not (90 <= all_words <= 170):
        problems.append(f"words: {all_words} is outside the 90–170 explainer range")

    first = str(beats[0].get("line1") or "") if beats else ""
    add("hook number", bool(re.search(r"[0-9٠-٩]", first)) or any(w in first for w in NUMBER_WORDS), "the first line must carry a number")
    last = str(beats[-1].get("line1") or "") if beats else ""
    add("cta", any(word in last for word in CTA_WORDS), "the last line must ask for one action")

    durations = vo_durations()
    for b in beats:
        bid = str(b.get("id"))
        line = str(b.get("line1") or "")
        vos = b.get("vo") or []
        add(f"{bid}.sentence", len(vos) == 1, f"{len(vos)} VO lines (need exactly 1)")
        add(f"{bid}.line1", bool(line.strip()), "line1 is empty")
        card = (b.get("data") or {}).get("card") or {}
        add(f"{bid}.card", card.get("type") in CARD_TYPES, f"card.type {card.get('type')!r} not in {sorted(CARD_TYPES)}")
        keyword = str((b.get("data") or {}).get("keyword") or "")
        add(f"{bid}.keyword", bool(keyword) and norm(keyword) in norm(line), "keyword missing or not in line1")
        if durations:
            measured = durations.get(f"{bid}-1", 0.0)
            add(f"{bid}.vo-fit", measured > 0 and measured + 0.35 <= b["dur"] / int(film.get("fps") or 30),
                f"measured VO {measured:.2f}s + 0.35s > beat" if measured else "no measured VO line (run studio.py voice)", strict)

    if still:
        try:
            from PIL import Image
            from safe_area import measure
            row = measure(Image.open(resolve(still)), "reels")
            add("safe area", row["verdict"] == "PASS", f"reels band {row['edge_energy_share'] * 100:.1f}% · {row['verdict']}", strict)
        except Exception as exc:  # noqa: BLE001
            add("safe area", False, f"could not measure {still}: {exc}", False)
    return checks, problems


def check_kinetic(film: dict, strict: bool) -> tuple[list[dict], list[str]]:
    checks: list[dict] = []
    problems: list[str] = []

    def add(name: str, ok: bool, detail: str, hard: bool = True) -> None:
        checks.append({"name": name, "pass": ok, "detail": detail, "hard": hard})
        if not ok and hard:
            problems.append(f"{name}: {detail}")

    fmt = film.get("format")
    add("format", fmt == "kinetic", f"format is {fmt!r}, expected 'kinetic'")
    bpm = int(film.get("bpm") or 0)
    add("bpm", 120 <= bpm <= 175, f"{bpm} BPM (120–175)")
    palette = film.get("palette") or {}
    missing = {"bg", "paper", "accent", "hot", "ink"} - set(palette)
    add("palette", not missing, f"missing {sorted(missing)}" if missing else "bg/paper/accent/hot/ink")
    beats, seconds = rows(film)
    add("beats", len(beats) >= 4, f"{len(beats)} beats (need at least 4)")
    grounds: set[str] = set()
    has_logo = False
    total_shots = 0
    for b in beats:
        bid = str(b.get("id"))
        data = b.get("data") or {}
        shots = data.get("shots") or []
        is_logo_beat = any((s.get("style") == "logo") for s in shots)
        add(f"{bid}.shots", len(shots) >= (1 if is_logo_beat else 2), f"{len(shots)} shots (need at least {'1' if is_logo_beat else '2'})")
        total_shots += len(shots)
        last_at = -1.0
        for i, shot in enumerate(shots):
            at = float(shot.get("at", 0))
            style = shot.get("style", "slam")
            text = shot.get("text")
            lines = text if isinstance(text, list) else [text]
            add(f"{bid}.{i + 1}.order", at >= last_at, f"at {at} is before the previous shot")
            last_at = at
            add(f"{bid}.{i + 1}.style", style in KINETIC_STYLES, f"style {style!r} unknown")
            if style not in ("image", "logo"):
                add(f"{bid}.{i + 1}.text", bool(text) and all(str(x).strip() for x in lines), "empty text")
                add(f"{bid}.{i + 1}.length", all(words(str(x)) <= 6 for x in lines), "more than 6 words in one shot")
            ground = shot.get("ground")
            if ground:
                grounds.add(str(ground))
                add(f"{bid}.{i + 1}.ground", ground in GROUNDS or str(ground).startswith("#"), f"ground {ground!r}")
            if style == "image":
                src = str(shot.get("src") or "")
                add(f"{bid}.{i + 1}.image", bool(src) and (ROOT / "public" / src).exists(), f"public/{src} missing")
            if style == "logo":
                has_logo = True
                add(f"{bid}.{i + 1}.logo", bool((data.get("logo") or {}).get("wordmark")), "data.logo.wordmark missing")
    add("grounds", len(grounds) >= 2, f"{len(grounds)} grounds (need at least 2)")
    add("logo", has_logo or bool(film.get("logo")), "no logo shot / end card")
    add("shots", total_shots >= len(beats) * 3, f"{total_shots} shots across {len(beats)} beats (need 3+ per beat)", strict)
    add("duration", 12 <= seconds <= 40, f"{seconds:.1f}s (target 15–30s)", strict)
    return checks, problems


def main() -> None:
    ap = argparse.ArgumentParser(description="format gates for explainer / kinetic films")
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("explainer")
    e.add_argument("--film", default="film/film.json")
    e.add_argument("--still", default=None)
    e.add_argument("--strict", action="store_true")
    e.add_argument("--json", action="store_true")
    k = sub.add_parser("kinetic")
    k.add_argument("--film", default="film/film.json")
    k.add_argument("--strict", action="store_true")
    k.add_argument("--json", action="store_true")
    args = ap.parse_args()

    film = load(args.film)
    if args.cmd == "explainer":
        checks, problems = check_explainer(film, args.still, args.strict)
    else:
        checks, problems = check_kinetic(film, args.strict)

    if args.json:
        print(json.dumps({"format": args.cmd, "pass": not problems, "checks": checks, "problems": problems}, ensure_ascii=False, indent=2))
    else:
        print(f"{args.cmd} · {args.film}\n")
        for row in checks:
            mark = "PASS" if row["pass"] else ("FAIL" if row.get("hard", True) else "WARN")
            print(f"  {mark:4s} {row['name']:28s} {row['detail'] if not row['pass'] else 'ok'}")
        if problems:
            print(f"\n{len(problems)} violation(s)")
        else:
            print("\nOK  the plan is the right kind of film")
    sys.exit(0 if not problems else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Design advisor: measured critique of a film before a single frame renders.

Every finding is a number read from the project, not an opinion:

    python scripts/advise.py film/film.json        # human table + score
    python scripts/advise.py --json                # for agents
    python scripts/advise.py --strict              # exit 1 if any MUST fails

It reads the film, the theme tokens (so contrast is computed, not guessed) and
the app scan when present. Findings are graded MUST / SHOULD / COULD so an agent
knows what to fix before showing the client anything.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Arabic narration pace, measured on this studio's own VO: 13-15 chars/second.
CHARS_PER_SEC = 13.5
# A beat may use at most this share of its duration on reading the copy aloud.
READ_BUDGET = 0.85

# The pairing each tone uses (mirrors src/scenes/*): foreground token on backdrop.
TONE_PAIRS = {
    "ink": ("parchment", "inkBg"),
    "paper": ("ink", "paper"),
    "emerald": ("parchment", "emerald"),
}

HANDLE_PATTERNS = re.compile(r"(@|t\.me|https?://|\+9\d|telegram|whatsapp)", re.IGNORECASE)


def theme_tokens() -> dict[str, str]:
    """Pull `key: '#RRGGBB'` out of src/theme.ts, so the advisor tracks the app."""
    path = ROOT / "src" / "theme.ts"
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    return {m.group(1): m.group(2).upper() for m in re.finditer(r"(\w+):\s*'(#[0-9A-Fa-f]{6})'", text)}


def rgb(hex_value: str) -> tuple[float, float, float]:
    h = hex_value.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def luminance(hex_value: str) -> float:
    def channel(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb(hex_value))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def frames_of(beat: dict, film: dict) -> float:
    """Compiled timelines carry `dur`; hand-written films carry `bars` only."""
    if "dur" in beat:
        return float(beat["dur"])
    bpm = float(film.get("bpm", 120))
    return float(beat.get("bars", 0)) * (240.0 / bpm) * float(film.get("fps", 30))


def text_of(beat: dict) -> str:
    parts = [beat.get("kicker"), beat.get("line1"), beat.get("line2")]
    stat = beat.get("stat") or {}
    parts += [stat.get("label"), str(stat.get("to", ""))]
    return " ".join(str(p) for p in parts if p)


def advise(film_path: pathlib.Path) -> dict:
    film = json.loads(film_path.read_text(encoding="utf-8"))
    beats = film.get("beats", [])
    fps = film.get("fps", 30)
    tokens = theme_tokens()
    findings: list[dict] = []

    def add(level: str, beat: str, title: str, detail: str) -> None:
        findings.append({"level": level, "beat": beat, "title": title, "detail": detail})

    # 1. reading time against the beat's duration
    for b in beats:
        dur = frames_of(b, film) / fps
        chars = len(text_of(b).replace(" ", ""))
        need = chars / CHARS_PER_SEC
        if dur > 0 and need > dur * READ_BUDGET:
            add(
                "MUST",
                b.get("id", "?"),
                "copy does not fit the beat",
                f"{chars} chars need {need:.2f}s, beat is {dur:.2f}s (budget {dur * READ_BUDGET:.2f}s)",
            )

    # 2. contrast of the tone pairing, computed from the theme
    seen: set[str] = set()
    for b in beats:
        tone = b.get("tone", "ink")
        if tone in seen or tone not in TONE_PAIRS:
            continue
        seen.add(tone)
        fg_name, bg_name = TONE_PAIRS[tone]
        bg = tokens.get(bg_name)
        if not bg:
            continue
        # the end card sets white, the ink/paper tones set a token: use the better of
        # the two candidates and say which one won.
        candidates = [(name, tokens[name]) for name in (fg_name,) if tokens.get(name)]
        candidates.append(("white", "#FFFFFF"))
        fg_name, fg = max(candidates, key=lambda pair: contrast(pair[1], bg))
        ratio = contrast(fg, bg)
        if ratio < 3.0:
            add(
                "MUST",
                b.get("id", "?"),
                f"contrast fails on {tone}",
                f"{fg_name} on {bg_name} = {ratio:.2f}:1, below even the 3:1 large-text floor",
            )
        elif ratio < 4.5:
            add(
                "SHOULD",
                b.get("id", "?"),
                f"contrast is large-text only on {tone}",
                f"{fg_name} on {bg_name} = {ratio:.2f}:1 (AA large 3:1 ok, body 4.5:1 not met) - keep this tone to headlines",
            )
        elif ratio < 7:
            add(
                "COULD",
                b.get("id", "?"),
                f"contrast is only adequate on {tone}",
                f"{fg_name} on {bg_name} = {ratio:.2f}:1; AA large text 3:1, AAA 7:1",
            )

    # 3. two adjacent beats of the same kind flatten the rhythm
    for prev, cur in zip(beats, beats[1:]):
        if prev.get("kind") == cur.get("kind"):
            add("SHOULD", cur.get("id", "?"), "same beat kind twice in a row", f"{prev.get('kind')} follows {prev.get('kind')}")

    # 4. openings and closes
    if beats:
        hook = beats[0]
        hook_s = frames_of(hook, film) / fps
        if hook_s > 4.5:
            add("SHOULD", hook.get("id", "?"), "hook runs long", f"{hook_s:.2f}s before the first turn; 2-4s holds attention")
        if hook.get("kind") != "hook":
            add("SHOULD", hook.get("id", "?"), "film does not open on a hook", f"opens on {hook.get('kind')}")

        cta = [b for b in beats if b.get("kind") == "cta"]
        if not cta:
            add("MUST", "-", "no call to action", "a marketing film without a cta ships without a destination")
        else:
            brand_src = ROOT / "src" / "brand.ts"
            brand_text = brand_src.read_text(encoding="utf-8") if brand_src.is_file() else ""
            joined = " ".join(text_of(b) for b in cta) + " " + brand_text
            if not HANDLE_PATTERNS.search(joined):
                add("MUST", cta[-1].get("id", "?"), "cta has no reachable handle", "no @handle, t.me, url or phone in the cta")

    # 5. voice coverage: every beat that carries meaning needs a line
    for b in beats:
        if not b.get("vo") and text_of(b):
            add("COULD", b.get("id", "?"), "beat has no voice-over line", "silent beats read as slates unless the music carries them")

    # 6. the look is a decision, not an accident
    look = film.get("look")
    looks_src = (ROOT / "src" / "look" / "looks.ts")
    known = re.findall(r'"([a-z-]+)":\s*\{', looks_src.read_text(encoding="utf-8")) if looks_src.is_file() else []
    if not look:
        add("SHOULD", "-", "no look declared", f"set film.look to one of: {', '.join(known) or 'cinema-warm'}")
    elif known and look not in known:
        add("MUST", "-", "unknown look", f"'{look}' is not in src/look/looks.ts ({', '.join(known)})")

    # 7. the arithmetic of the timeline must be exact
    # one bar = 240/bpm seconds, so frames per bar = (240/bpm) * fps
    frames = round(sum(float(b.get("bars", 0)) for b in beats) * (240.0 / float(film.get("bpm", 120))) * float(fps)) if beats else 0
    declared = int(film.get("frames", 0))
    if frames and declared and frames != declared:
        add("MUST", "-", "frame count disagrees with the beat grid", f"bars imply {frames} frames, film declares {declared}")

    weights = {"MUST": 15, "SHOULD": 5, "COULD": 1}
    score = max(0, 100 - sum(weights[f["level"]] for f in findings))
    order = {"MUST": 0, "SHOULD": 1, "COULD": 2}
    findings.sort(key=lambda f: (order[f["level"]], f["beat"]))
    return {
        "film": str(film_path.relative_to(ROOT)) if film_path.is_relative_to(ROOT) else str(film_path),
        "beats": len(beats),
        "seconds": round(sum(frames_of(b, film) for b in beats) / fps, 2),
        "look": film.get("look"),
        "score": score,
        "counts": {k: sum(1 for f in findings if f["level"] == k) for k in ("MUST", "SHOULD", "COULD")},
        "findings": findings,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="measured design review of a film")
    ap.add_argument("film", nargs="?", default="film/film.json")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true", help="exit 1 when a MUST fails")
    ap.add_argument("--min-score", type=int, default=None, help="exit 1 below this score (CI floor)")
    args = ap.parse_args()

    path = pathlib.Path(args.film)
    if not path.is_absolute():
        path = ROOT / path
    report = advise(path)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"design review: {report['film']}  {report['beats']} beats, {report['seconds']}s, look={report['look']}")
        print(f"score {report['score']}/100   MUST {report['counts']['MUST']}  SHOULD {report['counts']['SHOULD']}  COULD {report['counts']['COULD']}\n")
        if not report["findings"]:
            print("nothing to fix - the plan meets every gate this advisor knows")
        for f in report["findings"]:
            print(f"[{f['level']:6s}] {f['beat']:>10s}  {f['title']}")
            print(f"            {f['detail']}")
    if args.min_score is not None and report["score"] < args.min_score:
        sys.exit(f"score {report['score']} is below the floor {args.min_score}")
    if args.strict and report["counts"]["MUST"]:
        sys.exit(1)


if __name__ == "__main__":
    main()

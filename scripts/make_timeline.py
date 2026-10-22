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
# Kinds are visual grammars, not templates: a film declares which grammar each beat
# speaks and `src/film/Film.tsx` maps it to a scene. The first four are the launch
# grammar; store/admin/security are the product-demo grammar of a live shop.
KINDS = {"hook", "device", "stat", "cta", "open", "store", "admin", "security", "close", "design", "finale", "setup", "sources"}
TONES = {"ink", "paper", "emerald"}
# Reading budget: new words are slow, filler is fast. Arabic UI copy averages
# ~0.42 s per word when it must be read at a glance.
SEC_PER_WORD = 0.42
VO_TAIL = 0.35  # air after a line, before the cut

BACKGROUNDS = {"paper-glow", "ink-aurora", "emerald-depth", "souk-night", "golden-souk", "vault-night", "vault-warm", "atelier", "cobalt"}
TRANSITIONS = {"whip", "slide", "blur", "flash", "flood", "iris", "maskline"}
STYLE_DEFAULTS = {
    "template": "launch-hero",
    "look": None,
    "motion": 1.0,
    "background": "paper-glow",
    "transitions": ["whip", "slide", "blur"],
    "sfx": {"intro": "riser_short", "cut": "whoosh_rtl", "accent": "ui_pop"},
}
SFX_DIR = ROOT / "public" / "audio" / "sfx"


def load_style(film: dict, film_path: pathlib.Path, problems: list[str], warnings: list[str]) -> dict:
    """film.json may inline `style` or point at a style.json (template output)."""
    raw = film.get("style")
    data: dict = {}
    if isinstance(raw, str):
        target = (film_path.parent / raw).resolve()
        if target.exists():
            data = json.loads(target.read_text(encoding="utf-8"))
        else:
            problems.append(f"style file not found: {target}")
    elif isinstance(raw, dict):
        data = raw
    elif raw is not None:
        problems.append("style must be an object or a path to a style.json")

    style = {**STYLE_DEFAULTS, **data}
    style["sfx"] = {**STYLE_DEFAULTS["sfx"], **(data.get("sfx") or {})}
    if not style.get("look"):
        style["look"] = film.get("look")
    if style.get("background") not in BACKGROUNDS:
        warnings.append(f"unknown background {style.get('background')!r} -> paper-glow")
        style["background"] = "paper-glow"
    keep = [t for t in (style.get("transitions") or []) if t in TRANSITIONS]
    if not keep:
        warnings.append("no known transitions -> whip/slide/blur")
        keep = ["whip", "slide", "blur"]
    if len(keep) != len(style.get("transitions") or []):
        warnings.append("some transition names are unknown and were dropped")
    style["transitions"] = keep
    try:
        style["motion"] = max(0.0, min(1.5, float(style.get("motion") or 1.0)))
    except (TypeError, ValueError):
        warnings.append("style.motion is not a number -> 1.0")
        style["motion"] = 1.0
    for key, stem in style["sfx"].items():
        if stem and not (SFX_DIR / f"{stem}.wav").exists():
            warnings.append(f"sfx.{key} '{stem}' has no public/audio/sfx/{stem}.wav")
    return style


def check_cues(cues, bid: str, problems: list[str]) -> list[dict]:
    out = []
    for cue in cues or []:
        name = cue.get("name") if isinstance(cue, dict) else None
        if not name:
            problems.append(f"{bid}: sfx cue without a name")
            continue
        if not (SFX_DIR / f"{name}.wav").exists():
            problems.append(f"{bid}: sfx '{name}' is not in public/audio/sfx/")
            continue
        out.append({"at": int(cue.get("at") or 0), "name": name, "gain": float(cue.get("gain", 0.5))})
    return out


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
    p.add_argument("--style-out", default="src/generated/style.json", help="compiled style plan")
    p.add_argument("--strict", action="store_true", help="warnings become errors")
    a = p.parse_args()

    film_path = (ROOT / a.film).resolve()
    film = json.loads(film_path.read_text(encoding="utf-8"))
    fps: int = film.get("fps", 30)
    bpm: int = film.get("bpm", 120)
    bar_frames = round(fps * 240 / bpm)  # 4/4 bar, 60 frames at 120 BPM / 30 fps
    vo = load_vo(ROOT / a.vo)

    problems: list[str] = []
    warnings: list[str] = []
    style = load_style(film, film_path, problems, warnings)
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
            # scene copy that is not a headline: chat, product, KPI, guard slabs, ctas.
            # The compiler does not interpret it; the scene does (and only with strings
            # that exist in the app's own tables).
            "data": b.get("data") or {},
            "emphasis": b.get("emphasis") or [],
            "sfx": check_cues(b.get("sfx"), bid, problems),
            "vo": lines,
        })
        cursor += dur

    total = cursor
    if total % bar_frames:
        warnings.append(f"total {total} frames is not a whole number of bars ({bar_frames})")

    tl = {
        "fps": fps,
        "look": style.get("look") or film.get("look"),
        "style": style,
        "width": film.get("width", 1920),
        "height": film.get("height", 1080),
        "bpm": bpm,
        "frames": total,
        "beats": beats_out,
    }
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(tl, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    style_out = ROOT / a.style_out
    style_out.parent.mkdir(parents=True, exist_ok=True)
    style_out.write_text(json.dumps(style, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # report
    print(f"{'beat':16s} {'kind':7s} {'bars':>4s} {'sec':>6s} {'frames':>7s} {'words':>6s} {'vo(s)':>6s}")
    for b in beats_out:
        n = words(" ".join(x for x in (b["kicker"], b["line1"], b["line2"]) if x))
        vt = sum(vo.get(f"{b['id']}-{j + 1}", 0.0) for j in range(len(b["vo"])))
        print(f"{b['id']:16s} {b['kind']:7s} {b['dur'] / bar_frames:4.0f} {b['dur'] / fps:6.2f} "
              f"{b['dur']:7d} {n:6d} {vt:6.2f}")
    print(f"\ntotal {total} frames = {total / fps:.2f}s = {total / bar_frames:.0f} bars @ {bpm} BPM")
    print(f"style: {style['template']} · look {style['look']} · motion {style['motion']} · "
          f"bg {style['background']} · cut {'/'.join(style['transitions'])}")

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

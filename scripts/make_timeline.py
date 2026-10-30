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
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
# Kinds are visual grammars, not templates: a film declares which grammar each beat
# speaks and `src/film/Film.tsx` maps it to a scene. The first four are the launch
# grammar; store/admin/security are the product-demo grammar of a live shop.
KINDS = {"hook", "device", "stat", "cta", "open", "store", "admin", "security", "close", "design", "finale", "setup", "sources", "explainer", "kinetic"}
FORMATS = {"launch", "explainer", "kinetic"}
KINETIC_STYLES = {"slam", "stack", "split", "pair", "cut", "punch", "image", "logo"}
CARD_TYPES = {"checklist", "counter", "window", "steps", "compare", "quote", "image", "statement", "none"}
PALETTE_KEYS = {"bg", "paper", "accent", "hot", "ink"}
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


HARAKAT = re.compile("[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
NON_WORD = re.compile(r"[^\w\u0600-\u06FF]+", re.UNICODE)


def display_tokens(text: str | None) -> list[str]:
    """Whitespace tokens of the on-screen line, tashkeel stripped, punctuation kept."""
    plain = HARAKAT.sub("", (text or "").replace("\\", ""))
    return [token for token in plain.split() if token.strip()]


def norm_token(token: str) -> str:
    return NON_WORD.sub("", token)


def estimate_word_timings(tokens: list[str], seconds: float, measured: float = 0.0) -> list[dict]:
    """Spread the spoken line across its measured duration by visible character weight.

    The studio's Fish path has no word timestamps, so this is the honest fallback:
    it never invents a word, only places the words it already has. ElevenLabs
    timestamps replace it when the manifest carries them (`wordSource: measured`).
    """
    if not tokens:
        return []
    usable = measured - 0.12 if measured > 0.4 else min(seconds - 0.35, len(tokens) * 0.38)
    usable = max(0.25, min(seconds - 0.18, usable))
    lead = 0.10 if measured > 0.4 else 0.06
    weights = [max(1, len(norm_token(t))) for t in tokens]
    total = float(sum(weights)) or 1.0
    out, cursor = [], lead
    for token, weight in zip(tokens, weights):
        span = usable * weight / total
        out.append({"w": token, "start": round(cursor, 3), "end": round(cursor + span, 3)})
        cursor += span
    if out:
        out[-1]["end"] = round(min(seconds - 0.04, max(out[-1]["start"] + 0.08, out[-1]["end"])), 3)
    return out


def measured_word_timings(tokens: list[str], spoken: list) -> list[dict] | None:
    """Use provider timestamps only when they line up one-to-one with the display line."""
    if len(tokens) != len(spoken):
        return None
    out = []
    for token, word in zip(tokens, spoken):
        if not isinstance(word, dict):
            return None
        try:
            start = float(word.get("start", 0))
            end = float(word.get("end", 0))
        except (TypeError, ValueError):
            return None
        if end <= start:
            return None
        out.append({"w": token, "start": round(start, 3), "end": round(end, 3)})
    return out


def load_vo_entries(path: pathlib.Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("lines") or data.get("beats") or []
    if not isinstance(data, list):
        return {}
    return {str(x["id"]): x for x in data if isinstance(x, dict) and x.get("id")}


def load_vo(path: pathlib.Path) -> dict[str, float]:
    return {key: float(value.get("dur") or value.get("seconds") or 0.0) for key, value in load_vo_entries(path).items()}


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
    fmt = film.get("format", "launch")
    vo_entries = load_vo_entries(ROOT / a.vo)
    vo = {key: float(value.get("dur") or value.get("seconds") or 0.0) for key, value in vo_entries.items()}
    palette = film.get("palette") or {}

    problems: list[str] = []
    warnings: list[str] = []
    if fmt not in FORMATS:
        problems.append(f"format {fmt!r} not in {sorted(FORMATS)}")
        fmt = "launch"
    if fmt == "kinetic":
        missing = PALETTE_KEYS - set(palette)
        if missing:
            problems.append(f"kinetic film needs palette keys: {', '.join(sorted(missing))}")
    style = load_style(film, film_path, problems, warnings)
    if fmt != "launch" and film.get("style") is None:
        style["template"] = "explainer-reel" if fmt == "explainer" else "kinetic-launch"
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
        data = dict(b.get("data") or {})

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

        if kind == "explainer":
            if len(lines) != 1:
                problems.append(f"{bid}: explainer needs exactly one VO sentence (has {len(lines)})")
            card = data.get("card") if isinstance(data.get("card"), dict) else {}
            ctype = card.get("type")
            if ctype not in CARD_TYPES:
                problems.append(f"{bid}: explainer card.type {ctype!r} not in {sorted(CARD_TYPES)}")
            keyword = str(data.get("keyword") or "").strip()
            if not keyword:
                problems.append(f"{bid}: explainer needs data.keyword (the word that carries the sentence)")
            else:
                line_norm = "".join(norm_token(t) for t in display_tokens(b.get("line1")))
                if norm_token(keyword) not in line_norm:
                    warnings.append(f"{bid}: keyword {keyword!r} is not in line1")
            if card.get("type") == "image":
                src = str(card.get("src") or "")
                if not src:
                    problems.append(f"{bid}: explainer image card needs src")
                elif not (ROOT / "public" / src).exists():
                    problems.append(f"{bid}: explainer image src public/{src} does not exist")
            data["card"] = card
            data["keyword"] = keyword

        if kind == "kinetic":
            shots = data.get("shots")
            if not isinstance(shots, list) or not shots:
                problems.append(f"{bid}: kinetic beat needs data.shots[]")
                shots = []
            data["palette"] = palette
            data["bpm"] = bpm
            data["beatFrames"] = round(bar_frames / 4, 3)
            data["bars"] = bars
            last_at = -1.0
            beat_beats = bars * 4
            for j, shot in enumerate(shots):
                if not isinstance(shot, dict):
                    problems.append(f"{bid}: shot {j + 1} is not an object")
                    continue
                try:
                    at = float(shot.get("at", 0))
                except (TypeError, ValueError):
                    problems.append(f"{bid}: shot {j + 1} has a non-numeric `at`")
                    continue
                if at < last_at:
                    problems.append(f"{bid}: shots are out of order at beat {at}")
                if at < 0 or at >= beat_beats:
                    problems.append(f"{bid}: shot at beat {at} is outside 0..{beat_beats}")
                last_at = at
                style_name = shot.get("style", "slam")
                if style_name not in KINETIC_STYLES:
                    problems.append(f"{bid}: kinetic style {style_name!r} not in {sorted(KINETIC_STYLES)}")
                text = shot.get("text")
                text_lines = text if isinstance(text, list) else [text]
                if style_name not in ("image", "logo"):
                    if not text or not all(str(x).strip() for x in text_lines):
                        problems.append(f"{bid}: shot {j + 1} ({style_name}) needs text")
                    for line in text_lines:
                        n = words(str(line))
                        if n > 6:
                            problems.append(f"{bid}: shot {j + 1} has {n} words; split the idea (max 6)")
                        elif n > 4:
                            warnings.append(f"{bid}: shot {j + 1} has {n} words; 1–4 reads faster")
                ground = shot.get("ground")
                if ground and ground not in PALETTE_KEYS and not str(ground).startswith("#"):
                    problems.append(f"{bid}: shot {j + 1} ground {ground!r} is not a palette key or hex")
                if style_name == "image":
                    src = str(shot.get("src") or "")
                    if not src:
                        problems.append(f"{bid}: image shot {j + 1} needs src")
                    elif not (ROOT / "public" / src).exists():
                        problems.append(f"{bid}: image shot src public/{src} does not exist")
                if style_name == "logo":
                    logo = data.get("logo")
                    if not isinstance(logo, dict) or not str(logo.get("wordmark") or "").strip():
                        problems.append(f"{bid}: logo shot needs data.logo.wordmark")
                cue = shot.get("cue")
                if cue:
                    if not (SFX_DIR / f"{cue}.wav").exists():
                        problems.append(f"{bid}: shot cue {cue!r} is not in public/audio/sfx/")
                    else:
                        data.setdefault("shotCues", []).append(
                            {"at": round(at * bar_frames / 4), "name": cue, "gain": float(shot.get("gain", 0.6))}
                        )

        sfx_out = check_cues(b.get("sfx"), bid, problems)
        for cue in data.get("shotCues", []):
            sfx_out.append(cue)

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
            "data": data,
            "emphasis": b.get("emphasis") or [],
            "sfx": sfx_out,
            "vo": lines,
        })
        cursor += dur

    if fmt == "explainer":
        for b in beats_out:
            tokens = display_tokens(b["line1"])
            entry = vo_entries.get(f"{b['id']}-1") or {}
            measured = float(entry.get("dur") or 0.0)
            spoken = entry.get("words") if isinstance(entry.get("words"), list) else None
            timings = measured_word_timings(tokens, spoken) if spoken else None
            source = "measured"
            if timings is None:
                timings = estimate_word_timings(tokens, b["dur"] / fps, measured)
                source = "estimated"
            b["data"]["words"] = timings
            b["data"]["wordSource"] = source

    total = cursor
    if total % bar_frames:
        warnings.append(f"total {total} frames is not a whole number of bars ({bar_frames})")

    tl = {
        "fps": fps,
        "format": fmt,
        "look": style.get("look") or film.get("look"),
        "style": style,
        "palette": palette,
        "music": film.get("music") or {},
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
    print(f"format: {fmt} · style: {style['template']} · look {style['look']} · motion {style['motion']} · "
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

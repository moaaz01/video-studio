#!/usr/bin/env python3
"""Foley that follows the picture: on-screen events -> a measured cue sheet.

The compiler calls `cue_sheet()`; `Soundtrack.tsx` only plays what it returns, so
`craft check` and the tests can see every sound the film will make.

    python scripts/foley.py measure            # stems -> references/sfx-catalog.json
    python scripts/foley.py sheet [--timeline src/generated/timeline.json]
    python scripts/foley.py suggest --film film/film.json

Rules (references/interaction.md):
- A sound needs a cause on screen: a click step, a number landing, a card, a cut.
- The level (style `interaction`) sets which events sound, their timbre, gain,
  take rotation and a density cap; `legacy` reproduces the fixed pre-profile mix.
- The stem's transient peak, not its file start, lands on the picture frame.
- Two cues closer than 3 frames: the lower priority one is dropped (no flams).
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]
SFX_DIR = ROOT / "public" / "audio" / "sfx"
CATALOG = ROOT / "references" / "sfx-catalog.json"
PROFILES = ROOT / "references" / "interaction.json"

# Mirrors of render-side timing (tests/test_foley.py keeps them in sync with the TSX).
GFX_STAGGER = 0.14       # src/scenes/Gfx.tsx STAGGER: untimed layers enter i * 0.14 s
COUNTER_DUR = 1.2        # Gfx.tsx counter `l.dur ?? 1.2`: the number lands at at + dur
PREROLL, OVER = 8, 8     # src/film/Film.tsx: the hand-over's fastest frame is start + OVER/2
KEY_STEP = 0.1          # src/components/Cursor.tsx KeyCaps: key i goes down at i * 0.1 s
MIN_GAP_FRAMES = 3


def jsround(x: float) -> int:
    """JavaScript Math.round: halves round up (Python's round() is banker's)."""
    return int(math.floor(x + 0.5))


# ------------------------------------------------------------------ catalogue

def _peak(path: pathlib.Path) -> dict:
    import numpy as np

    with wave.open(str(path)) as w:
        n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    if sw == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        s = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        s = np.where(s & 0x800000, s - 0x1000000, s) / 8388608.0
    else:
        s = np.frombuffer(raw, dtype={1: np.int8, 2: np.int16, 4: np.int32}[sw]).astype(np.float64) / float(2 ** (8 * sw - 1))
    m = np.abs(s.reshape(-1, ch)).max(axis=1)
    return {"len_s": round(n / sr, 3), "peak_ms": round(float(m.argmax()) / sr * 1000, 1),
            "peak_db": round(20 * math.log10(float(m.max()) + 1e-9), 1),
            "rms_db": round(20 * math.log10(float(np.sqrt((s ** 2).mean())) + 1e-9), 1)}


def measure() -> dict:
    cat = {p.stem: _peak(p) for p in sorted(SFX_DIR.glob("*.wav"))}
    CATALOG.write_text(json.dumps(cat, indent=1) + "\n", encoding="utf-8")
    return cat


def catalog() -> dict:
    return json.loads(CATALOG.read_text(encoding="utf-8")) if CATALOG.exists() else {}


def profiles() -> dict:
    return json.loads(PROFILES.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ legacy mix

def legacy_cues(beats: list[dict], style: dict, fps: int) -> list[dict]:
    """The exact mix `Soundtrack.tsx` computed before profiles (frames are absolute)."""
    sfx = style.get("sfx") or {}
    cut, intro, accent = sfx.get("cut") or "whoosh_rtl", sfx.get("intro"), sfx.get("accent") or "ui_pop"
    out: list[dict] = []

    def add(at_s: float, name: str, gain: float, role: str) -> None:
        out.append({"frame": max(0, jsround(at_s * fps)), "name": name, "gain": gain, "role": role})

    for i, b in enumerate(beats):
        s = b["start"] / fps
        if i == 0 and intro:
            add(0, intro, 0.42, "intro")
        if i > 0:
            add(max(0.0, s - 0.06), cut, 0.62, "cut")
        if b.get("kind") == "stat":
            add(s, "stamp_thud", 0.5, "stat")
            add(s + 40 / fps, "correct_chime", 0.42, "stat")
        if b.get("kind") == "cta":
            add(s, accent, 0.4, "cta")
            add(s + 32 / fps, "ding", 0.3, "cta")
        if b.get("kind") == "device":
            add(s + 14 / fps, "file_drop", 0.26, "device")
        for c in b.get("sfx") or []:
            add(s + max(0, c.get("at", 0)) / fps, c["name"], c.get("gain", 0.5), "named")
    return out


# ------------------------------------------------------------------ events

def events(beats: list[dict], fps: int) -> list[dict]:
    """Every on-screen moment that can carry a sound, in absolute frames."""
    ev: list[dict] = []
    prev_kind = None
    for i, b in enumerate(beats):
        start, kind, data = b["start"], b.get("kind"), b.get("data") or {}
        if i > 0:
            # a chapter is a change of grammar (beat kind) or a beat the film marks
            # `data.chapter: true` (the turn, the reveal); tone alone changes too often
            chapter = kind != prev_kind or bool(data.get("chapter"))
            ev.append({"type": "cut", "frame": start + OVER // 2, "chapter": chapter, "beat": b["id"],
                       "footage": kind == "footage" and prev_kind == "footage"})
        prev_kind = kind
        if kind == "stat":
            ev.append({"type": "stat", "frame": start, "beat": b["id"]})
        elif kind == "cta":
            ev.append({"type": "cta", "frame": start, "beat": b["id"]})
        elif kind == "device":
            ev.append({"type": "device", "frame": start + 14, "beat": b["id"]})
        elif kind == "tutorial":
            for s in data.get("steps") or []:
                at = start + jsround(float(s.get("at", 0)) * fps)
                keys = s.get("keys") or []
                # a step that types a shortcut is heard as its keys (Cursor.tsx KeyCaps: one
                # key down every 0.1 s from `at`); otherwise a click, unless it only hovers/scrolls
                if keys:
                    for k, _ in enumerate(keys):
                        ev.append({"type": "keys", "frame": at + jsround(k * KEY_STEP * fps), "beat": b["id"]})
                elif s.get("click") is not False and s.get("action", "click") not in ("hover", "scroll"):
                    ev.append({"type": "click", "frame": at, "beat": b["id"]})
        elif kind == "gfx":
            for j, l in enumerate(data.get("layers") or []):
                t = l.get("at")
                t = j * GFX_STAGGER if t is None else float(t)
                typ = l.get("type")
                if typ == "counter":
                    ev.append({"type": "counter_land", "frame": start + jsround((t + float(l.get("dur") or COUNTER_DUR)) * fps), "beat": b["id"]})
                elif typ == "card":
                    ev.append({"type": "card_land", "frame": start + jsround(t * fps) + 2, "beat": b["id"]})
                elif typ == "badge":
                    ev.append({"type": "badge_land", "frame": start + jsround(t * fps) + 2, "beat": b["id"]})
                elif typ == "burst":
                    ev.append({"type": "burst", "frame": start + jsround(t * fps), "beat": b["id"]})
        for c in b.get("sfx") or []:
            ev.append({"type": "named", "frame": start + int(c.get("at", 0)), "name": c["name"], "gain": c.get("gain", 0.5), "beat": b["id"]})
    return sorted(ev, key=lambda e: e["frame"])


# The film's declared sound roles (style.sfx, film/style.json) name the stem for an
# event; the level still decides whether that event sounds, how loud, and the cap.
ROLE_FOR_EVENT = {"click": "accent", "keys": "tick", "counter_land": "success", "card_land": "land",
                  "badge_land": "land", "burst": "reward", "stat": "stamp", "cta": "seal"}


def cue_sheet(beats: list[dict], style: dict, fps: int, total: int) -> tuple[str, list[dict]]:
    level = style.get("interaction") or "legacy"
    prof = profiles()["levels"].get(level)
    if prof is None:
        raise ValueError(f"interaction level {level!r} not in references/interaction.json")
    if prof.get("legacy"):
        return level, legacy_cues(beats, style, fps)
    pri = profiles()["priority"]
    cat = catalog()
    declared = {k: v for k, v in (style.get("sfx") or {}).items() if v and (SFX_DIR / f"{v}.wav").exists()}
    rates = prof.get("rates") or [1.0]
    cuts = prof.get("cut")
    out: list[dict] = []
    used: dict[str, int] = {}
    n_cut = 0
    evs = events(beats, fps)
    if declared.get("intro") and prof.get("events"):
        evs = [{"type": "intro", "frame": 0, "beat": beats[0]["id"] if beats else "-"}, *evs]
    for e in evs:
        t = e["type"]
        if t == "named":
            # written by the film: placed exactly as written and never thinned
            out.append({"frame": e["frame"], "name": e["name"], "gain": e["gain"], "rate": 1.0, "role": t,
                        "beat": e["beat"], "priority": pri.get(t, 6)})
            continue
        if t == "intro":
            stem, gain = declared["intro"], 0.4
        elif t == "cut":
            if not cuts or e.get("footage"):
                continue  # a cut inside a recording is the recording's own edit
            n_cut += 1
            every = cuts.get("every", 1)
            if every == "chapter" and not e["chapter"]:
                continue
            if isinstance(every, int) and (n_cut - 1) % every:
                continue
            stems = ([declared["cut"]] if declared.get("cut") else []) + [x for x in cuts["stems"] if x != declared.get("cut")]
            stem, gain = stems[(n_cut - 1) % len(stems)], cuts["gain"]
        else:
            spec = (prof.get("events") or {}).get(t)
            if not spec:
                continue
            stem, gain = declared.get(ROLE_FOR_EVENT.get(t, ""), spec["stem"]), spec["gain"]
        k = used.get(stem, 0)
        used[stem] = k + 1
        peak = (cat.get(stem) or {}).get("peak_ms", 0.0)
        frame = max(0, e["frame"] - jsround(peak * fps / 1000))
        out.append({"frame": frame, "name": stem, "gain": gain, "rate": rates[k % len(rates)], "role": t,
                    "beat": e["beat"], "priority": pri.get(t, 1)})
    out = _thin(out, prof.get("cap_per_10s") or 0, fps, total)
    return level, out


def _max_window(frames: list[int], span: int) -> int:
    frames = sorted(frames)
    j, worst = 0, 0
    for i, f in enumerate(frames):
        while frames[j] <= f - span:
            j += 1
        worst = max(worst, i - j + 1)
    return worst


def _thin(cues: list[dict], cap: int, fps: int, total: int) -> list[dict]:
    """Keep every named cue; then, by priority, drop flams (<3 frames from a kept cue)
    and any cue that would put more than `cap` cues in some 10 s window."""
    keep = [c for c in cues if c["role"] == "named"]
    span = 10 * fps
    for c in sorted((c for c in cues if c["role"] != "named"), key=lambda c: (-c["priority"], c["frame"])):
        if any(abs(c["frame"] - k["frame"]) < MIN_GAP_FRAMES for k in keep):
            continue
        if cap:
            near = [k["frame"] for k in keep if abs(k["frame"] - c["frame"]) < span and k["role"] != "named"]
            if _max_window([*near, c["frame"]], span) > cap:
                continue
        keep.append(c)
    return sorted(keep, key=lambda c: c["frame"])


def suggest(beats: list[dict]) -> tuple[str, str]:
    """A level from what the film shows, with the reason."""
    kinds = [b.get("kind") for b in beats]
    n = max(1, len(kinds))
    if kinds.count("footage") / n >= 0.5:
        return "none", "the film is mostly real footage; the recording carries its own sound"
    if kinds.count("tutorial") / n >= 0.3:
        return "rich", "a third or more of the film is a click-by-click tutorial"
    if kinds.count("kinetic") / n >= 0.5:
        return "punchy", "kinetic type carries the film"
    if kinds.count("gfx") / n >= 0.5:
        return "subtle", "a motion-graphics data story: sound only on the number and the turn"
    if any(k in ("device", "tutorial") for k in kinds):
        return "standard", "product screens with UI moments"
    return "standard", "a mixed launch film"


def main() -> None:
    ap = argparse.ArgumentParser(description="foley cue sheets from on-screen events")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("measure")
    s = sub.add_parser("sheet")
    s.add_argument("--timeline", default=str(ROOT / "src" / "generated" / "timeline.json"))
    g = sub.add_parser("suggest")
    g.add_argument("--timeline", default=str(ROOT / "src" / "generated" / "timeline.json"))
    a = ap.parse_args()
    if a.cmd == "measure":
        cat = measure()
        print(f"{len(cat)} stems -> {CATALOG.relative_to(ROOT)}")
        return
    tl = json.loads(pathlib.Path(a.timeline).read_text(encoding="utf-8"))
    if a.cmd == "suggest":
        level, why = suggest(tl.get("beats", []))
        print(f"suggested interaction: {level} — {why}")
        return
    cues = tl.get("cues")
    level = tl.get("interaction", "legacy")
    if cues is None:
        level, cues = cue_sheet(tl["beats"], tl.get("style") or {}, tl["fps"], tl["frames"])
    print(f"interaction {level}: {len(cues)} cues over {tl['frames'] / tl['fps']:.1f}s")
    for c in cues:
        print(f"  {c['frame'] / tl['fps']:7.2f}s  f{c['frame']:<5} {c['role']:<12} {c['name']:<16} gain {c['gain']:.2f}"
              + (f" rate {c['rate']}" if c.get("rate", 1) != 1 else ""))


if __name__ == "__main__":
    sys.exit(main())

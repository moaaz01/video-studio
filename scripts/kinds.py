"""Compile-time checks for the tutorial / character / gfx / footage grammars.

`make_timeline.py` calls `validate()` for every beat of these kinds. A scene can
only render what its data names, so the compiler refuses data that would render
as a blank frame (missing media, a step outside the screen, an unknown layer).
"""
from __future__ import annotations

import pathlib

NEW_KINDS = {"tutorial", "character", "gfx", "footage"}
# kinds whose VO line drives on-screen timing (mouth, bubble, narrator)
SPOKEN_KINDS = {"explainer", "character", "tutorial"}
POSES = {"idle", "wave", "point", "cheer", "think", "present"}
EXPRESSIONS = {"neutral", "happy", "surprised", "thinking", "concerned", "confident"}
HAIR = {"short", "long", "hijab", "cap", "none"}
LAYERS = {"shape", "path", "text", "icon", "bars", "counter", "ring", "connector", "image", "lowerthird",
          "card", "line", "donut", "progress", "badge"}
# mirrors src/look/palettes.ts and src/components/Backdrop.tsx (a test keeps them in sync)
PALETTES = {"midnight-amber", "electric-indigo", "emerald-gold", "ocean-cyan", "sunset-plum", "mono-red", "sand-ink", "paper-cobalt"}
BACKDROPS = {"mesh", "grid", "flow", "topo", "dots", "beams", "solid"}
SHAPES = {"circle", "rect", "ring", "blob", "triangle", "hexagon", "star", "pill", "arrow"}
TEXT_FX = {"gradient", "outline", "marker"}
LAYER_NEEDS = {"path": "d", "text": "text", "icon": "name", "bars": "values", "counter": "to",
               "ring": "value", "connector": "to", "image": "src", "lowerthird": "title",
               "card": "title", "line": "values", "donut": "segments", "progress": "value", "badge": "text"}
MEDIA = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov", ".m4v"}


def _media(src: object, where: str, root: pathlib.Path, problems: list[str]) -> None:
    s = str(src or "")
    if not s:
        problems.append(f"{where} needs src")
    elif pathlib.Path(s).suffix.lower() not in MEDIA:
        problems.append(f"{where} src {s!r} is not an image or video")
    elif not (root / "public" / s).exists():
        problems.append(f"{where} src public/{s} does not exist")


def icon_names(root: pathlib.Path) -> set[str]:
    """Keys of the generated icon table; an unknown name renders as an empty box."""
    import re
    path = root / "src" / "generated" / "icons.ts"
    return set(re.findall(r'^  "([A-Za-z]+)":', path.read_text(encoding="utf-8"), re.M)) if path.exists() else set()


def _unit(v: object) -> bool:
    return isinstance(v, (int, float)) and 0 <= v <= 1


def validate(kind: str, bid: str, data: dict, seconds: float, root: pathlib.Path) -> tuple[list[str], list[str]]:
    problems: list[str] = []
    warnings: list[str] = []
    if kind == "tutorial":
        _media(data.get("src"), f"{bid}: tutorial", root, problems)
        steps = data.get("steps") or []
        if not steps:
            warnings.append(f"{bid}: tutorial has no steps; the screen will sit still")
        for j, s in enumerate(steps):
            if not (_unit(s.get("x")) and _unit(s.get("y"))):
                problems.append(f"{bid}: step {j + 1} x/y must be 0–1 of the screen")
            at = s.get("at")
            if not isinstance(at, (int, float)) or not 0 <= at < seconds:
                problems.append(f"{bid}: step {j + 1} at={at!r} is outside the beat (0–{seconds:.2f}s)")
            elif at < 0.55:
                warnings.append(f"{bid}: step {j + 1} at {at}s leaves the cursor <0.55s to travel")
            box = s.get("box")
            if box is not None and not (isinstance(box, list) and len(box) == 4 and all(_unit(v) for v in box)):
                problems.append(f"{bid}: step {j + 1} box must be [x, y, w, h] in 0–1")
            if s.get("zoom") is not None and not 1 <= float(s["zoom"]) <= 4:
                problems.append(f"{bid}: step {j + 1} zoom must be 1–4")
        if data.get("frame") not in (None, "browser", "phone", "none"):
            problems.append(f"{bid}: tutorial frame must be browser | phone | none")
    elif kind == "character":
        ch = data.get("character") or {}
        if ch.get("hairStyle") not in (None, *HAIR):
            problems.append(f"{bid}: character hairStyle {ch.get('hairStyle')!r} not in {sorted(HAIR)}")
        if data.get("expression") not in (None, *EXPRESSIONS):
            problems.append(f"{bid}: expression {data.get('expression')!r} not in {sorted(EXPRESSIONS)}")
        poses = [g.get("pose") for g in data.get("gestures") or []] + ([data["pose"]] if data.get("pose") else [])
        for p in poses:
            if p not in POSES:
                problems.append(f"{bid}: pose {p!r} not in {sorted(POSES)}")
    elif kind == "gfx":
        layers = data.get("layers") or []
        if not layers:
            problems.append(f"{bid}: gfx needs data.layers[]")
        if data.get("palette") not in (None, *PALETTES):
            problems.append(f"{bid}: palette {data.get('palette')!r} not in {sorted(PALETTES)}")
        if data.get("backdrop") not in (None, *BACKDROPS):
            problems.append(f"{bid}: backdrop {data.get('backdrop')!r} not in {sorted(BACKDROPS)}")
        for j, layer in enumerate(layers):
            t = layer.get("type")
            if t not in LAYERS:
                problems.append(f"{bid}: layer {j + 1} type {t!r} not in {sorted(LAYERS)}")
                continue
            need = LAYER_NEEDS.get(t)
            if need and layer.get(need) in (None, "", []):
                problems.append(f"{bid}: {t} layer {j + 1} needs {need}")
            at = layer.get("at", 0)
            if not isinstance(at, (int, float)) or at >= seconds:
                problems.append(f"{bid}: layer {j + 1} at={at!r} never shows in a {seconds:.2f}s beat")
            for axis in ("x", "y"):
                if axis in layer and not _unit(layer[axis]):
                    problems.append(f"{bid}: layer {j + 1} {axis} must be 0–1")
            if t == "shape" and layer.get("shape") not in (None, *SHAPES):
                problems.append(f"{bid}: layer {j + 1} shape {layer.get('shape')!r} not in {sorted(SHAPES)}")
            if t == "text" and layer.get("fx") not in (None, *TEXT_FX):
                problems.append(f"{bid}: layer {j + 1} fx {layer.get('fx')!r} not in {sorted(TEXT_FX)}")
            out = layer.get("out")
            if out is not None and (not isinstance(out, (int, float)) or out <= (at if isinstance(at, (int, float)) else 0)):
                problems.append(f"{bid}: layer {j + 1} out={out!r} must come after at")
            if t in ("icon", "card") and (layer.get("name") or layer.get("icon")):
                name = layer.get("name") or layer.get("icon")
                known = icon_names(root)
                if known and name not in known:
                    problems.append(f"{bid}: layer {j + 1} icon {name!r} is not in src/generated/icons.ts (camelCase, e.g. trendingUp)")
            if t == "image":
                _media(layer.get("src"), f"{bid}: image layer {j + 1}", root, problems)
            if t == "text" and len(str(layer.get("text", "")).split()) > 8:
                warnings.append(f"{bid}: text layer {j + 1} has >8 words; motion type reads 1–6")
    elif kind == "footage":
        _media(data.get("src"), f"{bid}: footage", root, problems)
        a, b = data.get("in", 0), data.get("out")
        if b is not None and (not isinstance(a, (int, float)) or not isinstance(b, (int, float)) or b <= a):
            problems.append(f"{bid}: footage needs in < out (seconds into the source)")
        elif b is not None and abs((b - a) - seconds) > 0.1:
            warnings.append(f"{bid}: footage range {b - a:.2f}s ≠ beat {seconds:.2f}s; the clip will be cut or hold")
        for r in data.get("broll") or []:
            _media(r.get("src"), f"{bid}: b-roll", root, problems)
    return problems, warnings

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
LAYERS = {"shape", "path", "text", "icon", "bars", "counter", "ring", "connector", "image", "lowerthird"}
LAYER_NEEDS = {"path": "d", "text": "text", "icon": "name", "bars": "values", "counter": "to",
               "ring": "value", "connector": "to", "image": "src", "lowerthird": "title"}
MEDIA = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov", ".m4v"}


def _media(src: object, where: str, root: pathlib.Path, problems: list[str]) -> None:
    s = str(src or "")
    if not s:
        problems.append(f"{where} needs src")
    elif pathlib.Path(s).suffix.lower() not in MEDIA:
        problems.append(f"{where} src {s!r} is not an image or video")
    elif not (root / "public" / s).exists():
        problems.append(f"{where} src public/{s} does not exist")


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

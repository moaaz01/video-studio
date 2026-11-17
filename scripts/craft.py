#!/usr/bin/env python3
"""Craft gates: catch the tells of a generated film before it is rendered.

    python scripts/craft.py check [--timeline src/generated/timeline.json] [--strict] [--json] [--review film/REVIEW.md]
    python scripts/craft.py storylines film/STORYLINES.md          # three storylines, one picked
    python scripts/craft.py styles list | show <id> | apply <id> [--film film/film.json]
    python scripts/craft.py breakdown <video.mp4> [--out out/breakdown/<name>]

`check` reads the compiled timeline (not the render) and ranks findings:
P0 breaks the read (unreadable, two accents, Indic digits), P1 weakens the film
(no stagger, flat ground, a line on screen too briefly), P2 is polish.
`--strict` exits 1 on any P0. Ideas restated from HyperFrames (Apache-2.0),
impeccable (Apache-2.0) and unslop (CC BY 4.0); see THIRD_PARTY_NOTICES.md.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLES = ROOT / "references" / "styles.json"

# Arabic reading defaults, derived from this studio's measured speech rate
# (~21 spoken words per 10 s beat). A viewer reads a line it does not hear at
# about the same pace; the hold adds a settle time for the eye to land.
READ_SETTLE_S = 0.6
READ_PER_WORD_S = 0.4
MIN_TEXT_FRAC = 0.026      # text under 2.6% of the frame height is unreadable on a phone
DEAD_STRETCH_S = 3.0       # nothing new arriving for longer than this reads as parked
INDIC = re.compile(r"[٠-٩۰-۹]")
TASHKEEL = re.compile(r"[ً-ْٰ]")
TEXT_FIELDS = {"text": ("text",), "card": ("title", "sub"), "lowerthird": ("title", "sub"), "badge": ("text",),
               "counter": ("label",), "progress": ("label",)}


def words(s: str) -> int:
    return len([w for w in TASHKEEL.sub("", s or "").split() if w.strip()])


def need_hold(s: str) -> float:
    return round(READ_SETTLE_S + READ_PER_WORD_S * words(s), 2)


# --------------------------------------------------------------------- check

def _font_px(layer: dict, vertical: bool) -> float:
    size = (layer.get("v") or {}).get("size") if vertical else None
    size = size if size is not None else layer.get("size", 0.2)
    return float(size) * 1080 / 4  # Gfx.tsx: text renders at size*1080*unit/4


# aspect -> (renders with the vertical `v` overrides, frame height in px)
ASPECT_FRAMES = {"16:9": (False, 1080), "9:16": (True, 1920), "1:1": (False, 1080), "4:5": (True, 1350)}
ALL_ASPECTS = ("16:9", "9:16")


def check_gfx(beat: dict, fps: float, add, aspects=ALL_ASPECTS) -> None:
    bid = beat.get("id", "?")
    data = beat.get("data") or {}
    layers = data.get("layers") or []
    dur = beat.get("dur", 0) / fps
    if not layers:
        return
    if data.get("backdrop") in (None, "solid") and not data.get("palette"):
        add("P1", bid, "flat ground", "set data.backdrop (mesh, grid, flow, topo, dots, beams) and a palette")
    glows = [l for l in layers if l.get("glow")]
    if len(glows) > 1:
        add("P0", bid, "two accents glow", f"{len(glows)} layers have glow; keep one")
    ats = [l.get("at") for l in layers if l.get("at") is not None]
    if len(ats) >= 3 and len(set(ats)) == 1:
        add("P1", bid, "everything enters at once", "stagger 0.12-0.5 s, or omit `at` for auto-stagger")
    zs = {l.get("z", 0) for l in layers if l.get("type") in ("card", "shape", "icon", "image")}
    if sum(1 for l in layers if l.get("type") in ("card", "shape")) >= 3 and len(zs) < 2:
        add("P2", bid, "no depth", "give cards/shapes at least two z values (0, 0.6, 1.2)")
    if len(layers) >= 4 and dur > 6 and not any(l.get("out") is not None for l in layers):
        add("P2", bid, "nothing leaves", "an element should exit (`out`) before the next idea")
    for l in layers:
        if l.get("type") == "text" and l.get("anim") == "pulse":
            add("P1", bid, "breathing title", "a landed title holds still; move the camera or the ground instead")
    texts = [l for l in layers if l.get("type") == "text"]
    if len(texts) >= 2:
        sizes = sorted(_font_px(l, False) for l in texts)
        if sizes[0] > 0 and sizes[-1] / sizes[0] < 3.0:
            add("P2", bid, "flat type scale", f"largest/smallest text = {sizes[-1] / sizes[0]:.1f}; aim for >= 3")
    for l in texts:
        for tag, (vertical, frame_h) in ASPECT_FRAMES.items():
            if tag not in aspects:
                continue
            if _font_px(l, vertical) < MIN_TEXT_FRAC * frame_h:
                add("P0", bid, f"text too small on {tag}", f"'{l.get('text', '')[:24]}' renders {_font_px(l, vertical):.0f}px; "
                    f"needs >= {MIN_TEXT_FRAC * frame_h:.0f}px (raise size{' or v.size' if vertical else ''})")
                break
    # reading time per text-bearing layer
    for l in layers:
        for field in TEXT_FIELDS.get(l.get("type"), ()):
            s = l.get(field)
            if not s:
                continue
            start = l.get("at") or 0.0
            end = l.get("out") if l.get("out") is not None else dur
            hold, need = end - start, need_hold(s)
            if hold < need:
                add("P1" if hold >= need * 0.7 else "P0", bid, "line too short to read",
                    f"'{s[:24]}' holds {hold:.1f}s, {words(s)} words need {need:.1f}s")
    # dead stretch: time with no new layer arriving or leaving
    events = sorted({0.0, dur, *[l.get("at") or 0.0 for l in layers], *[l.get("out") for l in layers if l.get("out")]})
    gaps = [b - a for a, b in zip(events, events[1:])]
    if gaps and max(gaps) > DEAD_STRETCH_S and not beat.get("vo"):
        add("P1", bid, "dead stretch", f"{max(gaps):.1f}s with nothing arriving and no voice")


MAX_CUES_PER_10S = 10     # above this the foley reads as a template, whatever the level


def check_sound(timeline: dict, add) -> None:
    """The compiled cue sheet (scripts/foley.py): level, density, monotony."""
    import foley

    beats = timeline.get("beats", [])
    fps = float(timeline.get("fps", 30))
    level = timeline.get("interaction") or (timeline.get("style") or {}).get("interaction") or "legacy"
    if level == "legacy" and beats:
        lv, why = foley.suggest(beats)
        add("P2", "-", "no interaction level", f"set style.interaction (suggested '{lv}': {why}); references/interaction.md")
    cues = timeline.get("cues") or []
    frames = sorted(c["frame"] for c in cues)
    j, worst = 0, 0
    for i, f in enumerate(frames):
        while frames[j] < f - 10 * fps:
            j += 1
        worst = max(worst, i - j + 1)
    if worst > MAX_CUES_PER_10S:
        add("P1", "-", "too many sounds", f"{worst} cues in one 10 s window; keep <= {MAX_CUES_PER_10S} (lower the interaction level)")
    run, last = 1, None
    for c in (c for c in cues if c.get("role") == "cut"):
        key = (c["name"], c.get("rate", 1))
        run = run + 1 if key == last else 1
        last = key
        if run == 4:
            add("P2", "-", "the same whoosh on every cut", f"'{c['name']}' x4 unchanged; rotate takes (an interaction level does it)")
    if level == "none" and any(c.get("role") not in ("named",) for c in cues):
        add("P1", "-", "foley over real footage", "level 'none' should carry only cues the film names")


def check(timeline: dict, aspects=ALL_ASPECTS) -> list[dict]:
    findings: list[dict] = []

    def add(level: str, where: str, problem: str, fix: str) -> None:
        findings.append({"level": level, "where": where, "problem": problem, "fix": fix})

    fps = float(timeline.get("fps", 30))
    beats = timeline.get("beats", [])
    raw = json.dumps(beats, ensure_ascii=False)
    if INDIC.search(raw):
        add("P0", "-", "Arabic-Indic digits", "project rule: Western digits 123 everywhere")
    for b in beats:
        dur = b.get("dur", 0) / fps
        if b.get("kind") == "gfx":
            check_gfx(b, fps, add, aspects)
        else:
            line = " ".join(x for x in (b.get("line1"), b.get("line2")) if x)
            if line and dur < need_hold(line):
                add("P1", b.get("id", "?"), "line too short to read", f"{words(line)} words in {dur:.1f}s")
    cuts = (timeline.get("style") or {}).get("transitions") or []
    if len(beats) >= 5 and len(set(cuts)) < 2:
        add("P2", "-", "one transition everywhere", "use 2-4 kinds, each caused by something on screen (motion-grammar.md)")
    if len(beats) >= 5:
        kinds = [b.get("kind") for b in beats]
        if len(set(kinds)) == 1 and kinds[0] == "gfx":
            anims = {l.get("anim", "pop") for b in beats for l in (b.get("data") or {}).get("layers", []) if l.get("type") == "text"}
            if len(anims) == 1:
                add("P2", "-", "same entrance on every title", f"all text uses '{anims.pop()}'; vary within the film")
    check_sound(timeline, add)
    order = {"P0": 0, "P1": 1, "P2": 2}
    return sorted(findings, key=lambda f: (order[f["level"]], f["where"]))


GATE_RECORD = ROOT / "out" / "craft-gate.json"


def render_gate(timeline_path: pathlib.Path | None = None, aspects=ALL_ASPECTS) -> int:
    """The hard gate every render passes through: any P0 refuses the render.

    Called by `studio.py render` and `studio.py export`. The result is recorded in
    out/craft-gate.json (timeline hash, counts, time) so `private deliver` can refuse
    a film whose render never passed. There is no override flag on purpose: fix the
    P0 in film.json, recompile, render again.
    """
    import datetime as dt
    import hashlib

    tl_path = timeline_path or ROOT / "src" / "generated" / "timeline.json"
    raw = tl_path.read_bytes()
    aspects = tuple(a.replace("x", ":") for a in aspects)
    findings = check(json.loads(raw.decode("utf-8")), aspects)
    p0 = [f for f in findings if f["level"] == "P0"]
    record = {"timeline": str(tl_path), "aspects": list(aspects), "sha256": hashlib.sha256(raw).hexdigest(), "pass": not p0,
              "counts": {k: sum(f["level"] == k for f in findings) for k in ("P0", "P1", "P2")},
              "p0": p0, "at": dt.datetime.now().isoformat(timespec="seconds")}
    GATE_RECORD.parent.mkdir(parents=True, exist_ok=True)
    GATE_RECORD.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    c = record["counts"]
    if p0:
        print(f"craft gate: REFUSED — {len(p0)} P0 (P1 {c['P1']}, P2 {c['P2']}). Fix these, recompile, render again:")
        for f in p0:
            print(f"  P0  {f['where']:<5} {f['problem']} -> {f['fix']}")
        return 1
    print(f"craft gate: pass (P0 0, P1 {c['P1']}, P2 {c['P2']}) — keep or fix the P1/P2 in REVIEW.md")
    return 0


def write_review(path: pathlib.Path, findings: list[dict]) -> None:
    lines = ["# REVIEW", "", "Measured by `studio.py craft check` on the compiled timeline. The sound was measured, not heard.", "",
             "## Findings", ""]
    lines += [f"- **{f['level']}** · {f['where']} · {f['problem']} → {f['fix']}" for f in findings] or ["- none"]
    lines += ["", "## Creative calls (fill in)", "", "- Storyline chosen, and the two not built:", "- Weakest shot, and what I would change:",
              "- Warnings kept on purpose, and why:", ""]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def cmd_check(a: argparse.Namespace) -> int:
    tl = json.loads(pathlib.Path(a.timeline).read_text(encoding="utf-8"))
    findings = check(tl)
    if a.review:
        write_review(pathlib.Path(a.review), findings)
    if a.json:
        print(json.dumps(findings, ensure_ascii=False, indent=2))
    else:
        counts = {k: sum(f["level"] == k for f in findings) for k in ("P0", "P1", "P2")}
        print(f"craft: P0 {counts['P0']}  P1 {counts['P1']}  P2 {counts['P2']}")
        for f in findings:
            print(f"  {f['level']}  {f['where']:<5} {f['problem']} -> {f['fix']}")
    return 1 if a.strict and any(f["level"] == "P0" for f in findings) else 0


# ---------------------------------------------------------------- storylines

def storylines(text: str) -> list[str]:
    errs = []
    blocks = re.split(r"^##\s+", text, flags=re.M)[1:]
    if len(blocks) < 3:
        errs.append(f"{len(blocks)} storylines; write three (## headings)")
    fields = ("device", "form", "first 2 seconds", "beats", "look", "sound")
    devices, forms = set(), set()
    for blk in blocks:
        name = blk.splitlines()[0].strip()
        low = blk.lower()
        for f in fields:
            if f"{f}:" not in low:
                errs.append(f"'{name}': missing '{f}:'")
        m = re.search(r"device:\s*(.+)", low)
        n = re.search(r"form:\s*(.+)", low)
        devices.add(m.group(1).strip() if m else name)
        forms.add(n.group(1).strip() if n else name)
    if blocks and (len(devices) < len(blocks) or len(forms) < len(blocks)):
        errs.append("storylines share a device or a form; they must be three different films")
    if not re.search(r"^picked:\s*\S+", text, flags=re.M | re.I):
        errs.append("no 'Picked: <name>' line")
    return errs


def cmd_storylines(a: argparse.Namespace) -> int:
    p = pathlib.Path(a.file)
    if not p.exists():
        print(f"missing {p}; copy references/story.md#template")
        return 1
    errs = storylines(p.read_text(encoding="utf-8"))
    for e in errs:
        print(f"  FAIL  {e}")
    print("storylines: ok" if not errs else f"storylines: {len(errs)} problem(s)")
    return 1 if errs else 0


# -------------------------------------------------------------------- styles

def load_styles() -> list[dict]:
    return json.loads(STYLES.read_text(encoding="utf-8"))["styles"]


def cmd_styles(a: argparse.Namespace) -> int:
    styles = {s["id"]: s for s in load_styles()}
    if a.action == "list":
        for s in styles.values():
            print(f"  {s['id']:<16} {s['look']:<16} {s['palette']:<16} {s['backdrop']:<6} for: {', '.join(s['for'][:3])}")
        return 0
    s = styles.get(a.id or "")
    if not s:
        print(f"unknown style '{a.id}'; one of: {', '.join(styles)}")
        return 1
    if a.action == "show":
        print(json.dumps(s, ensure_ascii=False, indent=2))
        return 0
    patch = {"look": s["look"], "motion": s["motion"], "transitions": s["transitions"], "interaction": s["interaction"]}

    def merge_file(path: pathlib.Path) -> None:
        cur = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        path.write_text(json.dumps({**cur, **patch}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{path} <- {s['id']} (look {s['look']}, motion {s['motion']}, cuts {', '.join(s['transitions'])})")

    if not a.film:
        merge_file(ROOT / "film" / "style.json")
        return 0
    # The compiler reads the film's own `style` (inline object, or a path next to the film);
    # write there, so applying a card never changes another film's look.
    fp = pathlib.Path(a.film)
    film = json.loads(fp.read_text(encoding="utf-8"))
    raw = film.get("style")
    if isinstance(raw, str):
        merge_file((fp.parent / raw).resolve())
        style = raw
    else:
        style = {**(raw if isinstance(raw, dict) else {}), **patch}
    n, beats = 0, []
    for b in film.get("beats", []):
        if b.get("kind") == "gfx":
            d = b.get("data") or {}
            nd = {"palette": s["palette"], "backdrop": s["backdrop"], **d}
            n += nd != d
            b = {**b, "data": nd}
        beats.append(b)
    fp.write_text(json.dumps({**film, "look": s["look"], "style": style, "beats": beats}, ensure_ascii=False, indent=2) + "\n",
                  encoding="utf-8")
    print(f"{fp}: style {s['id']} (look {s['look']}, cuts {', '.join(s['transitions'])}); "
          f"palette/backdrop filled on {n} gfx beat(s) that had none")
    return 0


# ----------------------------------------------------------------- breakdown

def _frames(src: pathlib.Path, fps: float, ffmpeg: str, size: tuple[int, int] = (160, 90)):
    """Grey frames at `fps`, via PNG files: the bundled ffmpeg has no rawvideo
    muxer and no fps filter, so this path works with it and with a full build."""
    import tempfile

    import numpy as np
    from PIL import Image

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([ffmpeg, "-v", "error", "-i", str(src), "-r", f"{fps:g}", "-vf", f"scale={size[0]}:{size[1]}",
                        str(pathlib.Path(tmp) / "%06d.png")], check=True)
        for f in sorted(pathlib.Path(tmp).glob("*.png")):
            yield np.asarray(Image.open(f).convert("L"), dtype=np.int16)


def cmd_breakdown(a: argparse.Namespace) -> int:
    sys.path.insert(0, str(ROOT / "scripts"))
    import numpy as np
    import qa

    src = pathlib.Path(a.video)
    if not src.is_file():
        print(f"not a file: {src}")
        return 1
    if not qa.FFMPEG:
        print("ffmpeg not found (npm install, or install ffmpeg)")
        return 1
    probe = qa.probe(src)
    fps = 10.0  # sampling rate: cuts land within 0.1 s, enough to learn a rhythm
    prev, cuts, i = None, [0], 0
    for frame in _frames(src, fps, qa.FFMPEG):
        if prev is not None:
            diff = np.abs(frame - prev)
            area = float((diff > 24).mean())
            dl = abs(float(frame.mean()) - float(prev.mean()))
            if area > 0.45 and (dl > 18 or area > 0.6) and i - cuts[-1] >= 3:
                cuts.append(i)
        prev, i = frame, i + 1
    if i == 0:
        print(f"no frames decoded from {src}")
        return 1
    cuts.append(i)
    shots = [(s / fps, e / fps) for s, e in zip(cuts, cuts[1:]) if e > s]
    out = pathlib.Path(a.out or ROOT / "out" / "breakdown" / src.stem)
    out.mkdir(parents=True, exist_ok=True)
    for k, (s, e) in enumerate(shots, 1):
        subprocess.run([qa.FFMPEG, "-v", "error", "-y", "-ss", f"{(s + e) / 2:.2f}", "-i", str(src), "-frames:v", "1",
                        "-vf", "scale=480:-2", str(out / f"shot{k:02d}.png")], check=False)
    lens = [e - s for s, e in shots]
    md = [f"# Breakdown: {src.name}", "",
          f"- duration {i / fps:.1f}s, {probe.get('width')}x{probe.get('height')} at {probe.get('fps')} fps, audio: {probe.get('acodec') or 'none'}",
          f"- {len(shots)} shots, average {sum(lens) / len(lens):.2f}s, shortest {min(lens):.2f}s, longest {max(lens):.2f}s"
          f" ({len(shots) / (i / fps) * 10:.1f} cuts per 10 s)", "",
          "Measured: cut times (±0.1 s) and one still per shot. Fill the rest by looking at each still (made with code,",
          "footage, screen capture or AI; how the type enters; the camera move; the sound at the cut). Then pin the",
          "moves you borrow with `studio.py refs add`. Borrow moves, never assets.", "",
          "| # | in | out | len | still | made with | what moves | text | borrow? |", "|---|---|---|---|---|---|---|---|---|"]
    md += [f"| {k} | {s:.1f} | {e:.1f} | {e - s:.1f} | shot{k:02d}.png |  |  |  |  |" for k, (s, e) in enumerate(shots, 1)]
    (out / "BREAKDOWN.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{len(shots)} shots -> {out / 'BREAKDOWN.md'}")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="craft gates, styles and reference breakdowns")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--timeline", default=str(ROOT / "src" / "generated" / "timeline.json"))
    c.add_argument("--strict", action="store_true")
    c.add_argument("--json", action="store_true")
    c.add_argument("--review", default="", help="also write a REVIEW.md delivery note here")
    s = sub.add_parser("storylines")
    s.add_argument("file", nargs="?", default=str(ROOT / "film" / "STORYLINES.md"))
    st = sub.add_parser("styles")
    st.add_argument("action", choices=["list", "show", "apply"])
    st.add_argument("id", nargs="?")
    st.add_argument("--film", default="")
    b = sub.add_parser("breakdown")
    b.add_argument("video")
    b.add_argument("--out", default="")
    a = ap.parse_args()
    handlers = {"check": cmd_check, "storylines": cmd_storylines, "styles": cmd_styles, "breakdown": cmd_breakdown}
    sys.exit(handlers[a.cmd](a))


if __name__ == "__main__":
    main()

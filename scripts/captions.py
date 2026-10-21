#!/usr/bin/env python3
"""Compile the film's beats into Arabic burned captions and standards-correct SRT.

`film/film.json` is the single source of truth: a cue is a beat's `vo` line(s),
placed on the same 120 BPM frame grid `make_timeline.py` compiles, so the SRT,
the burned captions and the film cannot drift apart. Nothing here reads a
rendered MP4, so the output is deterministic.

    python scripts/captions.py --film film/film.json
    python scripts/captions.py --film film/film.json --vo src/generated/vo.json
    python scripts/captions.py --check                 # re-read the SRTs and gate

Outputs
    out/captions/wide.srt       SubRip, UTF-8, CRLF, HH:MM:SS,mmm
    out/captions/vertical.srt   same cues re-wrapped at the 9:16 limit
    src/generated/captions.json frame (int) timed for React, so the player needs
        no clock: {"wide": [{"start": 0, "duration": 174, "lines": ["..."]}], ...}

Rules enforced in code (a violation exits non-zero)
    - cue start = beat start; cue end = beat end - TAIL_FRAMES
    - with measured VO: end = min(start + measured + 0.25 s, beat end - TAIL_FRAMES)
    - >= GAP_FRAMES free frames between any two cues, monotonic, never overlapping
    - wide lines <= 34 non-space chars, vertical <= 22, max 2 lines per cue;
      long VO becomes consecutive cues inside the same beat; words are never split
    - --check parses the SRT back and compares every cue with captions.json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
from dataclasses import dataclass
from typing import Any, NoReturn

ROOT = pathlib.Path(__file__).resolve().parents[1]

WIDE_MAX_CHARS = 34
VERTICAL_MAX_CHARS = 22
MAX_LINES = 2
TAIL_FRAMES = 6  # air after the line, before the cut (0.2 s at 30 fps)
GAP_FRAMES = 2  # two fully free frames between cues, so they never "touch"
VO_AIR = 0.25  # extra hold after the measured speech
MIN_CUE_FRAMES = 3  # shorter than this and the fade cannot resolve

SRT_TIME = re.compile(r"^(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})$")
WHITESPACE = re.compile(r"\s+")
# HARAKAT: fatha/kasra/damma/sukun/shadda/tanwin + superscript alef. The VO script
# carries them so the model pronounces the word; burned captions drop them.
HARAKAT = re.compile("[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")


@dataclass(frozen=True, slots=True)
class Beat:
    id: str
    start: int
    end: int
    vo: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Cue:
    start: int
    end: int
    lines: tuple[str, ...]

    @property
    def duration(self) -> int:
        return self.end - self.start


def fail(message: str) -> NoReturn:
    print(f"FAIL  {message}", file=sys.stderr)
    raise SystemExit(1)


def resolve(path: str) -> pathlib.Path:
    """Repo-relative like the other scripts, but absolute and cwd paths also work."""
    raw = pathlib.Path(path)
    if raw.is_absolute():
        return raw
    for base in (ROOT, pathlib.Path.cwd()):
        if (base / raw).exists():
            return base / raw
    return ROOT / raw


def load_json(path: pathlib.Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"{path} not found")
    except json.JSONDecodeError as exc:
        fail(f"{path} is not valid JSON: {exc}")


# ── film → beats ────────────────────────────────────────────────────────────
def beat_grid(film: dict[str, Any]) -> tuple[list[Beat], int, int]:
    """Beats in frames: `bars` (film.json) or `start`/`dur` (compiled timeline)."""
    raw_beats = film.get("beats")
    if not isinstance(raw_beats, list) or not raw_beats:
        fail("the film has no beats")
    fps = int(film.get("fps") or 30)
    bpm = int(film.get("bpm") or 120)
    bar = round(fps * 240 / bpm)  # one 4/4 bar: 60 frames @ 120 BPM / 30 fps
    beats: list[Beat] = []
    cursor = 0
    for i, raw in enumerate(raw_beats):
        if not isinstance(raw, dict):
            fail(f"beat {i + 1} is not an object")
        beat_id = str(raw.get("id") or f"b{i + 1:02d}")
        vo = tuple(str(line) for line in (raw.get("vo") or []) if str(line).strip())
        if "start" in raw and ("end" in raw or "dur" in raw):
            start = int(raw["start"])
            end = int(raw["end"]) if "end" in raw else start + int(raw["dur"])
        else:
            bars = float(raw.get("bars") or 0)
            if bars <= 0:
                fail(f"{beat_id}: needs a positive `bars` (or a compiled start/dur)")
            start = cursor
            end = start + round(bars * bar)
        if start < 0 or end <= start:
            fail(f"{beat_id}: invalid range [{start}, {end})")
        if beats and start < beats[-1].start:
            fail(f"{beat_id}: beats are out of order")
        beats.append(Beat(beat_id, start, end, vo))
        cursor = max(cursor, end)
    return beats, fps, bpm


# ── measured voice ──────────────────────────────────────────────────────────
def load_vo_manifest(path: pathlib.Path) -> tuple[dict[str, float], dict[str, float]]:
    """Per-line (`<beat>-<n>`) and beat-level measured seconds.

    Matches the manifest `scripts/voice.py` writes
    (`[{"id": "b01-hook-1", "text": ..., "dur": 2.4}, ...]`) and also accepts
    `{"beat": "b01-hook", "seconds": 2.4}` entries, plus a wrapper object whose
    `lines` list holds the entries.
    """
    if not path.exists():
        return {}, {}
    data = load_json(path)
    if isinstance(data, dict):
        data = data.get("lines") or data.get("beats") or []
    if not isinstance(data, list):
        fail(f"{path}: expected a list of measured lines")
    lines: dict[str, float] = {}
    beats: dict[str, float] = {}
    for entry in data:
        if not isinstance(entry, dict):
            continue
        seconds = entry.get("seconds", entry.get("dur"))
        if seconds is None:
            continue
        try:
            value = float(seconds)
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        line_id = str(entry.get("id") or "").strip()
        beat_id = str(entry.get("beat") or "").strip()
        if line_id:
            lines[line_id] = value
        if beat_id:
            beats[beat_id] = beats.get(beat_id, 0.0) + value
    return lines, beats


def measured_seconds(beat: Beat, lines: dict[str, float], beats: dict[str, float]) -> float | None:
    """Total measured speech for a beat, or None when the manifest is silent."""
    if beat.id in beats:
        return beats[beat.id]
    parts = [lines.get(f"{beat.id}-{i + 1}") for i in range(len(beat.vo))]
    known = [part for part in parts if part is not None]
    if known:
        return sum(known)
    return lines.get(beat.id)


# ── copy → wrapped lines → cues ─────────────────────────────────────────────
def clean_text(text: str) -> str:
    """Display copy. The film escapes the Arabic comma with a literal backslash —
    a prosody hint for the voice step, not something to burn into the picture."""
    plain = HARAKAT.sub("", text.replace("\\", ""))
    return WHITESPACE.sub(" ", plain).strip()


def visible_len(text: str) -> int:
    """Characters a viewer sees; spaces are free, diacritics are not."""
    return sum(1 for ch in text if not ch.isspace())


def _balance_two_lines(words: list[str], limit: int) -> list[str] | None:
    """Best 2-line split: smallest length difference, fuller first line on a tie."""
    lengths = [visible_len(word) for word in words]
    total = sum(lengths)
    best_diff, best_cut = 10**9, 0
    seen = 0
    for cut in range(1, len(words)):
        seen += lengths[cut - 1]
        rest = total - seen
        if seen > limit or rest > limit:
            continue
        diff = abs(seen - rest)
        if diff < best_diff or (diff == best_diff and cut > best_cut):
            best_diff, best_cut = diff, cut
    if not best_cut:
        return None
    return [" ".join(words[:best_cut]), " ".join(words[best_cut:])]


def wrap(text: str, limit: int) -> list[str]:
    """Greedy wrap at <= limit non-space chars, never inside a word."""
    lines: list[str] = []
    current: list[str] = []
    for word in text.split():
        candidate = " ".join([*current, word])
        if current and visible_len(candidate) > limit:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    if len(lines) == 2:
        return _balance_two_lines(text.split(), limit) or lines
    return lines


def chunk(lines: list[str], limit: int) -> list[tuple[str, ...]]:
    """At most MAX_LINES per cue; a long VO becomes consecutive cues."""
    cues: list[tuple[str, ...]] = []
    for i in range(0, len(lines), MAX_LINES):
        group = lines[i : i + MAX_LINES]
        if len(group) == 2:
            balanced = wrap(" ".join(group), limit)
            if len(balanced) == 2:
                group = balanced
        cues.append(tuple(group))
    return cues


def allocate(weights: list[int], window: int, gap: int) -> list[int]:
    """Split `window` frames proportionally, keeping `gap` frames between cues."""
    count = len(weights)
    usable = window - gap * (count - 1)
    if usable < count:
        fail(f"cannot fit {count} cues into {window} frames with a {gap}-frame gap")
    total = float(sum(weights))
    frames: list[int] = []
    remaining = usable
    for i, weight in enumerate(weights):
        if i == count - 1:
            frames.append(remaining)
            break
        share = int(round(usable * weight / total))
        share = max(1, min(share, remaining - (count - i - 1)))
        frames.append(share)
        remaining -= share
    return frames


def build_track(
    beats: list[Beat],
    fps: int,
    lines_secs: dict[str, float],
    beats_secs: dict[str, float],
    limit: int,
) -> list[Cue]:
    cues: list[Cue] = []
    for beat in beats:
        text = clean_text(" ".join(beat.vo))
        if not text:
            continue
        end = beat.end - TAIL_FRAMES
        measured = measured_seconds(beat, lines_secs, beats_secs)
        if measured is not None:
            end = min(end, beat.start + round((measured + VO_AIR) * fps))
        end = min(max(end, beat.start + MIN_CUE_FRAMES), beat.end)
        groups = chunk(wrap(text, limit), limit)
        frames = allocate([max(1, visible_len(" ".join(g))) for g in groups], end - beat.start, GAP_FRAMES)
        start = beat.start
        for group, duration in zip(groups, frames):
            cues.append(Cue(start=start, end=start + duration, lines=group))
            start += duration + GAP_FRAMES
    return cues


def validate(cues: list[Cue], limit: int, label: str) -> None:
    """The timing contract. A still or a video frame must never see two cues."""
    if not cues:
        fail(f"{label}: no cues")
    for i, cue in enumerate(cues):
        if cue.start < 0 or cue.end <= cue.start:
            fail(f"{label} cue {i + 1}: invalid range [{cue.start}, {cue.end})")
        if len(cue.lines) > MAX_LINES:
            fail(f"{label} cue {i + 1}: {len(cue.lines)} lines (max {MAX_LINES})")
        for line in cue.lines:
            if visible_len(line) > limit:
                fail(f"{label} cue {i + 1}: {visible_len(line)} non-space chars over {limit}: {line}")
        if i == 0:
            continue
        previous = cues[i - 1]
        if cue.start < previous.end:
            fail(f"{label} cue {i + 1}: overlaps cue {i} (end {previous.end} > start {cue.start})")
        if cue.start - previous.end < GAP_FRAMES:
            fail(f"{label} cue {i + 1}: {cue.start - previous.end} free frames after cue {i} (need {GAP_FRAMES})")


# ── SRT ─────────────────────────────────────────────────────────────────────
def to_ms(frame: int, fps: int) -> int:
    return int(round(frame * 1000 / fps))


def from_ms(millis: int, fps: int) -> int:
    return int(round(millis * fps / 1000))


def stamp(millis: int) -> str:
    hours, rest = divmod(millis, 3_600_000)
    minutes, rest = divmod(rest, 60_000)
    seconds, remainder = divmod(rest, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{remainder:03d}"


def render_srt(cues: list[Cue], fps: int) -> str:
    blocks = [
        f"{i}\n{stamp(to_ms(cue.start, fps))} --> {stamp(to_ms(cue.end, fps))}\n" + "\n".join(cue.lines)
        for i, cue in enumerate(cues, 1)
    ]
    return "\n\n".join(blocks) + "\n"


def parse_srt(text: str, label: str) -> list[tuple[int, int, list[str]]]:
    cues: list[tuple[int, int, list[str]]] = []
    for block in re.split(r"\n\s*\n", text.strip()):
        rows = block.splitlines()
        if len(rows) < 3:
            fail(f"{label}: malformed cue block {block[:60]!r}")
        try:
            index = int(rows[0].strip())
        except ValueError:
            fail(f"{label}: cue {len(cues) + 1} has no index")
        if index != len(cues) + 1:
            fail(f"{label}: cue numbering breaks at {rows[0]!r}")
        match = SRT_TIME.match(rows[1].strip())
        if not match:
            fail(f"{label}: bad timestamp line {rows[1]!r}")
        parts = [int(value) for value in match.groups()]
        start = ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000 + parts[3]
        end = ((parts[4] * 60 + parts[5]) * 60 + parts[6]) * 1000 + parts[7]
        cues.append((start, end, [row.rstrip() for row in rows[2:]]))
    if not cues:
        fail(f"{label}: no cues")
    return cues


# ── build / check ───────────────────────────────────────────────────────────
def write_outputs(film_path: str, vo_arg: str | None, out_arg: str, json_arg: str) -> dict[str, Any]:
    film = load_json(resolve(film_path))
    beats, fps, bpm = beat_grid(film)

    if vo_arg:
        vo_path = resolve(vo_arg)
        if not vo_path.exists():
            fail(f"{vo_path} not found")
    else:
        vo_path = ROOT / "src" / "generated" / "vo.json"
    line_secs, beat_secs = load_vo_manifest(vo_path)

    tracks = {
        "wide": build_track(beats, fps, line_secs, beat_secs, WIDE_MAX_CHARS),
        "vertical": build_track(beats, fps, line_secs, beat_secs, VERTICAL_MAX_CHARS),
    }
    limits = {"wide": WIDE_MAX_CHARS, "vertical": VERTICAL_MAX_CHARS}
    for name, cues in tracks.items():
        validate(cues, limits[name], name)

    out_dir = resolve(out_arg)
    json_path = resolve(json_arg)
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    for name, cues in tracks.items():
        (out_dir / f"{name}.srt").write_text(render_srt(cues, fps), encoding="utf-8", newline="\r\n")
    payload = {
        name: [{"start": c.start, "duration": c.duration, "lines": list(c.lines)} for c in cues]
        for name, cues in tracks.items()
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    measured = sum(1 for beat in beats if measured_seconds(beat, line_secs, beat_secs) is not None)
    voice = "no measured VO — beat-tail timing"
    if measured:
        voice = f"{vo_path.name}: {measured}/{len(beats)} beats measured"
    print(f"film      {film_path}  {len(beats)} beats @ {fps} fps, {bpm} BPM")
    print(f"vo        {voice}")
    for name, cues in tracks.items():
        max_chars = max((visible_len(line) for cue in cues for line in cue.lines), default=0)
        print(f"{name:8s}  {len(cues):2d} cues  <= {limits[name]} chars/line (max {max_chars}), "
              f"<= {MAX_LINES} lines, {GAP_FRAMES}-frame gap")
    print(f"\nwrote {out_dir / 'wide.srt'}")
    print(f"      {out_dir / 'vertical.srt'}")
    print(f"      {json_path}")
    return {"fps": fps, "beats": beats, "tracks": tracks}


def check(film_path: str, out_arg: str, json_arg: str) -> None:
    film = load_json(resolve(film_path))
    _, fps, _ = beat_grid(film)
    out_dir = resolve(out_arg)
    json_path = resolve(json_arg)
    data = load_json(json_path)
    limits = {"wide": WIDE_MAX_CHARS, "vertical": VERTICAL_MAX_CHARS}
    problems: list[str] = []

    for name, limit in limits.items():
        srt_path = out_dir / f"{name}.srt"
        if not srt_path.exists():
            fail(f"{srt_path} is missing — run without --check first")
        cues = parse_srt(srt_path.read_text(encoding="utf-8"), f"{name}.srt")
        wanted = data.get(name)
        if not isinstance(wanted, list):
            fail(f"{json_path}: no '{name}' list")
        if len(cues) != len(wanted):
            problems.append(f"{name}: {len(cues)} SRT cues vs {len(wanted)} in captions.json")

        print(f"\n{name}.srt  {len(cues)} cues  limit {limit} non-space chars, max {MAX_LINES} lines")
        print(f"{'cue':>3}  {'start':12}  {'end':12}  {'frames':>6}  {'chars':>5}  {'lines':>5}")
        previous_end: int | None = None
        for i, (start_ms, end_ms, lines) in enumerate(cues):
            label = f"{name} cue {i + 1}"
            start, end = from_ms(start_ms, fps), from_ms(end_ms, fps)
            if start_ms >= end_ms or start >= end:
                problems.append(f"{label}: end is not after start")
            if previous_end is not None:
                if start < previous_end:
                    problems.append(f"{label}: overlaps the previous cue")
                elif start - previous_end < GAP_FRAMES:
                    problems.append(f"{label}: {start - previous_end} free frames (need {GAP_FRAMES})")
            previous_end = end
            if len(lines) > MAX_LINES:
                problems.append(f"{label}: {len(lines)} lines (max {MAX_LINES})")
            for line in lines:
                if visible_len(line) > limit:
                    problems.append(f"{label}: {visible_len(line)} chars over {limit}: {line}")
            chars = sum(visible_len(line) for line in lines)
            print(f"{i + 1:3d}  {stamp(start_ms):12}  {stamp(end_ms):12}  {end - start:6d}  {chars:5d}  {len(lines):5d}")
            if i < len(wanted):
                cue = wanted[i]
                if start != int(cue.get("start", -1)) or end - start != int(cue.get("duration", -1)):
                    problems.append(f"{label}: timing disagrees with captions.json")
                if lines != list(cue.get("lines") or []):
                    problems.append(f"{label}: text disagrees with captions.json")

    if problems:
        print()
        for problem in problems:
            print(f"FAIL  {problem}")
        print(f"\n{len(problems)} violation(s)")
        raise SystemExit(1)
    print(f"\nOK  {sum(len(data[name]) for name in limits)} cues agree with captions.json "
          f"@ {fps} fps ({', '.join(f'{len(data[name])} {name}' for name in limits)})")


def main() -> None:
    parser = argparse.ArgumentParser(description="film beats -> Arabic burned captions + SRT")
    parser.add_argument("--film", default="film/film.json", help="film.json or a compiled timeline")
    parser.add_argument("--vo", default=None, help="measured VO manifest (default: src/generated/vo.json)")
    parser.add_argument("--out", default="out/captions", help="directory for wide.srt + vertical.srt")
    parser.add_argument("--json", default="src/generated/captions.json", help="frame-timed cues for React")
    parser.add_argument("--check", action="store_true", help="re-read the SRTs and gate the output")
    args = parser.parse_args()
    if args.check:
        check(args.film, args.out, args.json)
    else:
        write_outputs(args.film, args.vo, args.out, args.json)


if __name__ == "__main__":
    main()

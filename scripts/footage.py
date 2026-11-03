#!/usr/bin/env python3
"""Footage: real recordings in, an edit decision list out.

The studio's other forms draw every frame; this one starts from a camera or a
screen recorder. It does four measurable jobs and nothing it cannot measure:

    silence     find the pauses in the audio -> film/edl.json (keep ranges)
    transcribe  speech -> words with times (faster-whisper, if installed)
    clips       score transcript windows for a vertical short -> film/clips.json
    beats       EDL (+ transcript) -> `footage` beats in a film.json the renderer plays
    cut         EDL -> a jump-cut MP4 through ffmpeg (no graphics; a rough cut)

    python scripts/footage.py silence public/assets/talk/raw.mp4 --threshold -38
    python scripts/footage.py transcribe public/assets/talk/raw.mp4 --lang ar
    python scripts/footage.py clips film/transcript.json --min 20 --max 55 --top 5
    python scripts/footage.py beats film/edl.json --transcript film/transcript.json --out film/talk.json
    python scripts/footage.py cut film/edl.json --out out/rough_cut.mp4

Media must live under `public/` so the renderer can load it with staticFile().
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

RATE = 16000
HOP_S = 0.02
# Words that open a short well. Arabic first; English for bilingual channels.
HOOKS_AR = ("كيف", "لماذا", "ليش", "سر", "أسرار", "خطأ", "أخطاء", "أفضل", "أسوأ", "لا تفعل", "انتبه",
            "هل تعرف", "الحقيقة", "الطريقة", "خطوات", "مجاناً", "مجانا", "بدون")
HOOKS_EN = ("how", "why", "secret", "mistake", "never", "stop", "best", "worst", "truth", "free", "without")
SENTENCE_END = re.compile(r"[.!?؟。…]\s*$")


def ffmpeg_bin() -> str | None:
    """Bundled Remotion ffmpeg (worktrees reuse the main checkout's node_modules)."""
    import shutil
    exe = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    for base in (ROOT, *ROOT.parents):
        cand = base / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / exe
        if cand.exists():
            return str(cand)
    return shutil.which("ffmpeg")


def decode(path: pathlib.Path, rate: int = RATE):
    """Mono float PCM in [-1, 1] at `rate`."""
    import numpy as np
    ff = ffmpeg_bin()
    if not ff:
        raise SystemExit("ffmpeg not found: run `npm install` (Remotion ships one)")
    with tempfile.TemporaryDirectory() as tmp:
        wav = pathlib.Path(tmp) / "a.wav"
        proc = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-vn",
                               "-ac", "1", "-ar", str(rate), "-acodec", "pcm_s16le", str(wav)],
                              capture_output=True, text=True)
        if not wav.exists():
            raise SystemExit(f"could not decode audio from {path}: {proc.stderr.strip()[:300]}")
        with wave.open(str(wav), "rb") as w:
            raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def envelope_db(x, rate: int = RATE, hop_s: float = HOP_S) -> list[float]:
    """RMS level per hop, in dBFS."""
    import numpy as np
    hop = max(1, int(rate * hop_s))
    n = len(x) // hop
    if n == 0:
        return []
    frames = x[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    return [float(v) for v in 20 * np.log10(np.maximum(rms, 1e-6))]


def keep_ranges(db: list[float], hop_s: float = HOP_S, threshold_db: float = -38.0,
                min_silence: float = 0.45, pad: float = 0.08, min_keep: float = 0.25) -> list[tuple[float, float]]:
    """Speech ranges to keep: pauses shorter than `min_silence` stay (they are prosody),
    each kept range breathes `pad` seconds on both sides, slivers under `min_keep` go."""
    total = len(db) * hop_s
    loud = [v > threshold_db for v in db]
    ranges: list[list[float]] = []
    i = 0
    while i < len(loud):
        if loud[i]:
            j = i
            while j < len(loud) and loud[j]:
                j += 1
            ranges.append([i * hop_s, j * hop_s])
            i = j
        else:
            i += 1
    merged: list[list[float]] = []
    for r in ranges:
        if merged and r[0] - merged[-1][1] < min_silence:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    out = []
    for s, e in merged:
        if e - s < min_keep:
            continue
        s, e = max(0.0, s - pad), min(total, e + pad)
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], e)
        else:
            out.append((round(s, 3), round(e, 3)))
    return [(round(s, 3), round(e, 3)) for s, e in out]


def hook_score(text: str) -> float:
    t = text.strip().lower()
    head = " ".join(t.split()[:8])
    score = 0.0
    score += 2.0 * sum(1 for h in HOOKS_AR + HOOKS_EN if h in head)
    score += 1.5 if ("?" in head or "؟" in head) else 0.0
    score += 1.0 if re.search(r"[0-9٠-٩]", head) else 0.0
    return score


def score_clips(segments: list[dict], min_s: float = 20, max_s: float = 55, top: int = 5) -> list[dict]:
    """Windows that start on a segment, end on a sentence, and open on a hook.

    Score = hook strength of the first sentence + a pace term (2.2–3.2 words/s is
    the comfortable band for a short) + a clean-ending bonus. Non-overlapping, best first.
    """
    cands = []
    for i, first in enumerate(segments):
        words = 0
        for j in range(i, len(segments)):
            seg = segments[j]
            words += len(str(seg.get("text", "")).split())
            dur = float(seg["end"]) - float(first["start"])
            if dur > max_s:
                break
            if dur < min_s:
                continue
            ends = bool(SENTENCE_END.search(str(seg.get("text", ""))))
            wps = words / max(dur, 0.1)
            pace = max(0.0, 1.5 - abs(wps - 2.7))
            score = hook_score(str(first.get("text", ""))) + pace + (1.0 if ends else 0.0)
            text = " ".join(str(s.get("text", "")).strip() for s in segments[i:j + 1])
            cands.append({"start": float(first["start"]), "end": float(seg["end"]), "dur": round(dur, 2),
                          "score": round(score, 2), "hook": str(first.get("text", "")).strip(), "text": text})
    cands.sort(key=lambda c: c["score"], reverse=True)
    picked: list[dict] = []
    for c in cands:
        if all(c["end"] <= p["start"] or c["start"] >= p["end"] for p in picked):
            picked.append(c)
        if len(picked) >= top:
            break
    return picked


def public_rel(path: pathlib.Path) -> str:
    try:
        return path.resolve().relative_to((ROOT / "public").resolve()).as_posix()
    except ValueError:
        raise SystemExit(f"{path} is not under public/: move the media there so the renderer can load it")


def words_in(transcript: dict | None, start: float, end: float) -> list[dict]:
    if not transcript:
        return []
    out = []
    for seg in transcript.get("segments", []):
        for w in seg.get("words") or []:
            if float(w["start"]) >= start and float(w["end"]) <= end + 0.05:
                out.append({"w": str(w["word"]).strip(), "start": round(float(w["start"]) - start, 3),
                            "end": round(float(w["end"]) - start, 3)})
    return out


def edl_to_film(edl: dict, transcript: dict | None, fps: int = 30, vertical_crop: bool = True) -> dict:
    beats = []
    for k, r in enumerate(edl["ranges"]):
        beats.append({
            "id": f"f{k + 1:02d}", "kind": "footage", "tone": "ink",
            "seconds": round(r["out"] - r["in"], 3),
            "data": {"src": edl["src"], "in": r["in"], "out": r["out"],
                     "fit": "cover" if vertical_crop else "contain",
                     "words": words_in(transcript, r["in"], r["out"])},
        })
    return {"fps": fps, "format": "footage", "bpm": 120, "width": 1920, "height": 1080,
            "style": {"template": "talking-head", "transitions": ["blur"]}, "beats": beats}


def cmd_silence(a: argparse.Namespace) -> int:
    src = pathlib.Path(a.media)
    x = decode(src)
    db = envelope_db(x)
    ranges = keep_ranges(db, threshold_db=a.threshold, min_silence=a.min_silence, pad=a.pad)
    total = len(x) / RATE
    kept = sum(e - s for s, e in ranges)
    edl = {"src": public_rel(src), "duration": round(total, 3), "threshold_db": a.threshold,
           "ranges": [{"in": s, "out": e} for s, e in ranges],
           "kept_s": round(kept, 2), "removed_s": round(total - kept, 2)}
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(edl, indent=2) + "\n", encoding="utf-8")
    print(f"{len(ranges)} ranges · kept {kept:.1f}s of {total:.1f}s · removed {total - kept:.1f}s -> {a.out}")
    return 0


def cmd_transcribe(a: argparse.Namespace) -> int:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed: `pip install faster-whisper`, or pick a cloud "
              "transcriber with `studio.py providers pick transcribe`")
        return 2
    model = WhisperModel(a.model, device="auto", compute_type="int8")
    segs, info = model.transcribe(a.media, language=a.lang, word_timestamps=True, vad_filter=True)
    data = {"language": info.language, "segments": [
        {"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(),
         "words": [{"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3)} for w in (s.words or [])]}
        for s in segs]}
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(data['segments'])} segments -> {a.out}")
    return 0


def cmd_clips(a: argparse.Namespace) -> int:
    tr = json.loads((ROOT / a.transcript).read_text(encoding="utf-8"))
    picked = score_clips(tr.get("segments", []), a.min, a.max, a.top)
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(picked, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for c in picked:
        print(f"  {c['score']:5.2f}  {c['start']:7.2f}-{c['end']:7.2f} ({c['dur']:.0f}s)  {c['hook'][:60]}")
    print(f"{len(picked)} clips -> {a.out}")
    return 0 if picked else 1


def cmd_beats(a: argparse.Namespace) -> int:
    edl = json.loads((ROOT / a.edl).read_text(encoding="utf-8"))
    tr = json.loads((ROOT / a.transcript).read_text(encoding="utf-8")) if a.transcript else None
    film = edl_to_film(edl, tr, fps=a.fps)
    out = ROOT / a.out
    out.write_text(json.dumps(film, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(film['beats'])} footage beats -> {a.out}; add hook/cta/gfx beats, then `studio.py timeline --film {a.out}`")
    return 0


def cmd_cut(a: argparse.Namespace) -> int:
    """Trim each kept range to its own file, then join with the concat demuxer.

    Filter-free on purpose: the ffmpeg Remotion ships has no setpts/concat filters.
    Each part is re-encoded (frame-accurate in/out), the join is a stream copy.
    """
    edl = json.loads((ROOT / a.edl).read_text(encoding="utf-8"))
    ff = ffmpeg_bin()
    if not ff:
        print("ffmpeg not found")
        return 1
    src = ROOT / "public" / edl["src"]
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        listing = []
        for k, r in enumerate(edl["ranges"]):
            part = pathlib.Path(tmp) / f"p{k:03d}.mp4"
            proc = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(r["in"]), "-i", str(src),
                                   "-t", f"{r['out'] - r['in']:.3f}", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                                   "-c:a", "aac", "-b:a", "192k", "-ar", "48000", str(part)], capture_output=True, text=True)
            if proc.returncode:
                print(f"FAILED part {k}: {proc.stderr.strip()[:300]}")
                return proc.returncode
            listing.append(f"file '{part.as_posix()}'")
        lst = pathlib.Path(tmp) / "list.txt"
        lst.write_text("\n".join(listing) + "\n", encoding="utf-8")
        rc = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
                             "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)]).returncode
    print(f"{'wrote' if rc == 0 else 'FAILED'} {a.out} ({len(edl['ranges'])} parts)")
    return rc


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="footage: silence cut, transcript, shorts, EDL -> beats")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("silence")
    s.add_argument("media")
    s.add_argument("--threshold", type=float, default=-38.0, help="dBFS below which a hop is silence")
    s.add_argument("--min-silence", type=float, default=0.45)
    s.add_argument("--pad", type=float, default=0.08)
    s.add_argument("--out", default="film/edl.json")
    t = sub.add_parser("transcribe")
    t.add_argument("media")
    t.add_argument("--lang", default=None)
    t.add_argument("--model", default="small")
    t.add_argument("--out", default="film/transcript.json")
    c = sub.add_parser("clips")
    c.add_argument("transcript")
    c.add_argument("--min", type=float, default=20)
    c.add_argument("--max", type=float, default=55)
    c.add_argument("--top", type=int, default=5)
    c.add_argument("--out", default="film/clips.json")
    b = sub.add_parser("beats")
    b.add_argument("edl")
    b.add_argument("--transcript")
    b.add_argument("--fps", type=int, default=30)
    b.add_argument("--out", default="film/footage.json")
    k = sub.add_parser("cut")
    k.add_argument("edl")
    k.add_argument("--out", default="out/rough_cut.mp4")
    a = ap.parse_args(argv)
    return {"silence": cmd_silence, "transcribe": cmd_transcribe, "clips": cmd_clips,
            "beats": cmd_beats, "cut": cmd_cut}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())

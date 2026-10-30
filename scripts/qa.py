#!/usr/bin/env python3
"""QA the delivered files, not the composition.

Probes every master for picture/audio facts, scans the sources for the classic
Arabic corruption signatures, optionally extracts stills and a contact sheet, and
exits non-zero when a hard gate fails.

    python scripts/qa.py                       # probe + arabic scan + sheets
    python scripts/qa.py --files out/a.mp4
    python scripts/qa.py --stills 8 --no-sheets
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
QA = OUT / "qa"

# The build ships its own ffmpeg inside the Remotion compositor package.
BUNDLED = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc"


def tool(name: str) -> str | None:
    exe = f"{name}.exe" if sys.platform == "win32" else name
    bundled = BUNDLED / exe
    if bundled.exists():
        return str(bundled)
    return shutil.which(name)


FFMPEG = tool("ffmpeg")
FFPROBE = tool("ffprobe")

# Mojibake that only appears when Arabic passed through a cp1256/UTF-8 mismatch.
ARABIC_SIGNS = ["\u00e2\u20ac", "\u00c3", "\ufffd", "\u0637\u00a7", "\u0638\u2026\u0637\u00a7", "\u00d8", "\u00d9"]


def probe(path: pathlib.Path) -> dict:
    assert FFPROBE
    cmd = [FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    data = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout or "{}")
    v = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    a = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    num, _, den = (v.get("r_frame_rate") or "0/1").partition("/")
    fps = round(float(num) / float(den or 1), 3) if float(den or 1) else 0
    return {
        "file": path.name,
        "size_mb": round(path.stat().st_size / 1e6, 1),
        "width": v.get("width"),
        "height": v.get("height"),
        "fps": fps,
        "duration": round(float(data.get("format", {}).get("duration") or 0), 3),
        "pix_fmt": v.get("pix_fmt"),
        "vcodec": v.get("codec_name"),
        "acodec": a.get("codec_name"),
        "arate": a.get("sample_rate"),
        "ach": a.get("channels"),
    }


def loudness(path: pathlib.Path) -> dict | None:
    """Peak/RMS/clipped from the decoded PCM (ffmpeg -f null is unavailable)."""
    if not FFMPEG:
        return None
    try:
        import numpy as np
    except ImportError:
        return None
    QA.mkdir(parents=True, exist_ok=True)
    wav = QA / f"_probe_{path.stem}.wav"
    subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
         "-vn", "-acodec", "pcm_s16le", str(wav)],
        capture_output=True,
    )
    if not wav.exists():
        return None
    import wave
    with wave.open(str(wav), "rb") as w:
        ch, width, n = w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    dtype = {1: np.int8, 2: np.int16, 4: np.int32}.get(width, np.int16)
    x = np.frombuffer(raw, dtype=dtype).astype(np.float64) / float(2 ** (8 * width - 1))
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    rms = float(np.sqrt(np.mean(x ** 2))) if x.size else 0.0
    clipped = int(np.sum(np.abs(x) >= 0.999))
    wav.unlink(missing_ok=True)
    db = lambda v: round(20 * (v and __import__("math").log10(v) or -999), 2)
    return {"peak_db": db(peak), "rms_db": db(rms), "clipped": clipped, "channels": ch}


def black_frames(path: pathlib.Path) -> int | None:
    if not FFMPEG:
        return None
    cmd = [FFMPEG, "-hide_banner", "-nostats", "-i", str(path),
           "-vf", "blackdetect=d=0.10:pix_th=0.06:pic_th=0.98", "-an", "-f", "null", "NUL"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    text = (r.stdout or "") + (r.stderr or "")
    if "Encoder not found" in text or "Unknown encoder" in text:
        return None
    return len(re.findall(r"black_start", text))


def arabic_scan() -> list[str]:
    hits: list[str] = []
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file() or "node_modules" in p.parts or "out" in p.parts:
            continue
        if p.suffix not in {".tsx", ".ts", ".json", ".md", ".py", ".jsonc"}:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            hits.append(f"{p.relative_to(ROOT)}: not valid UTF-8")
            continue
        for sign in ARABIC_SIGNS:
            if sign in text:
                hits.append(f"{p.relative_to(ROOT)}: contains {sign!r}")
                break
    return hits


def stills(files: list[pathlib.Path], count: int, dest_dir: pathlib.Path) -> list[pathlib.Path]:
    if not FFMPEG:
        return []
    made: list[pathlib.Path] = []
    for path in files:
        info = probe(path)
        dur = info["duration"] or 1
        tag = "wide" if (info["width"] or 0) >= (info["height"] or 0) else "vert"
        for i in range(count):
            t = dur * (i + 0.5) / count
            dest = dest_dir / f"{tag}_{i + 1:02d}.png"
            subprocess.run(
                [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}",
                 "-i", str(path), "-frames:v", "1", str(dest)],
                capture_output=True,
            )
            if dest.exists():
                made.append(dest)
    return made


def sheet(images: list[pathlib.Path], name: str, cols: int = 4, width: int = 480) -> pathlib.Path | None:
    try:
        from PIL import Image
    except ImportError:
        return None
    imgs = [Image.open(i).convert("RGB") for i in images]
    if not imgs:
        return None
    scale = width / imgs[0].width
    h = int(imgs[0].height * scale)
    rows = (len(imgs) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * width, rows * h), (12, 12, 12))
    for i, im in enumerate(imgs):
        canvas.paste(im.resize((width, h), Image.LANCZOS), ((i % cols) * width, (i // cols) * h))
    dest = QA / f"{name}.png"
    canvas.save(dest)
    return dest


def main() -> None:
    p = argparse.ArgumentParser(description="QA the delivered masters")
    p.add_argument("--files", nargs="*", default=None)
    p.add_argument("--stills", type=int, default=0, help="extract N stills per file")
    p.add_argument("--no-sheets", action="store_true")
    p.add_argument("--no-arabic", action="store_true")
    p.add_argument("--every", type=int, default=4, help="contact-sheet columns")
    p.add_argument("--arabic-only", action="store_true", help="just scan the sources")
    p.add_argument("--require-audio", action="store_true", help="fail on a silent master")
    a = p.parse_args()

    if a.arabic_only:
        hits = arabic_scan()
        for h in hits:
            print(h)
        print('arabic scan: ' + ('FAILED' if hits else 'clean'))
        sys.exit(1 if hits else 0)

    QA.mkdir(parents=True, exist_ok=True)
    files = [pathlib.Path(f) for f in a.files] if a.files else sorted(OUT.glob("*.mp4"))
    if not files:
        print("no mp4 in out/ — render first (python scripts/studio.py render)")
        sys.exit(2)

    failures: list[str] = []
    warnings: list[str] = []
    frames_dir = QA / "frames"
    if frames_dir.exists():
        for old in frames_dir.glob("*.png"):
            old.unlink()
    frames_dir.mkdir(parents=True, exist_ok=True)
    print(f"{'file':28s} {'size':>7s} {'picture':>11s} {'fps':>6s} {'dur':>8s} {'peak':>7s} {'rms':>7s} {'clip':>5s} {'black':>6s}")
    for f in files:
        if not f.exists():
            failures.append(f"{f.name}: missing")
            continue
        info = probe(f)
        lvl = loudness(f) or {}
        black = black_frames(f)
        peak = f"{lvl['peak_db']:7.2f}" if "peak_db" in lvl else "      -"
        rms = f"{lvl['rms_db']:7.2f}" if "rms_db" in lvl else "      -"
        clip = f"{lvl['clipped']:5d}" if "clipped" in lvl else "    -"
        blk = f"{black:6d}" if black is not None else "     -"
        print(
            f"{info['file']:28s} {info['size_mb']:6.1f}M "
            f"{str(info['width']) + 'x' + str(info['height']):>11s} {info['fps']:6.2f} "
            f"{info['duration']:7.2f}s {peak} {rms} {clip} {blk}"
        )
        if lvl.get("peak_db", -99) > -1.0:
            failures.append(f"{f.name}: peak {lvl['peak_db']} dBFS is too hot (target ≤ -1.4)")
        if lvl.get("clipped"):
            failures.append(f"{f.name}: {lvl['clipped']} clipped samples")
        if black:
            failures.append(f"{f.name}: {black} black stretch(es)")
        if info["pix_fmt"] and info["pix_fmt"] != "yuv420p":
            failures.append(f"{f.name}: pix_fmt {info['pix_fmt']} (want yuv420p)")
        if not info["acodec"]:
            msg = f"{f.name}: silent master (no audio stream)"
            (failures if a.require_audio else warnings).append(msg)

    if a.stills:
        made = stills(files, a.stills, frames_dir)
        print(f"\n{len(made)} stills -> {frames_dir.relative_to(ROOT)}/")
        if made and not a.no_sheets:
            for f in files:
                tag = "wide" if (probe(f)["width"] or 0) >= (probe(f)["height"] or 0) else "vert"
                sel = sorted(frames_dir.glob(f"{tag}_*.png"))
                dest = sheet(sel, f"sheet_{tag}", cols=a.every)
                if dest:
                    print(f"sheet -> {dest.relative_to(ROOT)}")

    if not a.no_arabic:
        hits = arabic_scan()
        if hits:
            print("\nARABIC SCAN — corrupted text found:")
            for h in hits:
                print(f"  {h}")
            failures.extend(hits)
        else:
            print("\nARABIC SCAN — clean (no mojibake signatures)")

    if warnings:
        print("\nwarnings:")
        for w in warnings:
            print(f"  - {w}")

    if failures:
        print("\nFAILED GATES")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("\nall gates passed")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Register voice recorded outside the studio (your own voice, another TTS).

    python scripts/vo_import.py --film projects/qissat-raqam/episodes/d01.json
    python scripts/vo_import.py --film film/film.json --dir public/audio/vo --out src/generated/vo.json

For every VO line `j` of beat `bNN` the film expects `<dir>/bNN-j.wav`. Each file is
measured (duration from the WAV header, never guessed) and written to the manifest
the compiler reads, with the line's text from the film. Missing files are listed and
the command exits 1, so a half-voiced film never compiles as if it were complete.
Then: `studio.py timeline --strict` checks every line fits its beat (+0.35 s air).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]


def duration(path: pathlib.Path) -> float:
    with wave.open(str(path)) as w:
        return w.getnframes() / float(w.getframerate())


def main() -> int:
    ap = argparse.ArgumentParser(description="measure external VO wavs into vo.json")
    ap.add_argument("--film", required=True)
    ap.add_argument("--dir", default="public/audio/vo", help="folder under the repo holding bNN-j.wav")
    ap.add_argument("--out", default="src/generated/vo.json")
    ap.add_argument("--voice", default="external", help="label recorded in the manifest")
    a = ap.parse_args()

    film = json.loads((ROOT / a.film).read_text(encoding="utf-8"))
    folder = ROOT / a.dir
    public = ROOT / "public"
    manifest, missing = [], []
    for b in film.get("beats", []):
        for j, text in enumerate(b.get("vo") or [], 1):
            lid = f"{b['id']}-{j}"
            wav = folder / f"{lid}.wav"
            if not wav.exists():
                missing.append(str(wav.relative_to(ROOT)))
                continue
            try:
                dur = duration(wav)
            except (wave.Error, EOFError) as exc:
                missing.append(f"{wav.relative_to(ROOT)} (not a PCM wav: {exc})")
                continue
            manifest.append({"id": lid, "text": text if isinstance(text, str) else text.get("text", ""),
                             "wav": str(wav.relative_to(public)).replace("\\", "/"), "dur": round(dur, 3),
                             "speed": 1.0, "voice": a.voice})
            print(f"  {lid}.wav  {dur:6.2f}s")
    if missing:
        print("missing or unreadable:\n  " + "\n  ".join(missing))
        return 1
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(manifest)} lines, {sum(m['dur'] for m in manifest):.2f}s -> {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

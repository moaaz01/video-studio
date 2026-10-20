#!/usr/bin/env python3
"""Fish Audio TTS bridge for the studio: script -> VO wavs -> measured manifest.

The film is cut to the voice, so this tool does two jobs: it synthesises the
lines and it measures what came back, so `make_timeline.py` can place each line
on the musical grid without guessing.

    python scripts/voice.py --list-voices
    python scripts/voice.py --text "نصّ عربي مشكول" --out out/vo/test.wav
    python scripts/voice.py --script vo.json          # batch, writes the manifest
    python scripts/voice.py --script vo.json --dry-run

Key handling: `FISH_API_KEY` from the environment, else the first `.env` found
walking up from this file. The key is never written into the repository.

API: POST https://api.fish.audio/v1/tts  (raw audio bytes back)
Docs: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import wave

import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
API_BASE = "https://api.fish.audio"
DEFAULT_MODEL = "s2.1-pro-free"  # free tier; swap to s2.1-pro for the paid ceiling
DEFAULT_FORMAT = "wav"
# Fish only accepts 8000/16000/24000/32000/44100 for wav — 48 kHz is rejected,
# so the VO comes in at 44.1 kHz and the mixer resamples the bed to match.
DEFAULT_RATE = 44100


# --------------------------------------------------------------------------- key
def load_key() -> str:
    key = os.environ.get("FISH_API_KEY", "").strip()
    if key:
        return key
    for d in (ROOT, *ROOT.parents):
        env = d / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("FISH_API_KEY"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(
        "FISH_API_KEY is not set. Put it in .env (gitignored) or export it:\n"
        "  PowerShell:  $env:FISH_API_KEY = 'sk-fish-...'\n"
        "  bash:        export FISH_API_KEY=sk-fish-..."
    )


def call(path: str, key: str, payload: dict | None = None) -> bytes:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=body,
        method="POST" if payload is not None and path.endswith("/tts") else "GET",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "model": payload.get("_model", DEFAULT_MODEL) if payload else DEFAULT_MODEL,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        sys.exit(f"HTTP {e.code} from {path}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"network error talking to {API_BASE}: {e.reason}")


def list_voices(key: str) -> None:
    raw = call("/model?page_size=50&self=true", key)
    data = json.loads(raw)
    items = data.get("items", data if isinstance(data, list) else [])
    if not items:
        print("no voice models on this account; use a stock reference_id or clone one")
        return
    print(f"{'id':40s} {'lang':6s} {'title'}")
    for m in items:
        print(f"{m.get('_id',''):40s} {str(m.get('languages') or m.get('language',''))[:6]:6s} "
              f"{m.get('title','')}")


def wav_duration(path: pathlib.Path) -> tuple[float, int, int]:
    """Duration/rate/channels of a wav, tolerating a streamed header.

    Fish streams the wav, so the RIFF header can carry a placeholder data size
    (0 / 0xFFFFFFFF) that makes `wave` report nonsense. Parse the chunks by hand
    and, when the declared size is unusable, measure the bytes actually present.
    """
    raw = path.read_bytes()
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        sys.exit(f"{path.name} is not a wav — ask for --format wav")
    pos, rate, ch, block_align, data_off = 12, 44100, 1, 2, None
    while pos + 8 <= len(raw):
        cid, size = raw[pos:pos + 4], int.from_bytes(raw[pos + 4:pos + 8], "little")
        body = pos + 8
        if cid == b"fmt ":
            ch = int.from_bytes(raw[body + 2:body + 4], "little")
            rate = int.from_bytes(raw[body + 4:body + 8], "little")
            block_align = int.from_bytes(raw[body + 12:body + 14], "little") or 2
        elif cid == b"data":
            data_off = body
            break
        pos = body + size + (size & 1)
    if data_off is None:
        sys.exit(f"{path.name}: no data chunk found")
    # Never trust the declared size: a streamed wav declares either 0 or a
    # placeholder far smaller than the payload. The bytes after `data` are the
    # audio, so measure those.
    data_size = len(raw) - data_off
    return data_size / (rate * max(1, block_align)), rate, ch


def fix_wav_header(path: pathlib.Path) -> None:
    """Rewrite the RIFF/data sizes a streamed wav leaves as placeholders.

    Fish returns `RIFF…size=0xFFFFFFxx` and `data…size=0xFFFFFF00`; ffmpeg and
    most DAWs then read the file as truncated. The payload is complete, so the
    two size fields can be recomputed and written back.
    """
    raw = bytearray(path.read_bytes())
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        return
    pos = 12
    while pos + 8 <= len(raw):
        cid, size = bytes(raw[pos:pos + 4]), int.from_bytes(raw[pos + 4:pos + 8], "little")
        if cid == b"data":
            raw[4:8] = (len(raw) - 8).to_bytes(4, "little")
            raw[pos + 4:pos + 8] = (len(raw) - pos - 8).to_bytes(4, "little")
            path.write_bytes(bytes(raw))
            return
        pos = pos + 8 + size + (size & 1)


# --------------------------------------------------------------------------- tts
def tts(text: str, out: pathlib.Path, key: str, a: argparse.Namespace) -> float:
    payload = {
        "text": text,
        "format": a.format,
        "sample_rate": a.sample_rate,
        "normalize": a.normalize,
        "chunk_length": a.chunk_length,
        "latency": a.latency,
        "prosody": {
            "speed": a.speed,
            "volume": a.volume,
            "normalize_loudness": not a.no_normalize_loudness,
        },
        "_model": a.model,
    }
    if a.reference_id:
        payload["reference_id"] = a.reference_id
    if a.format == "mp3":
        payload["mp3_bitrate"] = a.mp3_bitrate
    payload.pop("_model")

    if a.dry_run:
        print(f"[dry] {out.name}: {text[:48]}…")
        return 0.0

    audio = call("/v1/tts", key, {**payload, "_model": a.model})
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(audio)
    if a.format == "wav":
        fix_wav_header(out)

    if a.format != "wav":
        print(f"  !! {a.format} cannot be measured here — ask for wav for the film")
        return 0.0
    dur, sr, ch = wav_duration(out)
    print(f"  {out.name:12s} {dur:6.2f}s  {sr} Hz  {ch} ch  {len(audio)/1024:6.0f} KB")
    return dur


def batch(script: pathlib.Path, key: str, a: argparse.Namespace) -> None:
    spec = json.loads(script.read_text(encoding="utf-8"))
    lines = spec["lines"] if isinstance(spec, dict) else spec
    voice = spec.get("voice", {}) if isinstance(spec, dict) else {}
    if voice:
        a.reference_id = a.reference_id or voice.get("reference_id")
        a.model = voice.get("model", a.model)
        a.speed = voice.get("speed", a.speed)

    out_dir = ROOT / (spec.get("out_dir", "public/audio/vo") if isinstance(spec, dict) else "public/audio/vo")
    manifest_path = ROOT / (spec.get("manifest", "src/generated/vo.json") if isinstance(spec, dict) else "src/generated/vo.json")

    manifest = []
    for line in lines:
        lid, text = line["id"], line["text"]
        wav = out_dir / f"{lid}.wav"
        dur = tts(text, wav, key, a)
        manifest.append({
            "id": lid,
            "text": text,
            "wav": str(wav.relative_to(ROOT / "public")).replace("\\", "/"),
            "dur": round(dur, 3),
            "speed": a.speed,
            "voice": a.reference_id or "fish-default",
        })

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(m["dur"] for m in manifest)
    print(f"\n{len(manifest)} lines, {total:.2f}s of speech -> {manifest_path.relative_to(ROOT)}")


def main() -> None:
    p = argparse.ArgumentParser(description="Fish Audio TTS bridge")
    p.add_argument("--script", type=pathlib.Path, help="batch spec: {voice, lines:[{id,text}]}")
    p.add_argument("--text", help="single line")
    p.add_argument("--out", type=pathlib.Path, default=pathlib.Path("out/vo/test.wav"))
    p.add_argument("--reference-id", default=None, help="Fish voice model id")
    p.add_argument("--model", default=DEFAULT_MODEL, help="s2.1-pro-free | s2.1-pro | s2-pro")
    p.add_argument("--format", default=DEFAULT_FORMAT, choices=["wav", "mp3", "pcm"])
    p.add_argument("--sample-rate", type=int, default=DEFAULT_RATE)
    p.add_argument("--speed", type=float, default=1.0)
    p.add_argument("--volume", type=float, default=0.0)
    p.add_argument("--chunk-length", type=int, default=300)
    p.add_argument("--mp3-bitrate", type=int, default=128)
    p.add_argument("--latency", default="normal", choices=["normal", "balanced"])
    p.add_argument("--normalize", action="store_true", default=True)
    p.add_argument("--no-normalize-loudness", action="store_true")
    p.add_argument("--list-voices", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    key = load_key()
    if a.list_voices:
        list_voices(key)
    elif a.script:
        batch(ROOT / a.script if not a.script.is_absolute() else a.script, key, a)
    elif a.text:
        tts(a.text, ROOT / a.out, key, a)
    else:
        p.print_help()


if __name__ == "__main__":
    main()

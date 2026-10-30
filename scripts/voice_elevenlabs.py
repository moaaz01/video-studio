#!/usr/bin/env python3
"""ElevenLabs TTS bridge (optional): lines -> wavs + measured word timings.

Fish stays the studio default. This adapter exists for the explainer workflow
where the headline must reveal each word when it is spoken: ElevenLabs'
`with-timestamps` endpoint returns character timings, which become word timings
in `src/generated/vo.json`. If the key is absent the studio still runs; only this
provider is unavailable.

    export ELEVENLABS_API_KEY=...            # or put it in .env (gitignored)
    python scripts/voice_elevenlabs.py --list-voices
    python scripts/voice_elevenlabs.py --text "نصّ عربي" --out out/vo/test.wav
    python scripts/voice_elevenlabs.py --script film/vo.json

No key is ever written to the repository. Per-sentence generation is deliberate:
one take per line, so a pause edit cannot clip the end of a word.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import qa  # noqa: E402
from voice import audio_stats  # noqa: E402

API = "https://api.elevenlabs.io/v1"
DEFAULT_MODEL = "eleven_multilingual_v2"
DEFAULT_FORMAT = "mp3_44100_128"


def load_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        return key
    for d in (ROOT, *ROOT.parents):
        env = d / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("ELEVENLABS_API_KEY"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(
        "ELEVENLABS_API_KEY is not set. Put it in .env (gitignored) or export it:\n"
        "  PowerShell:  $env:ELEVENLABS_API_KEY = '...'\n"
        "  bash:        export ELEVENLABS_API_KEY=..."
    )


def call(path: str, key: str, payload: dict | None = None, method: str = "GET") -> bytes:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=body,
        method=method,
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        hint = {
            401: "check ELEVENLABS_API_KEY",
            402: "the free plan cannot use this voice/model; pick another or upgrade",
            429: "rate limited; wait before retrying (no automatic retry spends credits)",
        }.get(e.code, "")
        sys.exit(f"HTTP {e.code} from {path}: {detail}" + (f"\n  {hint}" if hint else ""))
    except urllib.error.URLError as e:
        sys.exit(f"network error talking to {API}: {e.reason}")


def list_voices(key: str) -> None:
    data = json.loads(call("/voices", key))
    rows = data.get("voices", data if isinstance(data, list) else [])
    print(f"{'voice_id':28s} {'name':28s} labels")
    for v in rows:
        labels = v.get("labels") or {}
        print(f"{v.get('voice_id', ''):28s} {str(v.get('name', ''))[:28]:28s} "
              f"{', '.join(f'{k}={val}' for k, val in labels.items())[:70]}")


def word_timings(alignment: dict) -> list[dict]:
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    if not (len(chars) == len(starts) == len(ends)):
        return []
    words: list[dict] = []
    current: list[str] = []
    start = end = 0.0
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if current:
                words.append({"w": "".join(current), "start": round(start, 3), "end": round(end, 3)})
                current = []
            continue
        if not current:
            start = float(s)
        current.append(ch)
        end = float(e)
    if current:
        words.append({"w": "".join(current), "start": round(start, 3), "end": round(end, 3)})
    return words


def to_wav(mp3: pathlib.Path, wav: pathlib.Path) -> None:
    ff = qa.FFMPEG
    if not ff:
        sys.exit("ffmpeg not found; install it or npm install")
    wav.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        [ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "1", str(wav)],
        capture_output=True, text=True,
    )
    if proc.returncode:
        sys.exit(f"ffmpeg failed: {proc.stderr[:400]}")
    mp3.unlink(missing_ok=True)


def synth(text: str, out_wav: pathlib.Path, key: str, a: argparse.Namespace, voice: dict) -> tuple[float, list[dict]]:
    if a.dry_run:
        print(f"[dry] {out_wav.name}: {text[:52]}…")
        return 0.0, []
    voice_id = voice.get("voice_id") or a.voice_id
    if not voice_id:
        sys.exit("no voice_id: pass --voice-id or set voice.voice_id in the spec")
    payload = {
        "text": text,
        "model_id": voice.get("model") or a.model,
        "voice_settings": {
            "stability": float(voice.get("stability", a.stability)),
            "similarity_boost": float(voice.get("similarity_boost", a.similarity)),
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }
    speed = float(voice.get("speed", a.speed) or 1.0)
    if abs(speed - 1.0) > 1e-3:
        payload["voice_settings"]["speed"] = speed
    raw = call(f"/text-to-speech/{voice_id}/with-timestamps?output_format={a.output_format}", key, payload, "POST")
    data = json.loads(raw.decode("utf-8"))
    audio = data.get("audio_base64")
    if not audio:
        sys.exit(f"{out_wav.name}: response has no audio_base64")
    mp3 = out_wav.with_suffix(".mp3")
    mp3.write_bytes(base64.b64decode(audio))
    to_wav(mp3, out_wav)
    st = audio_stats(out_wav)
    words = word_timings(data.get("alignment") or data.get("normalized_alignment") or {})
    print(f"  {out_wav.name:14s} {st['dur']:6.2f}s  peak {st['peak_db']:6.1f}  "
          f"words {len(words):3d}  clipped {st['clipped']}")
    return st["dur"], words


def batch(script: pathlib.Path, key: str, a: argparse.Namespace) -> None:
    spec = json.loads(script.read_text(encoding="utf-8"))
    voice = spec.get("voice", {}) if isinstance(spec, dict) else {}
    lines = spec.get("lines", []) if isinstance(spec, dict) else spec
    out_dir = ROOT / (spec.get("out_dir", "public/audio/vo") if isinstance(spec, dict) else "public/audio/vo")
    manifest_path = ROOT / (spec.get("manifest", "src/generated/vo.json") if isinstance(spec, dict) else "src/generated/vo.json")
    a.voice_id = a.voice_id or voice.get("voice_id")
    a.model = voice.get("model") or a.model or DEFAULT_MODEL
    if not a.voice_id:
        sys.exit("spec.voice.voice_id is empty — run --list-voices and choose one")
    manifest = []
    for line in lines:
        lid, text = line["id"], line["text"]
        out = out_dir / f"{lid}.wav"
        dur, words = synth(text, out, key, a, {**voice, **line})
        manifest.append({
            "id": lid,
            "text": text,
            "wav": str(out.relative_to(ROOT / "public")).replace("\\", "/"),
            "dur": round(dur, 3),
            "provider": "elevenlabs",
            "voice": a.voice_id,
            "model": a.model,
            "words": words,
        })
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(m["dur"] for m in manifest)
    print(f"\n{len(manifest)} lines, {total:.2f}s of speech, {sum(len(m['words']) for m in manifest)} word timings -> {manifest_path.relative_to(ROOT)}")


def main() -> None:
    p = argparse.ArgumentParser(description="ElevenLabs TTS + word timestamps")
    p.add_argument("--script", type=pathlib.Path, help="batch spec: {voice, lines:[{id,text}]}")
    p.add_argument("--text", help="single line")
    p.add_argument("--out", type=pathlib.Path, default=pathlib.Path("out/vo/test.wav"))
    p.add_argument("--voice-id", default=None)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--stability", type=float, default=0.5)
    p.add_argument("--similarity", type=float, default=0.75)
    p.add_argument("--speed", type=float, default=1.0)
    p.add_argument("--output-format", default=DEFAULT_FORMAT)
    p.add_argument("--list-voices", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    key = "" if a.dry_run else load_key()
    if a.list_voices:
        list_voices(key)
    elif a.script:
        batch(ROOT / a.script if not a.script.is_absolute() else a.script, key, a)
    elif a.text:
        synth(a.text, ROOT / a.out, key, a, {"voice_id": a.voice_id, "model": a.model})
    else:
        p.print_help()


if __name__ == "__main__":
    main()

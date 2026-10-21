#!/usr/bin/env python3
"""Fish Audio TTS bridge for the studio: script -> VO wavs -> measured manifest.

The film is cut to the voice, so this tool does two jobs: it synthesises the
lines and it measures what came back, so `make_timeline.py` can place each line
on the musical grid without guessing.

    python scripts/voice.py --list-voices
    python scripts/voice.py --text "نصّ عربي مشكول" --out out/vo/test.wav
    python scripts/voice.py --script vo.json          # batch, writes the manifest
    python scripts/voice.py --script vo.json --dry-run

Voice reuse: Fish's `--list-voices` only lists the models on *this* account, so a
voice you liked in an audition is reusable only after it exists as a model. Clone
the audition wav (4.4 s of clean single-speaker TTS is enough) and pass the
returned id as `reference_id`:

    python scripts/voice.py --clone out/vo-probe/shami-m-deep.wav --name shami-m-deep
    # -> cloned reference_id 8e0c... (state=trained); then:
    python scripts/voice.py --script vo-script.json --reference-id 8e0c...

`--clone` posts multipart to `POST /model` (type=tts, train_mode=fast, private),
which is the Fish voice-cloning endpoint. Pass `--ref-text` with the transcript of
the reference wav when you know it; otherwise Fish ASR transcribes it for you.

Every synthesised wav is measured on the spot (peak/onset/tail/clipped samples),
because a line that starts mid-phoneme or ends clipped sounds truncated even when
the ASR round-trip is clean.

Key handling: `FISH_API_KEY` from the environment, else the first `.env` found
walking up from this file. The key is never written into the repository.

API: POST https://api.fish.audio/v1/tts  (raw audio bytes back)
API: POST https://api.fish.audio/model   (multipart: voice clone -> reference id)
Docs: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
"""
from __future__ import annotations

import argparse
import array
import json
import math
import os
import pathlib
import sys
import uuid
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


# ------------------------------------------------------------------------- clone
def multipart(fields: dict[str, str], files: list[tuple[str, str, bytes, str]]) -> tuple[bytes, str]:
    """Encode one multipart/form-data body (stdlib only, client sets the boundary)."""
    boundary = uuid.uuid4().hex
    body: list[bytes] = []
    for name, value in fields.items():
        body.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode("utf-8")
        )
    for name, filename, payload, ctype in files:
        body.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; '
            f'filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode("utf-8")
        )
        body.append(payload)
        body.append(b"\r\n")
    body.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(body), boundary


def clone_voice(wav: pathlib.Path, name: str, key: str, a: argparse.Namespace) -> str:
    """Clone a reference wav into a private Fish model; return its reference_id.

    The model is created with `train_mode=fast`, which makes it usable as a
    `reference_id` immediately (state=trained). `voices` is the file part; the
    reference transcript is optional (`--ref-text`), otherwise Fish ASR reads it.
    """
    if not wav.exists():
        sys.exit(f"{wav} does not exist — point --clone at the audition wav")
    size = wav.stat().st_size
    if size > 10 * 1024 * 1024:
        sys.exit(f"{wav.name} is {size / 1e6:.1f} MB; the cloning endpoint accepts <= 10 MB")
    fields = {
        "type": "tts",
        "title": name,
        "train_mode": "fast",
        "visibility": a.visibility,
        "enhance_audio_quality": "true",
        "generate_sample": "false",
    }
    if a.description:
        fields["description"] = a.description
    if a.tags:
        fields["tags"] = json.dumps([t.strip() for t in a.tags.split(",") if t.strip()],
                                    ensure_ascii=False)
    if a.ref_text:
        fields["texts"] = a.ref_text
    body, boundary = multipart(fields, [("voices", wav.name, wav.read_bytes(), "audio/wav")])
    req = urllib.request.Request(
        f"{API_BASE}/model",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    if a.dry_run:
        print(f"[dry] would clone {wav.name} as {name!r}")
        return ""
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            raw = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        sys.exit(f"HTTP {e.code} from /model: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"network error talking to {API_BASE}: {e.reason}")
    model = json.loads(raw)
    rid = model.get("_id", "")
    if not rid:
        sys.exit(f"/model returned no _id: {raw[:400]}")
    print(f"cloned {wav.name} -> reference_id {rid}")
    print(f"  title={model.get('title')!r} state={model.get('state')} "
          f"languages={model.get('languages')} visibility={model.get('visibility')}")
    if a.clone_json:
        out = ROOT / a.clone_json
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  response -> {a.clone_json}")
    return rid


# --------------------------------------------------------------------- measurement
def wav_pcm(path: pathlib.Path) -> tuple[array.array, int, int, int]:
    """Mono/stereo 16-bit PCM samples + rate/channels/bits from the bytes after `data`.

    Same distrust as `wav_duration`: a streamed header can lie about the data
    size, so the payload is `len(raw) - data_offset`, not the declared size.
    """
    raw = path.read_bytes()
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        sys.exit(f"{path.name} is not a wav")
    pos, rate, ch, bits, data_off = 12, 44100, 1, 16, None
    while pos + 8 <= len(raw):
        cid, size = raw[pos:pos + 4], int.from_bytes(raw[pos + 4:pos + 8], "little")
        body = pos + 8
        if cid == b"fmt ":
            ch = int.from_bytes(raw[body + 2:body + 4], "little")
            rate = int.from_bytes(raw[body + 4:body + 8], "little")
            bits = int.from_bytes(raw[body + 14:body + 16], "little") or 16
        elif cid == b"data":
            data_off = body
            break
        pos = body + size + (size & 1)
    if data_off is None:
        sys.exit(f"{path.name}: no data chunk")
    pcm = array.array("h")
    pcm.frombytes(raw[data_off:])
    if sys.byteorder == "big":
        pcm.byteswap()
    return pcm, rate, ch, bits


def audio_stats(path: pathlib.Path) -> dict[str, float]:
    """Peak/RMS/onset/tail/clip counts — the numbers that expose a cut phoneme."""
    pcm, rate, ch, _bits = wav_pcm(path)
    if not pcm:
        return {"dur": 0.0, "peak_db": -999.0, "rms_db": -999.0,
                "onset_db": -999.0, "tail_db": -999.0, "clipped": 0}
    samples = [s / 32768.0 for s in pcm]
    peak = max(abs(s) for s in samples)
    rms = math.sqrt(sum(s * s for s in samples) / len(samples))
    win = max(1, int(rate * ch * 0.03))  # first/last 30 ms
    onset = math.sqrt(sum(s * s for s in samples[:win]) / win)
    tail = math.sqrt(sum(s * s for s in samples[-win:]) / win)
    clipped = sum(1 for s in pcm if abs(s) >= 32767)

    def db(x: float) -> float:
        return 20.0 * math.log10(max(x, 1e-6))

    return {
        "dur": round(len(samples) / (rate * ch), 3),
        "peak_db": round(db(peak), 1),
        "rms_db": round(db(rms), 1),
        "onset_db": round(db(onset), 1),
        "tail_db": round(db(tail), 1),
        "clipped": clipped,
    }


def prepend_silence(path: pathlib.Path, seconds: float) -> None:
    """Add lead silence inside the data chunk (header sizes rewritten)."""
    if seconds <= 0:
        return
    pcm, rate, ch, bits = wav_pcm(path)
    block = max(1, (bits // 8) * ch)
    silence = b"\x00" * int(rate * seconds) * block
    raw = path.read_bytes()
    pos = 12
    data_hdr = None
    while pos + 8 <= len(raw):
        cid, size = raw[pos:pos + 4], int.from_bytes(raw[pos + 4:pos + 8], "little")
        if cid == b"data":
            data_hdr = pos
            break
        pos = pos + 8 + size + (size & 1)
    if data_hdr is None:
        sys.exit(f"{path.name}: no data chunk to pad")
    data_off = data_hdr + 8
    new = bytearray(raw[:data_off] + silence + raw[data_off:])
    new[4:8] = (len(new) - 8).to_bytes(4, "little")
    new[data_hdr + 4:data_hdr + 8] = (len(new) - data_off).to_bytes(4, "little")
    path.write_bytes(bytes(new))


def measure_line(path: pathlib.Path) -> dict[str, float]:
    st = audio_stats(path)
    print(f"  {path.name:12s} {st['dur']:6.2f}s  peak {st['peak_db']:6.1f} dBFS  "
          f"onset {st['onset_db']:6.1f}  tail {st['tail_db']:6.1f}  clipped {st['clipped']}")
    return st


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
        prepend_silence(out, a.lead_silence)
        st = measure_line(out)
        return st["dur"]

    print(f"  !! {a.format} cannot be measured here — ask for wav for the film")
    return 0.0


def batch(script: pathlib.Path, key: str, a: argparse.Namespace) -> None:
    spec = json.loads(script.read_text(encoding="utf-8"))
    lines = spec["lines"] if isinstance(spec, dict) else spec
    voice = spec.get("voice", {}) if isinstance(spec, dict) else {}
    base_speed, base_lead = a.speed, a.lead_silence
    if voice:
        a.reference_id = a.reference_id or voice.get("reference_id")
        a.model = voice.get("model", a.model)
        a.speed = base_speed = voice.get("speed", a.speed)
    if isinstance(spec, dict):
        a.lead_silence = base_lead = spec.get("lead_silence", base_lead)

    out_dir = ROOT / (spec.get("out_dir", "public/audio/vo") if isinstance(spec, dict) else "public/audio/vo")
    manifest_path = ROOT / (spec.get("manifest", "src/generated/vo.json") if isinstance(spec, dict) else "src/generated/vo.json")
    only = {x.strip() for x in (a.only or "").split(",") if x.strip()}
    previous = {}
    if only and manifest_path.exists():
        for m in json.loads(manifest_path.read_text(encoding="utf-8")):
            previous[m["id"]] = m

    manifest = []
    for line in lines:
        lid, text = line["id"], line["text"]
        if only and lid not in only:
            # Re-take one line without re-rolling the takes that already pass:
            # the existing entry keeps its wav, duration and text.
            if lid in previous:
                manifest.append(previous[lid])
                print(f"  {lid}.wav   kept {previous[lid]['dur']:.2f}s from the manifest")
            continue
        # per-line overrides: a line may need a slower take or a touch of lead air
        a.speed = float(line.get("speed", base_speed))
        a.lead_silence = float(line.get("lead_silence", base_lead))
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
    p.add_argument("--only", default="",
                   help="batch: re-take only these ids (comma-separated); keep the rest from the manifest")
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
    p.add_argument("--clone", type=pathlib.Path, default=None,
                   help="reference wav to clone into a private Fish model (voice reuse)")
    p.add_argument("--name", default=None, help="model title for --clone")
    p.add_argument("--ref-text", default=None,
                   help="transcript of the --clone wav; omit and Fish ASR writes it")
    p.add_argument("--description", default=None, help="model description for --clone")
    p.add_argument("--tags", default=None, help="comma-separated model tags for --clone")
    p.add_argument("--visibility", default="private", choices=["private", "unlist", "public"])
    p.add_argument("--clone-json", default="", help="write the POST /model response here")
    p.add_argument("--lead-silence", type=float, default=0.0,
                   help="seconds of silence prepended to a synthesised line")
    p.add_argument("--measure", type=pathlib.Path, default=None,
                   help="print duration/peak/onset/tail/clipped for an existing wav")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    if a.clone and not a.name:
        p.error("--clone needs --name (the Fish model title)")
    key = load_key()
    if a.list_voices:
        list_voices(key)
    elif a.clone:
        clone_voice(ROOT / a.clone if not a.clone.is_absolute() else a.clone, a.name, key, a)
    elif a.measure:
        m = ROOT / a.measure if not a.measure.is_absolute() else a.measure
        measure_line(m)
    elif a.script:
        batch(ROOT / a.script if not a.script.is_absolute() else a.script, key, a)
    elif a.text:
        tts(a.text, ROOT / a.out, key, a)
    else:
        p.print_help()


if __name__ == "__main__":
    main()

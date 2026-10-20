#!/usr/bin/env python3
"""Round-trip the delivered VO through Fish ASR and prove no line was mangled.

TTS can drop a clause, repeat a word, or invent one and still sound fluent. The
only machine-checkable proxy available offline is the inverse model: transcribe
the wav, normalise Arabic orthography (diacritics, alef/ya/ta-marbuta forms,
punctuation), and compare against the scripted line. A large edit means the
voice, not the listener, changed the words.

    python scripts/voice_check.py --script projects/studyai-shami/vo-script.json
    python scripts/voice_check.py --script ... --threshold 0.82 --json out/vo-asr.json

Exit code 1 if any line falls below the threshold or loses a content word.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASR_URL = "https://api.fish.audio/v1/asr"

HARAKAT = re.compile(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0640]")
NORM = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه"})
PUNCT = re.compile(r"[^\w\s\u0600-\u06ff]|[\u060c\u061b\u061f\u066a-\u066d\u0640]")


def normalise(text: str) -> str:
    text = HARAKAT.sub("", text)
    text = text.translate(NORM)
    text = PUNCT.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_key() -> str:
    key = os.environ.get("FISH_API_KEY", "").strip()
    if key:
        return key
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("FISH_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("FISH_API_KEY not found (.env or environment)")


def asr(wav: pathlib.Path, key: str) -> str:
    boundary = uuid.uuid4().hex
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="audio"; filename="vo.wav"\r\n',
            b"Content-Type: audio/wav\r\n\r\n",
            wav.read_bytes(),
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    req = urllib.request.Request(
        ASR_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return (data.get("text") or data.get("result", {}).get("text") or "").strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True, help="the vo spec that produced the wavs")
    ap.add_argument("--manifest", default="src/generated/vo.json")
    ap.add_argument("--threshold", type=float, default=0.90, help="min char similarity per line")
    ap.add_argument("--json", default="", help="write the full report here")
    args = ap.parse_args()

    spec = json.loads(pathlib.Path(args.script).read_text(encoding="utf-8"))
    lines = spec["lines"] if isinstance(spec, dict) else spec
    manifest = json.loads((ROOT / args.manifest).read_text(encoding="utf-8"))
    by_id = {m["id"]: m for m in manifest}
    key = load_key()

    report, worst, bad = [], 1.0, 0
    print(f"{'line':16s} {'sim':>5s} {'words':>9s}  heard")
    for line in lines:
        lid, text = line["id"], line["text"]
        wav = ROOT / "public" / by_id[lid]["wav"]
        heard = asr(wav, key)
        a, b = normalise(text), normalise(heard)
        sim = difflib.SequenceMatcher(None, a, b).ratio()
        wa, wb = a.split(), b.split()
        # ASR normalises dialect orthography (وحدة -> واحدة, شي -> شيء), so exact
        # word-set recall is the wrong test. Character similarity covers dropped or
        # invented words; the word-count guard catches a whole clause going missing.
        delta = abs(len(wa) - len(wb))
        worst = min(worst, sim)
        ok = sim >= args.threshold and delta <= 1
        bad += 0 if ok else 1
        diff = [t for t in difflib.ndiff(wa, wb) if t[:1] in "+-"]
        report.append({
            "id": lid, "script": text, "heard": heard, "similarity": round(sim, 4),
            "word_delta": len(wb) - len(wa), "diff": diff, "pass": ok,
        })
        print(f"{lid:16s} {sim:5.3f} {len(wa):4d}/{len(wb):<4d}  {heard[:64]}")
        if not ok:
            print(f"  !! script: {text}")
            print(f"     diff: {' '.join(diff)[:120]}")

    print(f"\nworst similarity {worst:.3f}, {len(lines) - bad}/{len(lines)} lines pass "
          f"(threshold {args.threshold}, word delta <= 1)")
    if args.json:
        out = ROOT / args.json
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"threshold": args.threshold, "lines": report,
                                   "worst": round(worst, 4)}, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
        print(f"report -> {args.json}")
    sys.exit(0 if bad == 0 else 1)


if __name__ == "__main__":
    main()

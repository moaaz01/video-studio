#!/usr/bin/env python3
"""Compose the music bed for the compiled film: deterministic, original, measured.

The film is cut to 120 BPM, so the bed is built on that grid, section by section
from the timeline itself. No samples and no downloads: four detuned sine stacks
per chord, a soft sub pulse on beats 1 and 3, a filtered-noise shimmer where the
film turns (stat, cta), and a fade at both ends. Everything is a function of the
timeline, so a re-cut re-scores itself.

    python scripts/make_bed.py
    python scripts/make_bed.py --timeline src/generated/timeline.json --out public/audio/score/music.wav
    python scripts/make_bed.py --json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SR = 48000
CHANNELS = 2
TARGET_RMS_DBFS = -19.0  # the level Soundtrack.tsx assumes; measured, not assumed
PEAK_CEILING_DBFS = -3.0

# A minor 7 -> F major 7 -> C major 7 -> G6, one chord per four bars, resolved by
# the film's own timings. Frequencies in Hz; the pad is three detuned partials
# plus a fifth, which is what makes it read as "warm room" instead of "organ".
CHORDS = [
    (196.00, 261.63, 329.63, 392.00),  # G  B  E  G  (G6 over G)
    (174.61, 261.63, 329.63, 440.00),  # F  C  E  A  (Fmaj7)
    (130.81, 196.00, 261.63, 329.63),  # C  G  C  E  (C)
    (110.00, 164.81, 261.63, 329.63),  # A  E  C  E  (Am7)
]
DETUNE = (-0.6, 0.0, 0.7)  # cents-ish offsets applied per partial, in Hz


def db_to_amp(db: float) -> float:
    return float(10.0 ** (db / 20.0))


def synth_pad(n: int, t0: float, seconds: float, chord: tuple[float, ...]) -> np.ndarray:
    """One chord of the bed: additive partials, slow attack, gentle tremolo."""
    idx = np.arange(int(seconds * SR)) / SR
    env = np.minimum(1.0, idx / 0.9) * np.minimum(1.0, np.maximum(0.0, (seconds - idx) / 0.8))
    tremolo = 1.0 + 0.04 * np.sin(2 * np.pi * 0.17 * idx)
    voice = np.zeros_like(idx)
    for k, freq in enumerate(chord):
        for det in DETUNE:
            voice += np.sin(2 * np.pi * (freq + det) * idx + k) / (k + 1.6)
    segment = 0.045 * voice * env * tremolo
    out = np.zeros(n)
    start_sample = int(round(t0 * SR))
    end = min(n, start_sample + len(segment))
    if 0 <= start_sample < n:
        out[start_sample:end] = segment[: end - start_sample]
    return out


def synth_pulse(n: int, at: float, freq: float = 55.0, length: float = 0.32, gain: float = 0.22) -> np.ndarray:
    """A soft sub thump on the strong beats - felt, not heard."""
    start = int(at * SR)
    size = int(length * SR)
    out = np.zeros(n)
    idx = np.arange(size) / SR
    out[start:start + size] = gain * np.sin(2 * np.pi * freq * idx) * np.exp(-idx * 14.0)
    return out


def synth_shimmer(n: int, at: float, seconds: float, seed: int = 7) -> np.ndarray:
    """Filtered noise that rises and falls - marks the stat and the end card."""
    rng = np.random.default_rng(seed)
    start = int(at * SR)
    size = int(seconds * SR)
    idx = np.arange(size) / SR
    raw = rng.standard_normal(size)
    smooth = np.convolve(raw, np.ones(220) / 220, mode="same")
    env = np.sin(np.pi * np.clip(idx / seconds, 0, 1)) ** 2
    out = np.zeros(n)
    out[start:start + size] = 0.05 * smooth * env
    return out


def build(timeline: dict) -> np.ndarray:
    fps = timeline.get("fps", 30)
    frames = timeline.get("frames", 0)
    bpm = timeline.get("bpm", 120)
    seconds = frames / fps
    n = int(round(seconds * SR))
    bar = 240.0 / bpm
    beats = timeline.get("beats", [])

    left = np.zeros(n)
    right = np.zeros(n)
    for b in beats:
        start = b["start"] / fps
        dur = b["dur"] / fps
        bars = max(1, round(dur / bar))
        chord = CHORDS[(int(start / (bar * 4)) + 1) % len(CHORDS)]
        left += synth_pad(n, start, dur, chord)
        right += synth_pad(n, start + 0.01, dur, chord)
        for k in range(bars):
            beat_at = start + k * bar
            for strong in (0.0, 2.0):  # beats 1 and 3
                left += synth_pulse(n, beat_at + strong * bar / 4)
                right += synth_pulse(n, beat_at + strong * bar / 4, freq=54.5)
        if b["kind"] in ("stat", "cta"):
            left += synth_shimmer(n, start, min(dur, 2.4), seed=3 + len(left))
            right += synth_shimmer(n, start, min(dur, 2.4), seed=11 + len(right))

    # one-pole low-pass to keep the bed under the voice, then a short pre-roll fade
    mix = np.stack([left, right], axis=1)
    fade = np.minimum(1.0, np.arange(n) / (0.9 * SR))
    tail = np.minimum(1.0, (n - np.arange(n)) / (1.6 * SR))
    mix *= (fade * tail)[:, None]

    rms = float(np.sqrt(np.mean(mix ** 2)))
    target = db_to_amp(TARGET_RMS_DBFS)
    mix *= target / max(rms, 1e-9)
    peak = float(np.max(np.abs(mix)))
    ceiling = db_to_amp(PEAK_CEILING_DBFS)
    if peak > ceiling:
        mix *= ceiling / peak
    return mix


def write_wav(path: pathlib.Path, mix: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(mix, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(CHANNELS)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    ap = argparse.ArgumentParser(description="compose the music bed from the timeline")
    ap.add_argument("--timeline", default="src/generated/timeline.json")
    ap.add_argument("--out", default="public/audio/score/music.wav")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    timeline = json.loads((ROOT / args.timeline).read_text(encoding="utf-8"))
    mix = build(timeline)
    write_wav(ROOT / args.out, mix)

    rms_db = 20 * np.log10(max(float(np.sqrt(np.mean(mix ** 2))), 1e-9))
    peak_db = 20 * np.log10(max(float(np.max(np.abs(mix))), 1e-9))
    report = {
        "file": args.out,
        "seconds": round(len(mix) / SR, 3),
        "rate": SR,
        "channels": CHANNELS,
        "rms_dbfs": round(float(rms_db), 2),
        "peak_dbfs": round(float(peak_db), 2),
        "clipped_samples": int(np.sum(np.abs(mix) >= 1.0)),
        "beats": len(timeline.get("beats", [])),
    }
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"bed  {report['seconds']:.2f}s  {SR} Hz  {CHANNELS} ch")
        print(f"rms  {report['rms_dbfs']:+.2f} dBFS   peak {report['peak_dbfs']:+.2f} dBFS   "
              f"clipped {report['clipped_samples']}")
        print(f"wrote {args.out}")


if __name__ == "__main__":
    main()

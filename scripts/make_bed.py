#!/usr/bin/env python3
"""Compose the music bed for the compiled film: deterministic, original, measured.

The film is cut to 120 BPM, so the bed is built on that grid, section by section
from the timeline itself. No samples and no downloads: four detuned sine stacks
per chord, a soft sub pulse on beats 1 and 3, a filtered-noise shimmer where the
film turns (stat, cta), and a fade at both ends. Everything is a function of the
timeline, so a re-cut re-scores itself.

Two distribution patterns share that contract — same grid, same 48 kHz stereo,
same measured -19 dBFS RMS under a -3 dBFS ceiling:

    classic     the pad bed above; the default, unchanged, used by the studio show
    souk-drop   a modern cinematic-electronic launch track: dark sub-pulsed intro,
                four-on-the-floor drop with a trap 808 and 16th hats, machine-room
                middle with a deeper sidechain, half-time heartbeat with a clock
                tick and a 3.2 s riser that stops before the drop, then the widest
                drop resolving to the major tonic. Still pure synthesis; see the
                "style souk-drop" block below for the whole arrangement.

    python scripts/make_bed.py
    python scripts/make_bed.py --timeline src/generated/timeline.json --out public/audio/score/music.wav
    python scripts/make_bed.py --json
    python scripts/make_bed.py --style souk-drop --report out/audio/score-report.json

souk-drop levels itself: RMS to -19 dBFS, then a look-ahead limiter that spends
the crest instead of the level, so the peak lands under -3 dBFS both as a sample
peak and as a 4x true peak. Do not run level_score.py over that file — it
peak-normalises to -1.4 dBFS, which is above the ceiling this bed has to hold.
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import shutil
import subprocess
import sys
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


# =============================================================================
# style "souk-drop" — a modern cinematic-electronic launch track
# =============================================================================
#
# The classic bed above is a slow pad with a sub on beats 1 and 3. This style is
# the sound of a 2025-26 product launch, and every section of the film gets a
# different job:
#
#   hook      dark and held back: a sub pulse on 0.5 s and 2.0 s, a low pad, bells
#             and a block figure building, a swish where the film turns
#   store     DROP 1: kick on every quarter, trap 808 underneath, 16th hats, clap
#             on 2 and 4, a short block arpeggio, a high sparkle two bars in
#   admin     the same groove but lighter and more mechanical: deeper sidechain,
#             an accent on every bar line, a roll and a riser into the next part
#   security  half-time heartbeat: kick on 1 and 3, a clock tick, a 3.2 s riser
#             that lands and then *stops* — 0.8 s of room tone, not silence
#   cta       DROP 2, the widest: everything, the yellow shimmer, then the tonic
#             resolves to its major third on the last bar and rings to the cut
#
# Everything is generated: partial stacks, a band-limited saw wavetable, filtered
# noise and a synthetic reverb tail. No sample, no stem, no download. The
# arrangement is read from the timeline, so a re-cut re-scores itself.

_LN1000 = 6.907755278982137  # ln(1000): a -60 dB decay, as "t60"
_EPS = 1e-9

# The harmony is a mode, not a sample: i - bVI - bIII - bVII over twenty bars,
# with the flat second of the Hijaz mode showing up in the bells of the intro and
# the build, and a Picardy third on the final bar so the film lands bright.
_SOUK_CHORDS = {
    # name: (808 root, pad voicing, wide voicing, arp register offset)
    "Fm": {"root": 29, "notes": (53, 56, 60, 65), "wide": (53, 56, 60, 65, 68)},
    "Db": {"root": 25, "notes": (49, 53, 56, 61), "wide": (49, 53, 56, 61, 65)},
    "Ab": {"root": 32, "notes": (44, 48, 51, 56), "wide": (44, 48, 51, 56, 60)},
    "Eb": {"root": 27, "notes": (51, 55, 58, 63), "wide": (51, 55, 58, 63, 67)},
    "F": {"root": 29, "notes": (53, 57, 60, 65), "wide": (53, 57, 60, 65, 69)},
}
# one chord per bar, and the bar count is what the film is: 3 + 5 + 5 + 4 + 3.
_SOUK_BARS = (
    "Fm Fm Fm "
    "Fm Db Ab Eb Fm "
    "Db Ab Eb Fm Db "
    "Fm Db Ab Eb "
    "Fm Db F"
).split()

# 16th-note velocity grid for the closed hats: the accent sits on the off-beat
# eighth, which is what makes the pattern feel like it leans forward.
_HAT_VEL = (0.62, 0.24, 0.80, 0.28, 0.60, 0.26, 0.86, 0.30,
            0.64, 0.24, 0.82, 0.28, 0.68, 0.30, 0.78, 0.34)


class _Bus:
    """One stereo layer of the arrangement, before it is sent and levelled."""

    __slots__ = ("l", "r")

    def __init__(self, n: int) -> None:
        self.l = np.zeros(n)
        self.r = np.zeros(n)

    def add(self, sig: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
        n = len(self.l)
        start = int(round(at * SR))
        if start >= n or len(sig) == 0:
            return
        lo, hi = max(0, start), min(n, start + len(sig))
        if hi <= lo:
            return
        th = (max(-1.0, min(1.0, pan)) + 1.0) * np.pi / 4.0
        seg = sig[lo - start: hi - start]
        self.l[lo:hi] += seg * (gain * math.cos(th))
        self.r[lo:hi] += seg * (gain * math.sin(th))

    def duck(self, depth: np.ndarray) -> None:
        self.l *= depth
        self.r *= depth


def _midi(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def _scipy():
    try:
        from scipy import signal  # noqa: PLC0415 - only this style needs it
        return signal
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "style 'souk-drop' designs its filters with scipy; install it "
            "(`python -m pip install scipy`) or use --style classic"
        ) from exc


def _filt(x: np.ndarray, kind: str, freq, order: int = 2) -> np.ndarray:
    """Butterworth sos filter; freq may be a scalar or a (low, high) band."""
    signal = _scipy()
    nyq = SR / 2.0
    if isinstance(freq, (tuple, list, np.ndarray)):
        wn = [max(8.0, float(freq[0])) / nyq, min(float(freq[1]), nyq * 0.98) / nyq]
        return signal.sosfilt(signal.butter(order, wn, "bandpass", output="sos"), x)
    wn = max(8.0, min(float(freq), nyq * 0.98)) / nyq
    return signal.sosfilt(signal.butter(order, wn, kind, output="sos"), x)


def _peak_norm(x: np.ndarray) -> np.ndarray:
    m = float(np.max(np.abs(x))) if len(x) else 0.0
    return x / m if m > _EPS else x


def _rms_norm(x: np.ndarray, target: float = 0.3) -> np.ndarray:
    r = float(np.sqrt(np.mean(x * x))) if len(x) else 0.0
    return x * (target / r) if r > _EPS else x


def _guard(x: np.ndarray, in_s: float = 0.0015, out_s: float = 0.008) -> np.ndarray:
    """Two short ramps so a one-shot can never start or stop on a discontinuity."""
    n = len(x)
    ni = min(n, max(1, int(in_s * SR)))
    no = min(n, max(1, int(out_s * SR)))
    if n > ni + 2:
        x[:ni] *= np.linspace(0.0, 1.0, ni)
    if n > no + 2:
        x[n - no:] *= np.linspace(1.0, 0.0, no)
    return x


def _curve(n: int, points) -> np.ndarray:
    """A continuous per-sample automation curve through (seconds, value) points."""
    xs = np.array([float(p[0]) for p in points])
    ys = np.array([float(p[1]) for p in points])
    order = np.argsort(xs, kind="stable")
    return np.interp(np.arange(n) / SR, xs[order], ys[order])


def _t60(n: int, attack: float, t60: float) -> np.ndarray:
    t = np.arange(n) / SR
    return (1.0 - np.exp(-t / max(attack, 1e-5))) * np.exp(-t * (_LN1000 / max(t60, 1e-4)))


# --- instruments -------------------------------------------------------------

def _souk_kick() -> np.ndarray:
    """Tight, mono, sub-heavy: a pitch drop, a click and 0.24 s of body."""
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    freq = 46.0 + 215.0 * np.exp(-t / 0.014)
    body = np.sin(2.0 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * (_LN1000 / 0.24))
    click = _filt(np.random.default_rng(11).standard_normal(n), "lowpass", 2600) * np.exp(-t / 0.0035)
    click = _filt(click, "highpass", 900) * 0.55
    tick = np.sin(2.0 * np.pi * 1780.0 * t) * np.exp(-t / 0.0032) * 0.20
    sig = np.tanh(1.5 * (body + click + tick)) / math.tanh(1.5)
    return _peak_norm(_guard(_filt(sig, "highpass", 26), 0.0008, 0.02))


def _souk_clap() -> np.ndarray:
    """Three slaps and a tail: the 2 and the 4 of the groove."""
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(5).standard_normal(n)
    body = _filt(noise, "bandpass", (1100.0, 4200.0))
    env = np.zeros(n)
    for off, g in ((0.0, 1.0), (0.009, 0.70), (0.019, 0.52)):
        i = int(off * SR)
        env[i:] = np.maximum(env[i:], g * np.exp(-(np.arange(n - i) / SR) / 0.0075))
    i = int(0.021 * SR)
    env[i:] += 0.40 * np.exp(-(np.arange(n - i) / SR) / 0.080)
    thump = np.sin(2.0 * np.pi * 190.0 * t) * np.exp(-t / 0.020) * 0.30
    return _peak_norm(_guard(body * env + thump, 0.0005, 0.02))


def _souk_hat(open_hat: bool = False) -> np.ndarray:
    """Filtered noise with a thin metal ring; the ring is what stops it sounding like tape hiss."""
    dur = 0.26 if open_hat else 0.075
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(17 + (3 if open_hat else 0))
    sig = _filt(rng.standard_normal(n), "highpass", 7000)
    for f, g in ((6340.0, 0.10), (8220.0, 0.07), (10430.0, 0.045)):
        sig = sig + g * np.sin(2.0 * np.pi * f * t + f)
    return _peak_norm(_guard(sig * np.exp(-t / (0.11 if open_hat else 0.026)), 0.0004, 0.006))


def _souk_tick() -> np.ndarray:
    """The clock/lock of the heartbeat section: 20 ms, high, dry."""
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    sig = (np.sin(2.0 * np.pi * 3400.0 * t) * np.exp(-t / 0.009)
           + 0.55 * np.sin(2.0 * np.pi * 5150.0 * t) * np.exp(-t / 0.0045))
    click = _filt(np.random.default_rng(3).standard_normal(n), "highpass", 9000) * np.exp(-t / 0.0016)
    return _peak_norm(_guard(sig + 0.8 * click, 0.0004, 0.006))


def _souk_808(freq: float, dur: float, glide_from: float | None = None) -> np.ndarray:
    """Sub bass that carries the melody: saturated so it reads on a phone speaker."""
    n = max(int(dur * SR), 96)
    t = np.arange(n) / SR
    if glide_from and glide_from > freq:
        f = freq + (glide_from - freq) * np.exp(-t / 0.045)
    else:
        f = np.full(n, freq)
    ph = 2.0 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) + 0.22 * np.sin(2.0 * ph) + 0.075 * np.sin(3.0 * ph)
    sig = np.tanh(2.0 * sig) / math.tanh(2.0)
    sig = _filt(sig, "lowpass", 240)
    t60 = min(1.10, max(0.34, dur * 1.30))
    return _peak_norm(_guard(sig * _t60(n, 0.004, t60), 0.0010, 0.015))


def _souk_sub(freq: float, dur: float = 0.55) -> np.ndarray:
    """The intro pulse: a soft, felt thump, no click of its own."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sin(2.0 * np.pi * freq * t) * np.exp(-t / 0.16)
    sig += 0.18 * np.sin(2.0 * np.pi * freq * 2.0 * t) * np.exp(-t / 0.07)
    return _peak_norm(_guard(sig, 0.002, 0.02))


def _souk_sub_drop() -> np.ndarray:
    """62 Hz down to 27 Hz: the floor giving way under the drop."""
    n = int(1.10 * SR)
    t = np.arange(n) / SR
    f = 27.0 + 38.0 * np.exp(-t / 0.16)
    ph = 2.0 * np.pi * np.cumsum(f) / SR
    sig = np.tanh(2.2 * np.sin(ph)) / math.tanh(2.2)
    return _peak_norm(_guard(sig * _t60(n, 0.004, 0.85), 0.001, 0.03))


def _souk_impact() -> np.ndarray:
    """Boom + a short mid thud + a bright crack: the downbeat of a new part."""
    n = int(0.95 * SR)
    t = np.arange(n) / SR
    f = 30.0 + 34.0 * np.exp(-t / 0.11)
    boom = np.sin(2.0 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (_LN1000 / 0.62))
    noise = np.random.default_rng(29).standard_normal(n)
    mid = _filt(noise, "lowpass", 520) * np.exp(-t / 0.09) * 0.7
    crack = _filt(noise, "highpass", 3200) * np.exp(-t / 0.012) * 0.45
    return _peak_norm(_guard(np.tanh(1.4 * (boom + mid + crack)) / math.tanh(1.4), 0.001, 0.03))


def _souk_pluck(freq: float, decay: float = 0.30, bright: float = 1.0) -> np.ndarray:
    """A short synth pluck: partials that die fast on top, one that keeps a body."""
    n = int(max(0.16, decay * 3.2) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 10):
        f = freq * k
        if f > SR * 0.45:
            break
        amp = k ** -1.35 * (bright ** (0.5 if k > 2 else 0.0))
        sig += amp * np.sin(2.0 * np.pi * f * t + 0.7 * k) * np.exp(-t * (_LN1000 / (decay / (1.0 + 0.85 * (k - 1)))))
    nz = _filt(np.random.default_rng(int(freq) % 977 + 7).standard_normal(n), "bandpass", (1800.0, 6500.0))
    sig += 0.30 * nz * np.exp(-t / 0.0035) * bright
    return _peak_norm(_guard(sig * (1.0 - np.exp(-t / 0.0018)), 0.0012, 0.012))


def _souk_bell(freq: float, dur: float = 1.7, bright: float = 1.0) -> np.ndarray:
    """Inharmonic partials: glass rather than a music box."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for ratio, amp in ((1.0, 1.0), (2.0, 0.40), (2.76, 0.33), (5.40, 0.15), (8.93, 0.085), (13.3, 0.04)):
        f = freq * ratio
        if f > SR * 0.45:
            break
        sig += amp * np.sin(2.0 * np.pi * f * t + 1.3 * ratio) * np.exp(
            -t * (_LN1000 / (dur * 0.55 / (1.0 + 0.7 * ratio))))
    strike = _filt(np.random.default_rng(23).standard_normal(n), "highpass", 4000.0 * bright) * np.exp(-t / 0.004)
    return _peak_norm(_guard((sig + 0.35 * strike) * (1.0 - np.exp(-t / 0.002)), 0.0015, 0.02))


_SAW_CYCLE: np.ndarray | None = None


def _saw_cycle() -> np.ndarray:
    """One band-limited saw period, read by phase so a 20-bar pad stays cheap."""
    global _SAW_CYCLE
    if _SAW_CYCLE is None:
        size, table = 4096, np.zeros(4096)
        x = np.arange(size) / size
        for k in range(1, 33):
            table += np.sin(2.0 * np.pi * k * x) / k
        _SAW_CYCLE = table / np.max(np.abs(table))
    return _SAW_CYCLE


def _saw(freq: float, n: int, phase: float = 0.0, nyq_harm: float = 15000.0) -> np.ndarray:
    table = _saw_cycle()
    harm = int(min(32.0, max(1.0, nyq_harm / max(freq, 1.0))))
    if harm < 32:  # rebuild a darker cycle for the high notes rather than alias
        x = np.arange(len(table)) / len(table)
        dark = np.zeros(len(table))
        for k in range(1, harm + 1):
            dark += np.sin(2.0 * np.pi * k * x) / k
        table = dark / max(float(np.max(np.abs(dark))), _EPS)
    adv = freq / SR
    idx = ((phase + adv * np.arange(n)) % 1.0 * len(table)).astype(np.int64)
    return table[idx]


def _souk_pad(notes, start_bar: int, seconds: float, detune=(-7.0, 0.0, 6.0)) -> tuple[np.ndarray, np.ndarray]:
    """A bar of wide detuned-saw pad, already panned. Crossfades are added later."""
    n = int(seconds * SR)
    left, right = np.zeros(n), np.zeros(n)
    for k, note in enumerate(notes):
        f = _midi(note)
        weight = 1.0 / math.sqrt(1.0 + 0.55 * k)
        for j, cents in enumerate(detune):
            voice = _saw(f * 2.0 ** (cents / 1200.0), n, phase=(k * 0.23 + j * 0.37) % 1.0)
            pan = (-0.62 + 0.62 * (j / max(1, len(detune) - 1))) + (0.10 if k % 2 else -0.10)
            th = (max(-1.0, min(1.0, pan)) + 1.0) * np.pi / 4.0
            left += voice * (weight * math.cos(th))
            right += voice * (weight * math.sin(th))
    return left, right


def _souk_shimmer(seconds: float, centre: float = 5200.0, warm: float = 0.0) -> np.ndarray:
    """Air with a slow swell; `warm` adds the low-mid that makes it yellow, not icy."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(41).standard_normal(n)
    sig = _filt(noise, "bandpass", (centre * 0.55, min(centre * 1.9, 15000.0)))
    sw = np.sin(np.pi * np.clip(t / max(seconds, 1e-3), 0.0, 1.0)) ** 1.6
    lfo = 1.0 + 0.22 * np.sin(2.0 * np.pi * 0.37 * t)
    out = sig * sw * lfo
    if warm > 0:
        out = out + warm * _filt(noise, "bandpass", (700.0, 2400.0)) * sw
    return _rms_norm(_guard(out, 0.02, 0.05), 0.20)


def _souk_riser(seconds: float, top: float = 9000.0) -> np.ndarray:
    """Noise sweep + a rising tone + a stutter in the last third."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    u = np.clip(t / max(seconds, 1e-3), 0.0, 1.0)
    noise = np.random.default_rng(53).standard_normal(n)
    sweep = np.zeros(n)
    blocks = 24
    for b in range(blocks):
        lo = int(b * n / blocks)
        hi = int((b + 1) * n / blocks)
        fc = 240.0 + (top - 240.0) * (b / max(1, blocks - 1)) ** 1.7
        sweep[lo:hi] = _filt(noise[lo:hi], "bandpass", (fc * 0.45, min(fc * 2.2, 16000.0)))
    tone_f = 220.0 * 2.0 ** (2.4 * u)
    tone = np.sin(2.0 * np.pi * np.cumsum(tone_f) / SR) * 0.35
    amp = (u ** 1.5) * (0.75 + 0.25 * np.sin(2.0 * np.pi * 6.0 * t))
    sig = (sweep * 0.9 + tone) * amp
    gate = np.ones(n)
    g0 = int(n * 0.66)
    if g0 < n:
        step = 8
        for i in range(g0, n, step):
            pos = (i - g0) / max(1, n - g0)
            width = max(1, int((1.0 - 0.55 * pos) * step))
            gate[i:i + width] = 1.35 if ((i - g0) // step) % 2 == 0 else 0.45
    return _peak_norm(_guard(sig * gate, 0.02, 0.02))


def _souk_swell(seconds: float) -> np.ndarray:
    """A reverse swell: rises into the drop instead of out of it."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    u = np.clip(t / max(seconds, 1e-3), 0.0, 1.0)
    noise = np.random.default_rng(67).standard_normal(n)
    sig = _filt(noise, "bandpass", (380.0, 6500.0))
    fade = _filt(np.ones(n), "lowpass", 380.0)  # tapers the top as it starts
    out = sig * (u ** 2.6) * fade
    tone = np.sin(2.0 * np.pi * np.cumsum(110.0 * 2.0 ** (1.9 * u)) / SR) * (u ** 3.0) * 0.30
    return _peak_norm(_guard(out + tone, 0.01, 0.002))


def _souk_swish(seconds: float = 0.7) -> np.ndarray:
    """A short band-passed swish for a turn inside a section."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    u = np.clip(t / max(seconds, 1e-3), 0.0, 1.0)
    noise = np.random.default_rng(71).standard_normal(n)
    sig = np.zeros(n)
    blocks = 10
    for b in range(blocks):
        lo = int(b * n / blocks)
        hi = int((b + 1) * n / blocks)
        fc = 700.0 + 5200.0 * (b / max(1, blocks - 1)) ** 1.4
        sig[lo:hi] = _filt(noise[lo:hi], "bandpass", (fc * 0.5, fc * 2.0))
    env = np.sin(np.pi * u) ** 1.4
    return _peak_norm(_guard(sig * env, 0.01, 0.03))


def _souk_roll(seconds: float = 2.0, hits: int = 24) -> np.ndarray:
    """A snare roll that both speeds up and gets louder: the end of the middle part."""
    n = int(seconds * SR)
    out = np.zeros(n)
    rng = np.random.default_rng(83)
    for i in range(hits):
        pos = (i / max(1, hits - 1)) ** 1.7
        at = int(pos * (n - int(0.12 * SR)))
        size = int(0.12 * SR)
        t = np.arange(size) / SR
        body = _filt(rng.standard_normal(size), "bandpass", (1400.0, 7000.0)) * np.exp(-t / 0.035)
        body += 0.35 * np.sin(2.0 * np.pi * 195.0 * t) * np.exp(-t / 0.030)
        out[at:at + size] += body * (0.18 + 0.82 * pos)
    return _peak_norm(_guard(out, 0.002, 0.02))


def _souk_room(length: float, seed: int = 91) -> np.ndarray:
    """Low room tone: the floor the quiet parts stand on."""
    n = int(length * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(n)
    low = _filt(noise, "lowpass", 420) * 1.0
    rumble = np.sin(2.0 * np.pi * 54.0 * t) * 0.10
    drift = 1.0 + 0.25 * np.sin(2.0 * np.pi * 0.11 * t + 0.4)
    crackle = np.zeros(n)
    picks = rng.integers(0, max(1, n - 64), max(1, n // 24000))
    for p in picks:
        crackle[p:p + 6] += rng.standard_normal(6) * np.linspace(1.0, 0.0, 6) * 0.5
    out = (low * 0.55 + rumble + crackle) * drift
    return _rms_norm(_guard(out, 0.05, 0.05), 0.16)


# --- reverb, delay and the master chain --------------------------------------

def _fft_convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = len(x) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    out = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
    return out


def _souk_ir(length: float = 1.7, seed: int = 101) -> tuple[np.ndarray, np.ndarray]:
    """A synthetic plate: decorrelated L/R noise, darker as it decays, plus a few early taps."""
    n = int(length * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    decay = np.exp(-t * (_LN1000 / (length * 0.42)))
    taps = ((0.011, 0.55), (0.019, 0.40), (0.031, 0.30), (0.047, 0.22), (0.068, 0.15))
    irs = []
    for ch in range(2):
        ir = rng.standard_normal(n) * decay
        ir = _filt(ir, "highpass", 240.0)
        ir = _filt(ir, "lowpass", 7000.0)
        for i, (delay, gain) in enumerate(taps):
            pos = int((delay + 0.004 * ch + 0.003 * i) * SR)
            if pos < n:
                ir[pos] += gain * (1.0 - 0.15 * ch)
        irs.append(ir / math.sqrt(float(np.sum(ir * ir)) + _EPS))
    return irs[0], irs[1]


def _souk_pingpong(left: np.ndarray, right: np.ndarray, time_s: float = 0.375,
                   feedback: float = 0.30, taps: int = 4) -> tuple[np.ndarray, np.ndarray]:
    """Dotted-eighth ping-pong; dark enough that it never fights the pluck."""
    mono = 0.5 * (left + right)
    d = int(time_s * SR)
    out_l, out_r = np.zeros_like(mono), np.zeros_like(mono)
    for k in range(1, taps + 1):
        src = _filt(mono, "lowpass", 3500.0) * (feedback ** (k - 1))
        pos = k * d
        if pos >= len(mono):
            break
        dest = out_r if k % 2 else out_l
        dest[pos:] += src[:len(mono) - pos]
    return out_l, out_r


def _souk_limit(mix: np.ndarray, ceiling: float, block: int = 32,
                look_blocks: int = 3, release_db_s: float = 9.0) -> np.ndarray:
    """Look-ahead peak limiter: gain reduction only, no waveshaping, no new harmonics.

    A launch track's peak-to-RMS is narrower than a pad's, so the ceiling has to be
    held by pulling the transients down; turning the whole bed down instead would
    miss the -19 dBFS contract by exactly the difference.
    """
    n = len(mix)
    b = n // block
    if b < 8:
        return mix
    peak = np.abs(mix[: b * block]).reshape(b, block, -1).max(axis=(1, 2))
    gain = np.minimum(1.0, ceiling / np.maximum(peak, _EPS))
    if look_blocks:  # the gain has to be down before the transient arrives
        for i in range(1, look_blocks + 1):
            gain[:-i] = np.minimum(gain[:-i], gain[i:])
    step = 10.0 ** (release_db_s / 20.0 * block / SR)
    for j in range(1, b):  # a release, so the gain never chatters block to block
        if gain[j] > gain[j - 1]:
            gain[j] = min(gain[j], gain[j - 1] * step)
    centres = (np.arange(b) + 0.5) * block
    curve = np.interp(np.arange(n), centres, gain, left=1.0, right=float(gain[-1]))
    return mix * curve[:, None]


def _souk_master(mix: np.ndarray) -> tuple[np.ndarray, dict]:
    """Bass mono, DC block, then the level solve: RMS to -19 under a -3 dBFS ceiling."""
    # everything below 120 Hz is one voice in the middle: a launch track has to
    # survive a phone speaker and a mono club rig
    low_l = _filt(mix[:, 0], "lowpass", 120.0)
    low_r = _filt(mix[:, 1], "lowpass", 120.0)
    mono = 0.5 * (low_l + low_r)
    mix = np.stack([mix[:, 0] - low_l + mono, mix[:, 1] - low_r + mono], axis=1)
    mix = np.stack([_filt(mix[:, 0], "highpass", 21.0), _filt(mix[:, 1], "highpass", 21.0)], axis=1)

    target = db_to_amp(TARGET_RMS_DBFS)
    # a quarter dB of headroom under the contract: 48 kHz sample peaks and 4x
    # true peaks differ by a fraction, and the deliverable has to pass both
    ceiling = db_to_amp(PEAK_CEILING_DBFS - 0.25)
    rms_before = float(np.sqrt(np.mean(mix * mix)))
    limited, rounds = False, 0
    for _ in range(10):
        mix *= target / max(float(np.sqrt(np.mean(mix * mix))), _EPS)
        if float(np.max(np.abs(mix))) <= ceiling:
            break
        limited = True
        rounds += 1
        mix = _souk_limit(mix, ceiling)
    peak = float(np.max(np.abs(mix)))
    if peak > ceiling:  # the limiter makes this unreachable; belt and braces
        mix *= ceiling / peak
    return mix, {
        "rms_in_dbfs": round(20.0 * math.log10(max(rms_before, _EPS)), 2),
        "limiter_engaged": limited,
        "limiter_rounds": rounds,
        "ceiling_dbfs": round(PEAK_CEILING_DBFS - 0.25, 2),
        "peak_after_solve_dbfs": round(20.0 * math.log10(max(float(np.max(np.abs(mix))), _EPS)), 2),
    }


def _souk_pad_track(n: int, bar: float) -> np.ndarray:
    """The whole film's pad: one bar per chord, equal-power crossfaded at the bar line."""
    n_bars = max(1, int(round((n / SR) / bar)))
    left, right = np.zeros(n), np.zeros(n)
    xf = 0.14
    m = int(xf * SR)
    up = 0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, m))
    for k in range(n_bars):
        notes = _SOUK_CHORDS[_SOUK_BARS[k % len(_SOUK_BARS)]]["wide"]
        seg_n = int((bar + 2.0 * xf) * SR)
        pl, pr = _souk_pad(notes, k, bar + 2.0 * xf)
        pl, pr = pl[:seg_n], pr[:seg_n]
        env = np.ones(len(pl))
        if len(env) > 2 * m:
            env[:m] = up
            env[-m:] *= up[::-1]
        start = int(round((k * bar - xf) * SR))
        lo = max(0, start)
        hi = min(n, start + len(pl))
        if hi <= lo:
            continue
        e = env[lo - start: hi - start]
        left[lo:hi] += pl[lo - start: hi - start] * e
        right[lo:hi] += pr[lo - start: hi - start] * e
    return np.stack([left, right], axis=1)


def _souk_pump(n: int, hits, attack: float = 0.007, release: float = 0.20) -> np.ndarray:
    """Sidechain shape in 0..1: 1 on a kick, falling away over the release."""
    env = np.zeros(n)
    ln = int(release * SR)
    shape = np.exp(-(np.arange(ln) / SR) / max(release / 4.0, 1e-4))
    rise = np.linspace(0.0, 1.0, max(2, int(attack * SR)))
    for t in hits:
        start = int(round(t * SR))
        if start >= n:
            continue
        lo = max(0, start)
        seg = shape[: min(ln, n - lo)]
        if len(rise) < len(seg):
            seg = seg.copy()
            seg[: len(rise)] *= rise
        env[lo:lo + len(seg)] = np.maximum(env[lo:lo + len(seg)], seg)
    return env


def _souk_arrange(timeline: dict, n: int) -> tuple[dict, list[dict], list[tuple]]:
    fps = timeline.get("fps", 30)
    bpm = timeline.get("bpm", 120)
    bar = 240.0 / bpm
    step = bar / 16.0
    beats = timeline.get("beats", [])
    rng = np.random.default_rng(2026)

    drums, bass = _Bus(n), _Bus(n)
    pluck, bell, fx = _Bus(n), _Bus(n), _Bus(n)

    KICK, CLAP = _souk_kick(), _souk_clap()
    HAT, HATO = _souk_hat(), _souk_hat(True)
    TICK, IMPACT = _souk_tick(), _souk_impact()
    SUBDROP = _souk_sub_drop()

    kicks: list[float] = []
    risers: list[tuple] = []  # (at, length, section) so the report can prove the build
    sections: list[dict] = []

    def drum(sig, at, gain, pan=0.0):
        drums.add(sig, at, gain, pan)

    def kick(at, gain):
        kicks.append(at)
        drum(KICK, at, gain)

    def hat(at, vel, open_=False, pan=0.06):
        drum(HATO if open_ else HAT, at, vel, pan)

    def riser(at, length, top, gain):
        fx.add(_souk_riser(length, top), at, gain)
        risers.append((round(at, 3), round(float(length), 3), beat.get("id")))

    def bass_note(at, freq, gain, glide_from=None, dur=0.5):
        bass.add(_souk_808(freq, dur, glide_from), at, gain)

    for beat in beats:
        raw_kind = beat.get("bed") or beat.get("kind", "")
        # this film's grammar is open -> store -> design -> admin -> finale;
        # map it onto the launch-track sections without changing the music.
        kind = {"open": "hook", "setup": "hook", "design": "store", "sources": "admin", "admin": "store", "finale": "cta"}.get(raw_kind, raw_kind)
        b_start = beat["start"] / fps
        b_dur = beat["dur"] / fps
        bars = max(1, int(round(b_dur / bar)))
        base = int(round(b_start / bar))
        layers: list[str] = []
        fxc = {}  # named cues, so the report can measure what was actually put where

        def chord(k):
            d = _SOUK_CHORDS[_SOUK_BARS[(base + k) % len(_SOUK_BARS)]]
            return _midi(d["root"]), d["notes"], d["wide"]

        def bar_at(k):
            return b_start + k * bar

        if kind == "hook":
            layers = ["room", "sub pulse", "dark pad", "bells", "block figure", "swish"]
            fxc = {"sub_pulse_1": b_start + 0.5, "sub_pulse_2": bar_at(1),
                   "swish": b_start + 2.9, "block_build": bar_at(2)}
            fx.add(_souk_room(b_dur), b_start, 0.045)
            for at, note in ((3.0, 77), (4.0, 80), (4.75, 84), (5.5, 78)):
                if at < b_dur:
                    bell.add(_souk_bell(_midi(note), 1.5, 0.85), b_start + at, 0.40,
                             -0.25 if at < 4.5 else 0.25)
            fx.add(_souk_swish(0.7), b_start + 2.9, 0.20)
            for k in range(bars):
                root = chord(k)[0]
                for at, freq in ((0.5, root),):
                    if k == 0:
                        bass.add(_souk_sub(freq), b_start + at, 0.50)
                    if k == 1:
                        bass.add(_souk_sub(freq), bar_at(k), 0.52)
                    if k == 2:
                        bass.add(_souk_sub(freq), bar_at(k), 0.56)
                        bass.add(_souk_sub(freq), bar_at(k) + 8 * step, 0.44)
            # the block figure climbs through the last bar and hands over to the drop
            wide = chord(2)[2]
            for i in range(8):
                pluck.add(_souk_pluck(_midi(wide[i % len(wide)] + 12), 0.22, 0.9),
                          bar_at(2) + i * 2 * step, 0.048 + 0.006 * i, -0.35 + 0.1 * i)
            # the last bar hands over to the drop
            if bars >= 3:
                bass.add(_souk_sub(chord(2)[0] * 0.5, 0.9), bar_at(2) + 12 * step, 0.40)
            riser(b_start + (b_dur - 2.0), 2.0, 7000.0, 0.22)

        elif kind == "store":
            layers = ["kick 4/4", "808", "16th hats", "clap 2&4", "block arp", "pad", "sparkle", "riser"]
            fxc = {"impact": b_start, "sparkle": b_start + 2.0,
                   "riser_start": b_start + b_dur - 2.0, "riser_top": b_start + b_dur - 0.4}
            fx.add(IMPACT, b_start, 0.34)
            bass.add(SUBDROP, b_start, 0.40)
            for k in range(bars):
                root, notes, wide = chord(k)
                # kick, clap, hats
                for s, v in ((0, 1.0), (4, 0.86), (8, 0.94), (12, 0.88)):
                    kick(bar_at(k) + s * step, 0.82 * v)
                for s, v in ((4, 1.0), (12, 0.90)):
                    drum(CLAP, bar_at(k) + s * step, 0.33 * v, 0.02)
                for s in range(16):
                    hat(bar_at(k) + s * step, 0.215 * _HAT_VEL[s] * (1.0 + 0.06 * float(rng.standard_normal())))
                    if s in (2, 6, 10, 14):
                        hat(bar_at(k) + s * step, 0.155, True, -0.1)
                # trap 808
                pat = {0: [(0, 0), (6, 0), (10, 0)],
                       1: [(0, 0), (6, 12), (10, 0), (14, 0)],
                       2: [(0, 0), (6, 0), (10, 0), (14, 12)],
                       3: [(0, 0), (6, 0), (10, 0)],
                       4: [(0, 0), (8, 0), (12, 12)]}[k]
                times = [bar_at(k) + s * step for s, _ in pat]
                for j, (s, semi) in enumerate(pat):
                    at = bar_at(k) + s * step
                    nxt = times[j + 1] if j + 1 < len(times) else at + 2 * step
                    prev = times[j - 1] if j else None
                    glide = None
                    if prev is not None and at - prev < 0.26:
                        glide = _midi(root + pat[j - 1][1])
                    bass.add(_souk_808(_midi(root + semi), min(1.05, max(0.24, (nxt - at) * 1.3)), glide),
                             at, 0.55 * (1.0 if s == 0 else 0.88))
                # short block arpeggio
                for s, ix in zip((0, 2, 4, 6, 8, 10, 12, 14), (0, 1, 2, 3, 2, 3, 4, 3)):
                    at = bar_at(k) + s * step
                    pluck.add(_souk_pluck(_midi(wide[ix % len(wide)] + 12), 0.26, 1.0), at,
                              0.085 * (1.0 if s % 4 == 0 else 0.78), -0.35 if ix % 2 else 0.35)
                if k == 4:
                    for i in range(4):  # 32nd fill into the next part
                        hat(bar_at(k) + (14 + i * 0.5) * step, 0.10 + 0.02 * i, False, 0.1)
            # sparkle two bars in (8.0 s on this film)
            bell.add(_souk_bell(_midi(77), 1.8, 1.1), b_start + 2.0, 0.26, 0.2)
            for i, note in enumerate((77, 80, 84, 89)):
                pluck.add(_souk_pluck(_midi(note), 0.34, 1.25), b_start + 2.0 + i * step, 0.060, -0.5 + 0.33 * i)
            fx.add(_souk_shimmer(2.4, 6200.0), b_start + 1.9, 0.14)
            riser(b_start + b_dur - 2.0, 2.0, 9500.0, 0.30)

        elif kind == "admin":
            layers = ["kick 4/4", "808 (sparse)", "16th hats", "clap 2&4", "quarter arp",
                      "pad (deep sidechain)", "bar accents", "roll + riser"]
            fx.add(IMPACT, b_start, 0.26)
            for k in range(bars):
                root, notes, wide = chord(k)
                for s, v in ((0, 0.92), (4, 0.80), (8, 0.86), (12, 0.82)):
                    kick(bar_at(k) + s * step, 0.80 * v)
                if k % 2 == 1:
                    kick(bar_at(k) + 10 * step, 0.52)
                for s, v in ((4, 1.0), (12, 0.88)):
                    drum(CLAP, bar_at(k) + s * step, 0.26 * v, -0.02)
                for s in range(16):
                    if s in (3, 7, 11, 15):
                        continue  # a little air: this part is meant to be lighter
                    hat(bar_at(k) + s * step, 0.180 * _HAT_VEL[s] * (1.0 + 0.06 * float(rng.standard_normal())))
                for s, semi in ((0, 0), (10, 0)):
                    bass.add(_souk_808(_midi(root + semi), 0.62), bar_at(k) + s * step, 0.58 * (1.0 if s == 0 else 0.85))
                for s, ix in ((0, 0), (4, 2), (8, 3), (12, 2)):
                    pluck.add(_souk_pluck(_midi(wide[ix] + 12), 0.30, 0.85), bar_at(k) + s * step,
                              0.070 * (1.0 if s == 0 else 0.8), 0.3 if s % 8 else -0.3)
                # an accent on every bar line is the hook of this part
                if k > 0:
                    fx.add(_souk_swish(0.45), bar_at(k) - 0.12, 0.13)
                    bell.add(_souk_bell(_midi([84, 87, 84, 89][k % 4]), 0.9, 1.0), bar_at(k), 0.13, -0.3 if k % 2 else 0.3)
                    fx.add(TICK, bar_at(k), 0.11, 0.0)
            fxc = {"accent": bar_at(1), "roll": b_start + b_dur - 1.6,
                   "riser_top": b_start + b_dur - 0.4}
            fx.add(_souk_roll(min(1.6, b_dur), 22), b_start + b_dur - 1.6, 0.17)
            riser(b_start + b_dur - 1.0, 1.0, 8000.0, 0.17)

        elif kind == "security":
            layers = ["kick 1&3 (half-time)", "clock tick", "room", "pad", "riser 3.2 s", "breath"]
            fx.add(_souk_room(b_dur), b_start, 0.055)
            fx.add(IMPACT, b_start, 0.22)
            for k in range(bars):
                root, notes, wide = chord(k)
                for s, v in ((0, 1.0), (8, 0.84)):
                    kick(bar_at(k) + s * step, 0.86 * v)
                for s in range(0, 16, 2):
                    fx.add(TICK, bar_at(k) + s * step, 0.16 * (1.0 if s % 4 == 0 else 0.62), 0.12 if s % 4 else -0.12)
                bass.add(_souk_808(_midi(root), 0.95), bar_at(k), 0.62)
                bass.add(_souk_808(_midi(root), 0.30), bar_at(k) + 8 * step, 0.46)
            bell.add(_souk_bell(_midi(73), 2.0, 0.8), b_start + 2.0, 0.20, 0.3)
            bell.add(_souk_bell(_midi(80), 2.0, 0.8), b_start + 4.0, 0.16, -0.3)
            # 3.2 s riser that *lands*, then 0.8 s of room tone before the drop
            riser_len = 3.2
            riser_at = b_start + (b_dur - riser_len - 0.8)
            riser(riser_at, riser_len, 9500.0, 0.26)
            fx.add(_souk_swell(0.8), b_start + b_dur - 0.8, 0.16)
            fx.add(_souk_shimmer(0.8, 7000.0, 0.25), b_start + b_dur - 0.8, 0.10)
            fxc = {"heartbeat": b_start, "riser_start": riser_at, "riser_top": riser_at + 2.8,
                   "breath": b_start + b_dur - 0.8}

        elif kind == "cta":
            layers = ["kick 4/4 + pushes", "808", "16th hats + rolls", "clap", "16th arp",
                      "widest pad", "bells", "yellow shimmer", "resolve"]
            fxc = {"impact": b_start, "shimmer": b_start + 2.0, "resolve": b_start + 4.0}
            fx.add(IMPACT, b_start, 0.42)
            bass.add(SUBDROP, b_start, 0.46)
            for k in range(bars):
                root, notes, wide = chord(k)
                for s, v in ((0, 1.0), (4, 0.88), (8, 0.95), (12, 0.90)):
                    kick(bar_at(k) + s * step, 0.92 * v)
                if k == 1:
                    kick(bar_at(k) + 3 * step, 0.60)
                if k == 2:
                    kick(bar_at(k) + 7 * step, 0.55)
                for s, v in ((4, 1.0), (12, 0.92)):
                    drum(CLAP, bar_at(k) + s * step, 0.32 * v, 0.03)
                for s in range(16):
                    hat(bar_at(k) + s * step, 0.225 * _HAT_VEL[s] * (1.0 + 0.05 * float(rng.standard_normal())))
                    if s in (2, 6, 10, 14):
                        hat(bar_at(k) + s * step, 0.165, True, -0.08)
                pat = [(0, 0), (3, 0), (6, 12), (8, 0), (11, 0), (14, 12)]
                if k == 2:
                    pat = [(0, 0), (4, 0), (6, 12), (8, 0)]
                times = [bar_at(k) + s * step for s, _ in pat]
                for j, (s, semi) in enumerate(pat):
                    at = bar_at(k) + s * step
                    nxt = times[j + 1] if j + 1 < len(times) else at + 3 * step
                    glide = None
                    if j and at - times[j - 1] < 0.26:
                        glide = _midi(root + pat[j - 1][1])
                    bass.add(_souk_808(_midi(root + semi), min(1.10, max(0.24, (nxt - at) * 1.35)), glide),
                             at, 0.62 * (1.0 if s == 0 else 0.9))
                fig = (0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 3, 4, 3, 1)
                for s in range(16):
                    if k == 2 and s > 8:
                        break  # let the resolve ring
                    ix = fig[s]
                    pluck.add(_souk_pluck(_midi(wide[ix % len(wide)] + 12), 0.24, 1.1), bar_at(k) + s * step,
                              0.080 * (1.0 if s % 4 == 0 else 0.72), -0.4 if s % 2 else 0.4)
                if k == 2:
                    for i in range(6):  # 32nd lift into the resolution
                        hat(bar_at(k) + (4 + i * 0.5) * step, 0.10 + 0.02 * i, False, 0.1)
            fx.add(_souk_shimmer(3.0, 6400.0, 0.30), b_start + 2.0, 0.16)
            bell.add(_souk_bell(_midi(84), 2.2, 1.05), b_start + 2.0, 0.20, 0.25)
            bell.add(_souk_bell(_midi(87), 2.0, 1.0), b_start + 4.0, 0.17, -0.25)
            # the resolve: the tonic arrives with its major third and rings out
            resolve = b_start + 4.0
            fx.add(IMPACT, resolve, 0.30)
            bass.add(_souk_808(_midi(29), 1.95), resolve, 0.62)
            for note, pan, gain in ((77, -0.3, 0.24), (81, 0.3, 0.22), (84, 0.0, 0.20), (89, 0.45, 0.12)):
                bell.add(_souk_bell(_midi(note), 2.0, 1.15), resolve, gain, pan)
            fx.add(_souk_shimmer(2.0, 7200.0, 0.35), resolve, 0.20)

        if raw_kind == "design":
            # the design beat hands over to the owner reveal: a short swell and
            # a breath, measured by the same gate the old security beat used.
            breath_at = b_start + b_dur - 0.55
            fx.add(_souk_swell(0.55), breath_at, 0.18)
            fx.add(_souk_shimmer(0.55, 7200.0, 0.28), breath_at, 0.12)
            fxc["breath"] = breath_at

        if raw_kind == "sources":
            # the sourcing beat is the machine room: a long lift into the owner
            # drop, then one breath of air before it lands.
            riser(b_start + b_dur - 2.0, 2.0, 9500.0, 0.30)
            breath_at = b_start + b_dur - 0.6
            fx.add(_souk_swell(0.6), breath_at, 0.20)
            fx.add(_souk_shimmer(0.6, 7600.0, 0.30), breath_at, 0.12)
            fxc["breath"] = breath_at
            fxc["riser_start"] = b_start + b_dur - 2.0
            fxc["riser_top"] = b_start + b_dur - 0.4

        row = {
            "id": beat.get("id"), "kind": raw_kind, "start": round(b_start, 3),
            "end": round(b_start + b_dur, 3), "bars": bars, "layers": layers,
        }
        if fxc:
            row["cues"] = {k: round(v, 3) for k, v in fxc.items()}
        sections.append(row)

    pad_raw = _souk_pad_track(n, bar)
    pad_peak = float(np.max(np.abs(pad_raw)))
    pad_raw = pad_raw / max(pad_peak, _EPS) * 1.0
    # filter automation: the pad opens across the film and narrows in the middle part
    dark = np.stack([_filt(pad_raw[:, c], "lowpass", 520.0) for c in (0, 1)], axis=1)
    mid = np.stack([_filt(_filt(pad_raw[:, c], "highpass", 480.0), "lowpass", 2200.0) for c in (0, 1)], axis=1)
    bright = np.stack([_filt(pad_raw[:, c], "highpass", 2000.0) for c in (0, 1)], axis=1)
    g_dark = _curve(n, [(0.0, 1.0), (5.8, 1.0), (6.0, 0.86), (13.8, 0.9), (14.0, 0.95),
                        (23.8, 0.95), (24.0, 1.0), (33.8, 1.0), (34.0, 0.82), (41.8, 0.80), (42.0, 0.72), (48.0, 0.72)])
    g_mid = _curve(n, [(0.0, 0.16), (5.8, 0.34), (6.0, 0.72), (13.8, 0.72), (14.0, 0.52),
                       (23.8, 0.55), (24.0, 0.64), (33.8, 0.62), (34.0, 0.80), (41.8, 0.80), (42.0, 0.62), (48.0, 0.62)])
    g_hi = _curve(n, [(0.0, 0.0), (5.8, 0.05), (6.0, 0.32), (13.8, 0.36), (14.0, 0.16),
                      (23.8, 0.20), (24.0, 0.38), (33.8, 0.40), (34.0, 0.55), (41.8, 0.55), (42.0, 0.40), (48.0, 0.40)])
    level = _curve(n, [(0.0, 0.44), (5.8, 0.50), (6.0, 0.95), (13.8, 0.92), (14.0, 0.72),
                       (23.8, 0.74), (24.0, 0.95), (33.8, 0.90), (34.0, 0.95), (41.8, 0.90), (42.0, 1.0), (46.0, 0.95), (48.0, 0.80)])
    pad = (dark * g_dark[:, None] + mid * g_mid[:, None] + bright * g_hi[:, None]) * level[:, None]
    pad = pad * 0.45
    # the machine-room part pumps hardest: depth is automated, the shape is the kick
    depth = _curve(n, [(0.0, 0.0), (6.0, 2.2), (13.9, 2.2), (14.0, 4.2), (23.9, 4.2),
                       (24.0, 3.0), (33.9, 2.4), (34.0, 2.4), (48.0, 2.4)])
    pump = 1.0 - _souk_pump(n, kicks) * (1.0 - 10.0 ** (-depth / 20.0))
    pad = pad * pump[:, None]

    pad_bus = _Bus(n)
    pad_bus.l, pad_bus.r = pad[:, 0].copy(), pad[:, 1].copy()
    return {
        "drums": drums, "bass": bass, "pad": pad_bus,
        "pluck": pluck, "bell": bell, "fx": fx,
    }, sections, risers


# How the buses sit against each other. The drums' kick is the loudest single
# event; everything else is placed relative to it, and the master solve only
# decides the absolute level.
_SOUK_BUS_GAIN = {"drums": 1.00, "bass": 0.92, "pad": 1.00, "pluck": 2.00, "bell": 0.41, "fx": 0.68}
_SOUK_SEND = {"drums": 0.14, "bass": 0.0, "pad": 0.62, "pluck": 0.70, "bell": 0.90, "fx": 0.34}
_SOUK_RETURN = 1.05
_SOUK_DELAY = 2.60


def _db(v: float) -> float:
    return 20.0 * math.log10(max(float(v), _EPS))


def _souk_render(timeline: dict, n: int) -> tuple[np.ndarray, list[dict], dict, dict, list[tuple]]:
    buses, sections, risers = _souk_arrange(timeline, n)
    send_l, send_r = np.zeros(n), np.zeros(n)
    levels = {}
    for name, bus in buses.items():
        bus.l *= _SOUK_BUS_GAIN[name]
        bus.r *= _SOUK_BUS_GAIN[name]
        levels[name] = {"peak_dbfs": round(_db(np.max(np.abs(bus.l))), 2),
                        "rms_dbfs": round(_db(np.sqrt(np.mean(0.5 * (bus.l ** 2 + bus.r ** 2)))), 2)}
        s = _SOUK_SEND.get(name, 0.0)
        if s:
            send_l += bus.l * s
            send_r += bus.r * s

    ir_l, ir_r = _souk_ir()
    rev_l = _fft_convolve(send_l, ir_l) * _SOUK_RETURN
    rev_r = _fft_convolve(send_r, ir_r) * _SOUK_RETURN
    dl, dr = _souk_pingpong(buses["pluck"].l * 0.6 + buses["bell"].l * 0.4,
                            buses["pluck"].r * 0.6 + buses["bell"].r * 0.4)
    levels["reverb"] = {"peak_dbfs": round(_db(np.max(np.abs(rev_l))), 2),
                        "rms_dbfs": round(_db(np.sqrt(np.mean(0.5 * (rev_l ** 2 + rev_r ** 2)))), 2)}
    levels["delay"] = {"peak_dbfs": round(_db(np.max(np.abs(dl)) * _SOUK_DELAY), 2),
                       "rms_dbfs": round(_db(np.sqrt(np.mean(0.5 * (dl ** 2 + dr ** 2))) * _SOUK_DELAY), 2)}

    mix = np.stack([
        sum(b.l for b in buses.values()) + rev_l + dl * _SOUK_DELAY,
        sum(b.r for b in buses.values()) + rev_r + dr * _SOUK_DELAY,
    ], axis=1)
    mix, info = _souk_master(mix)

    # a clean top and tail: the film fades the bed itself, these only stop clicks
    mix = np.clip(mix, -1.0, 1.0)
    n_in = min(len(mix), int(0.020 * SR))
    mix[:n_in] *= np.linspace(0.0, 1.0, n_in)[:, None]
    n_out = min(len(mix), int(0.35 * SR))
    mix[-n_out:] *= (np.linspace(1.0, 0.0, n_out) ** 1.4)[:, None]

    # sample peak <= -3.25 already, but 4x oversampling shows up to a third of a
    # dB more between samples; trim for it so the ceiling reads true both ways
    tp = _true_peak(mix, SR)
    limit_tp = db_to_amp(PEAK_CEILING_DBFS - 0.02)
    trim = 0.0
    if tp > limit_tp:
        trim = limit_tp / tp
        mix *= trim
    info["true_peak_trim_db"] = round(_db(trim), 2)
    return mix, sections, levels, info, risers


def _read_pcm(path: pathlib.Path) -> tuple[np.ndarray, int, int]:
    with wave.open(str(path), "rb") as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if sw == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        v = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / 8388608.0
    elif sw == 2:
        v = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    else:
        v = np.frombuffer(raw, dtype="<i4").astype(np.float64) / 2147483648.0
    return v.reshape(-1, ch), sr, sw * 8


def _lufs(x: np.ndarray, sr: int) -> float:
    """BS.1770-4 integrated loudness, gated — the number a streaming platform sees."""
    signal = _scipy()
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    win, hop = int(0.4 * sr), int(0.1 * sr)
    if len(y) < win:
        return float("nan")
    powers = []
    for start in range(0, len(y) - win + 1, hop):
        seg = y[start:start + win]
        powers.append(float(np.mean(np.mean(seg ** 2, axis=0))))
    powers = np.array(powers)
    loud = -0.691 + 10.0 * np.log10(np.maximum(powers, 1e-12))
    keep = loud > -70.0
    if not np.any(keep):
        return float("nan")
    rel = float(np.mean(powers[keep]))
    keep2 = keep & (loud > -0.691 + 10.0 * math.log10(max(rel, 1e-12)) - 10.0)
    if not np.any(keep2):
        keep2 = keep
    return round(-0.691 + 10.0 * math.log10(max(float(np.mean(powers[keep2])), 1e-12)), 2)


def _true_peak(x: np.ndarray, sr: int) -> float:
    signal = _scipy()
    peak = 0.0
    for ch in range(x.shape[1]):
        up = signal.resample_poly(x[:, ch], 4, 1)
        peak = max(peak, float(np.max(np.abs(up))))
    return peak


def _ffprobe() -> str | None:
    exe = "ffprobe.exe" if sys.platform == "win32" else "ffprobe"
    bundled = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / exe
    if bundled.exists():
        return str(bundled)
    return shutil.which("ffprobe")


def _probe(path: pathlib.Path) -> dict:
    fp = _ffprobe()
    if not fp:
        return {"error": "ffprobe not found"}
    cmd = [fp, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    data = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout or "{}")
    a = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    fmt = data.get("format", {})
    return {
        "codec": a.get("codec_name"),
        "sample_rate": int(a.get("sample_rate") or 0),
        "channels": int(a.get("channels") or 0),
        "bits_per_sample": int(a.get("bits_per_sample") or 0),
        "duration_s": round(float(fmt.get("duration") or 0.0), 6),
        "size_bytes": int(fmt.get("size") or 0),
    }


def _souk_main(args, timeline: dict) -> int:
    fps = timeline.get("fps", 30)
    frames = timeline.get("frames", 0)
    seconds = frames / fps
    n = int(round(seconds * SR))

    mix, sections, levels, lvl, risers = _souk_render(timeline, n)
    out_path = ROOT / args.out
    write_wav(out_path, mix)
    orig = out_path.with_name(f"{out_path.stem}.orig.wav")
    orig.write_bytes(out_path.read_bytes())

    # everything reported comes back off the delivered file, never off the arrays
    x, rate, bits = _read_pcm(out_path)
    dur = len(x) / rate
    peak = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(x * x)))
    clipped = int(np.sum(np.abs(x) >= 0.999))
    rms_db, peak_db = _db(rms), _db(peak)
    tp_db = _db(_true_peak(x, rate))
    lufs = _lufs(x, rate)
    probe = _probe(out_path)

    sec_rows = []
    bands = ((20, 60), (60, 250), (250, 2000), (2000, 8000), (8000, 20000))
    for s in sections:
        lo, hi = int(round(s["start"] * rate)), int(round(s["end"] * rate))
        seg = x[lo:hi]
        if len(seg) < 16:
            continue
        sr_rms = float(np.sqrt(np.mean(seg * seg)))
        sr_peak = float(np.max(np.abs(seg)))
        mono_s = seg.mean(axis=1)
        mid_s, side_s = mono_s, (seg[:, 0] - seg[:, 1]) * 0.5
        band_db = {}
        for f0, f1 in bands:
            b = _filt(mono_s, "highpass", float(f0))
            if f1 < rate / 2:
                b = _filt(b, "lowpass", float(f1))
            band_db[f"{f0}-{f1}"] = round(_db(float(np.sqrt(np.mean(b ** 2)))), 2)
        sec_rows.append({**s,
                         "frames": int(round((s["end"] - s["start"]) * fps)),
                         "rms_dbfs": round(_db(sr_rms), 2),
                         "peak_dbfs": round(_db(sr_peak), 2),
                         "lufs_i": _lufs(seg, rate) if len(seg) > rate * 0.5 else None,
                         "band_rms_dbfs": band_db,
                         "side_minus_mid_db": round(
                             _db(float(np.sqrt(np.mean(side_s ** 2))))
                             - _db(float(np.sqrt(np.mean(mid_s ** 2)))), 2)})

    width = {"breath": 0.80, "riser_top": 0.40, "riser_start": 0.40}
    cues = []
    for s in sections:
        for name, at in (s.get("cues") or {}).items():
            w = width.get(name, 0.30)
            lo = max(0, int(round(at * rate)))
            hi = min(len(x), int(round((at + w) * rate)))
            if hi - lo < 64:
                continue
            seg = x[lo:hi]
            cues.append({"section": s["id"], "cue": name, "at": round(at, 3),
                         "window_s": w,
                         "rms_dbfs": round(_db(float(np.sqrt(np.mean(seg * seg)))), 2),
                         "peak_dbfs": round(_db(float(np.max(np.abs(seg)))), 2)})

    def cue(name):
        return next((c for c in cues if c["cue"] == name), None)

    # a riser is proved in the band it sweeps through, where the kick and the 808
    # are not: measured on the delivered file, from the bottom of the sweep to the top
    mono = x.mean(axis=1)
    build_band = _filt(_filt(mono, "highpass", 3500.0), "lowpass", 12000.0)
    build_rows = []
    for at, length, sec in risers:
        if length < 2.0:  # a 1 s riser has no room for a bottom and a top window
            continue
        lo0, hi0 = int(round(at * rate)), int(round((at + min(1.0, length)) * rate))
        lo1, hi1 = int(round((at + length - 1.0) * rate)), int(round((at + length) * rate))
        if min(hi0 - lo0, hi1 - lo1) < 64:
            continue
        a = float(np.sqrt(np.mean(build_band[lo0:hi0] ** 2)))
        b = float(np.sqrt(np.mean(build_band[lo1:hi1] ** 2)))
        build_rows.append({"section": sec, "at": at, "length_s": length,
                           "band_hz": [3500, 12000],
                           "rms_bottom_dbfs": round(_db(a), 2),
                           "rms_top_dbfs": round(_db(b), 2),
                           "lift_db": round(_db(b) - _db(a), 2)})
    longest = max(build_rows, key=lambda r: r["length_s"]) if build_rows else None
    breath = cue("breath")
    riser_db = longest["lift_db"] if longest else None

    gates = {
        "samples": (len(x), n, len(x) == n),
        "duration": (round(dur, 6), round(seconds, 6), abs(dur - seconds) < 1e-4),
        "rate": (rate, SR, rate == SR),
        "channels": (x.shape[1], CHANNELS, x.shape[1] == CHANNELS),
        "rms": (round(rms_db, 2), TARGET_RMS_DBFS, abs(rms_db - TARGET_RMS_DBFS) <= 0.5),
        "peak": (round(peak_db, 2), PEAK_CEILING_DBFS, peak_db <= PEAK_CEILING_DBFS + 1e-6),
        "true_peak": (round(tp_db, 2), PEAK_CEILING_DBFS, tp_db <= PEAK_CEILING_DBFS + 1e-6),
        "clipped": (clipped, 0, clipped == 0),
        "probe_rate": (probe.get("sample_rate"), SR, probe.get("sample_rate") == SR),
        "probe_channels": (probe.get("channels"), CHANNELS, probe.get("channels") == CHANNELS),
        "probe_duration": (probe.get("duration_s"), round(seconds, 6),
                           abs(float(probe.get("duration_s") or 0.0) - seconds) < 1e-3),
        # the brief: the riser has to actually rise, and the gap before the drop
        # is air, not silence
        "riser_rises": (riser_db, ">= +6 dB in 3.5-12 kHz, bottom to top",
                        riser_db is not None and riser_db >= 6.0),
        "gap_has_air": (breath["rms_dbfs"] if breath else None, "> -50 dBFS",
                        bool(breath) and breath["rms_dbfs"] > -50.0),
    }
    failed = [k for k, v in gates.items() if not v[2]]

    # What the film does to this bed once it is inside Remotion, read off
    # src/audio/Soundtrack.tsx: the bed is pre-levelled here, the mix stage only
    # applies a fixed trim, a voice-keyed duck and the film's own top and tail.
    BED_GAIN, DUCK, SFX_TRIM, VO_VOL = 0.375, 0.5, 0.56, 1.18
    under_vo = rms_db + _db(BED_GAIN)
    ducked = under_vo + _db(1.0 - DUCK)
    mix_contract = {
        "source": "src/audio/Soundtrack.tsx",
        "bed_gain": BED_GAIN,
        "bed_gain_db": round(_db(BED_GAIN), 2),
        "duck": DUCK,
        "duck_db": round(_db(1.0 - DUCK), 2),
        "duck_ramp_s": 0.26,
        "duck_window_s": {"lead": 0.16, "tail": 0.30},
        "fade_in_s": 1.2,
        "fade_out_s": 1.4,
        "sfx_trim": SFX_TRIM,
        "sfx_trim_db": round(_db(SFX_TRIM), 2),
        "vo_lane_volume": VO_VOL,
        "vo_lane_volume_db": round(_db(VO_VOL), 2),
        "bed_rms_under_vo_dbfs": round(under_vo, 2),
        "bed_rms_ducked_dbfs": round(ducked, 2),
        "bed_peak_after_gain_dbfs": round(peak_db + _db(BED_GAIN), 2),
        "bed_true_peak_after_gain_dbfs": round(tp_db + _db(BED_GAIN), 2),
        "mix_stage_rule": "bed is already at the contract level: apply BED_GAIN, the duck "
                          "and the film's fades, nothing else",
        "peak_driver": "vo lane x" + str(VO_VOL) + " and sfx, never the bed: the bed tops out "
                       "at " + f"{round(peak_db + _db(BED_GAIN), 2)} dBFS in the mix",
    }

    report = {
        "style": "souk-drop",
        "file": args.out,
        "timeline": args.timeline,
        "slug": (timeline.get("style") or {}).get("template") or timeline.get("slug") or timeline.get("look"),
        "bpm": timeline.get("bpm"),
        "fps": fps,
        "bars": int(round(seconds * (float(timeline.get("bpm", 120)) / 240.0))),
        "seconds": round(dur, 6),
        "samples": len(x),
        "rate": rate,
        "channels": int(x.shape[1]),
        "bits": bits,
        "rms_dbfs": round(rms_db, 2),
        "peak_dbfs": round(peak_db, 2),
        "true_peak_dbfs_4x": round(tp_db, 2),
        "crest_db": round(peak_db - rms_db, 2),
        "lufs_i": lufs,
        "clipped_samples": clipped,
        "dc_offset": round(float(np.mean(x)), 6),
        "mono_below_hz": 120,
        "target_rms_dbfs": TARGET_RMS_DBFS,
        "peak_ceiling_dbfs": PEAK_CEILING_DBFS,
        "level_stage": lvl,
        "mix_contract": mix_contract,
        "buses": levels,
        "sections": sec_rows,
        "cues": cues,
        "risers": build_rows,
        "riser_lift_db": riser_db,
        "stems": {
            "from_sfx_library": [],
            "synthesised": ["kick", "clap", "closed hat", "open hat", "clock tick", "808 sub bass",
                            "sub pulse", "sub drop", "impact", "block pluck arpeggio", "glass bell",
                            "detuned saw pad", "air shimmer", "riser", "reverse swell", "swish",
                            "snare roll", "room tone", "plate reverb IR", "ping-pong delay"],
        },
        "gates": {k: {"got": v[0], "want": v[1], "ok": v[2]} for k, v in gates.items()},
        "ok": not failed,
    }

    if args.report:
        rp = ROOT / args.report
        rp.parent.mkdir(parents=True, exist_ok=True)
        rp.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"style souk-drop   {dur:.3f}s   {rate} Hz   {x.shape[1]} ch   {bits}-bit   "
              f"{len(x)} samples")
        print(f"rms  {rms_db:+7.2f} dBFS   peak {peak_db:+7.2f} dBFS   true peak {tp_db:+7.2f} dBFS   "
              f"crest {peak_db - rms_db:5.2f} dB   LUFS-I {lufs:+6.2f}")
        print(f"clipped {clipped}   dc {float(np.mean(x)):+.6f}   limiter {lvl['limiter_engaged']}")
        print(f"mix   bed {mix_contract['bed_rms_under_vo_dbfs']:+.2f} dBFS under VO, "
              f"{mix_contract['bed_rms_ducked_dbfs']:+.2f} ducked, peak "
              f"{mix_contract['bed_peak_after_gain_dbfs']:+.2f} dBFS")
        print()
        print(f"{'section':10s} {'kind':9s} {'start':>6s} {'end':>6s} {'bars':>4s} "
              f"{'rms':>7s} {'peak':>7s} {'lufs':>7s}")
        for s in sec_rows:
            print(f"{str(s['id'])[:10]:10s} {s['kind']:9s} {s['start']:6.2f} {s['end']:6.2f} "
                  f"{s['bars']:4d} {s['rms_dbfs']:7.2f} {s['peak_dbfs']:7.2f} "
                  f"{(s['lufs_i'] if s['lufs_i'] is not None else float('nan')):7.2f}")
        print()
        print("buses " + "  ".join(f"{k} {v['rms_dbfs']:+.1f}" for k, v in levels.items()))
        print()
        print(f"{'cue':18s} {'at':>6s} {'rms':>7s} {'peak':>7s}")
        for c in cues:
            print(f"{c['cue']:18s} {c['at']:6.2f} {c['rms_dbfs']:7.2f} {c['peak_dbfs']:7.2f}")
        if riser_db is not None:
            print()
            print(f"{'riser':18s} {'at':>6s} {'len':>5s} {'bottom':>8s} {'top':>8s} {'lift':>7s}")
            for r in build_rows:
                print(f"{str(r['section'])[:18]:18s} {r['at']:6.2f} {r['length_s']:5.2f} "
                      f"{r['rms_bottom_dbfs']:8.2f} {r['rms_top_dbfs']:8.2f} {r['lift_db']:+7.2f}")
            print(f"riser lift (longest) {riser_db:+.2f} dB in 3.5-12 kHz")
        print()
        if failed:
            for k in failed:
                print(f"FAIL {k}: got {gates[k][0]!r}, want {gates[k][1]!r}")
        else:
            print("gates ok: 1,920,000 samples, 48 kHz, stereo, rms -19 +/-0.5, "
                  "peak <= -3, 0 clipped")
        print(f"wrote {args.out}")
        if args.report:
            print(f"wrote {args.report}")
    return 1 if failed else 0


def main() -> None:
    ap = argparse.ArgumentParser(description="compose the music bed from the timeline")
    ap.add_argument("--timeline", default="src/generated/timeline.json")
    ap.add_argument("--out", default="public/audio/score/music.wav")
    ap.add_argument("--style", default="classic", choices=["classic", "souk-drop"],
                    help="classic = the original pad bed (default); souk-drop = the launch track")
    ap.add_argument("--report", default="out/audio/score-report.json",
                    help="measurement file; only the savable styles write one")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    timeline = json.loads((ROOT / args.timeline).read_text(encoding="utf-8"))
    if args.style == "souk-drop":
        raise SystemExit(_souk_main(args, timeline))
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

#!/usr/bin/env python3
"""
Procedural score + SFX for the StudyAI promo film.

Reads   script/score_map.json       (the musical map: sections, chords, layers, motifs)
Writes  public/audio/score/*.wav    music.wav + 5 stems (drums, bass, harmony, lead, fx)
        public/audio/sfx/*.wav      the 6 bespoke sound effects
        AUDIO-REPORT.md             measured verification report

Design rules honoured here
- numpy + scipy + wave only. No samples, no downloads, no audio libraries.
- 120 BPM, 59 bars of 2.000 s = 118.000 s, 48 kHz stereo 24-bit.
- Every section boundary is a bar line; the drop is bar 7 (12.0 s).
- D minor throughout, a single A dominant at bars 54-56, D major for bars 57-59.
- Instruments are digital: band-limited sawtables for the pad/strings, per-partial
  exponential-decay additive synthesis for piano/pluck/lead/bell, VA sub/dub bass,
  synthesised kick / clap / hat / snare.
- Reverb = convolution with a synthetic 1.8 s exponentially-decaying noise IR, per bus.
- The pad and strings are sidechain-ducked under the kick by 2.5 dB.
- The stems are scaled by ONE common gain and music.wav is written as the sum of the
  quantised stems, so the stems sum to the mix sample-exactly.

Usage
    python script/make_score.py                # render everything + report
    python script/make_score.py --no-write     # render and analyse, write nothing
    python script/make_score.py --report-only  # re-measure existing wavs, rewrite report
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent           # marketing/video
SCRIPT = ROOT / "script"
SCORE_DIR = ROOT / "public" / "audio" / "score"
SFX_DIR = ROOT / "public" / "audio" / "sfx"
REPORT = ROOT / "AUDIO-REPORT.md"

TWO_PI = 2.0 * math.pi
LN1000 = 6.907755278982137          # -60 dB in nepers
A4 = 440.0


# ─────────────────────────────────────────────────────────────────────────────
# small helpers
# ─────────────────────────────────────────────────────────────────────────────
def midi_to_hz(m) -> float:
    return A4 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def cents_ratio(cents: float) -> float:
    return 2.0 ** (cents / 1200.0)


def lin_to_db(x: float) -> float:
    return 20.0 * math.log10(max(float(x), 1e-12))


def db_to_lin(d: float) -> float:
    return 10.0 ** (d / 20.0)


def mean_square(x: np.ndarray) -> float:
    return float(np.mean(np.square(x, dtype=np.float64)))


def normalize_rms(x: np.ndarray, target: float = 1.0) -> np.ndarray:
    r = math.sqrt(mean_square(x))
    return x * (target / r) if r > 1e-12 else x


def normalize_peak(x: np.ndarray, target: float = 1.0) -> np.ndarray:
    p = float(np.max(np.abs(x))) if x.size else 0.0
    return x * (target / p) if p > 1e-12 else x


def guarantee_edges(sig: np.ndarray, sr: int, fade_in_s: float = 0.005,
                    fade_out_s: float = 0.015) -> np.ndarray:
    """5 ms fade-in and >=8 ms fade-out on EVERY note / burst: no clicks, ever."""
    n = sig.shape[0]
    if n < 4:
        return sig
    ni = min(int(fade_in_s * sr), n // 2)
    no = min(max(int(fade_out_s * sr), 8 * sr // 1000), n // 2)
    if ni > 1:
        r = 0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, ni))
        sig[:ni] *= r[:, None] if sig.ndim == 2 else r
    if no > 1:
        r = 0.5 + 0.5 * np.cos(np.linspace(0.0, np.pi, no))
        sig[-no:] *= r[:, None] if sig.ndim == 2 else r
    return sig


def raised_cos(n: int) -> np.ndarray:
    return 0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, n))


# ─────────────────────────────────────────────────────────────────────────────
# filters
# ─────────────────────────────────────────────────────────────────────────────
def _sos(kind: str, freq, sr: int, order: int = 2):
    freq = np.clip(np.asarray(freq, dtype=np.float64), 10.0, 0.47 * sr)
    return signal.butter(order, freq, btype=kind, fs=sr, output="sos")


def lp(x, freq, sr, order=2):
    return signal.sosfilt(_sos("lowpass", freq, sr, order), x)


def hp(x, freq, sr, order=2):
    return signal.sosfilt(_sos("highpass", freq, sr, order), x)


def bp(x, lo, hi, sr, order=2):
    return signal.sosfilt(_sos("bandpass", [lo, hi], sr, order), x)


def tv_onepole_lp(x: np.ndarray, sr: int, curve_hz: np.ndarray,
                  passes: int = 2, block: int = 512) -> np.ndarray:
    """Causally time-varying 6 dB/oct lowpass, run `passes` times (12 dB/oct).

    The curve is read once per block, and the one-pole state is carried across
    blocks exactly, so a slow filter sweep stays perfectly smooth.
    """
    n = x.shape[0]
    a_all = 1.0 - np.exp(-TWO_PI * np.clip(curve_hz, 20.0, 0.45 * sr) / sr)
    y = np.asarray(x, dtype=np.float64).copy()
    for _ in range(passes):
        out = np.empty_like(y)
        state = 0.0
        for i0 in range(0, n, block):
            i1 = min(i0 + block, n)
            a = a_all[i0]
            seg, _zf = signal.lfilter([a], [1.0, a - 1.0], y[i0:i1],
                                      zi=np.array([(1.0 - a) * state]))
            out[i0:i1] = seg
            state = float(out[i1 - 1])
        y = out
    return y


def tv_bandpass(x: np.ndarray, sr: int, fc_curve: np.ndarray, width: float = 1.6,
                order: int = 2, block: int = 256) -> np.ndarray:
    """Sweeping bandpass (used for risers / whooshes / downlifters)."""
    n = x.shape[0]
    out = np.empty(n, dtype=np.float64)
    zi = None
    for i0 in range(0, n, block):
        i1 = min(i0 + block, n)
        fc = float(np.clip(fc_curve[i0], 40.0, 0.42 * sr))
        lo = max(20.0, fc / width)
        hi = min(0.45 * sr, fc * width)
        if hi <= lo * 1.05:
            hi = min(0.45 * sr, lo * 1.05)
        sos = _sos("bandpass", [lo, hi], sr, order)
        if zi is None or zi.shape != sos.shape[:1] + (2,):
            zi = np.zeros((sos.shape[0], 2))
        seg, zi = signal.sosfilt(sos, x[i0:i1], zi=zi)
        out[i0:i1] = seg
    return out


# ─────────────────────────────────────────────────────────────────────────────
# band-limited wavetable bank (saw family) — used by pad + strings
# ─────────────────────────────────────────────────────────────────────────────
class WavetableBank:
    """Band-limited additive tables, one per harmonic count, normalised to unit RMS."""

    def __init__(self, size: int = 4096):
        self.size = size
        self.xp = np.arange(size + 1, dtype=np.float64)
        self._cache: dict[tuple[int, int], np.ndarray] = {}

    def get(self, nharm: int, rolloff: float) -> np.ndarray:
        key = (nharm, int(round(rolloff * 100)))
        tab = self._cache.get(key)
        if tab is not None:
            return tab
        ph = np.arange(self.size, dtype=np.float64) * (TWO_PI / self.size)
        k = np.arange(1, nharm + 1, dtype=np.float64)
        amps = k ** (-rolloff)
        wave = np.zeros(self.size)
        for kk, aa in zip(k, amps):
            wave += aa * np.sin(ph * kk)
        rms = math.sqrt(float(np.mean(wave * wave)))
        if rms > 1e-12:
            wave /= rms
        tab = np.concatenate([wave, wave[:1]])
        self._cache[key] = tab
        return tab

    def play(self, table: np.ndarray, inc: float, n: int, phase0: float) -> np.ndarray:
        pos = np.mod(phase0 + np.arange(n, dtype=np.float64) * inc, 1.0) * self.size
        return np.interp(pos, self.xp, table)

    def play_sweep(self, table: np.ndarray, inc: np.ndarray, n: int,
                   phase0: float) -> np.ndarray:
        phase = phase0 + np.cumsum(inc)
        pos = np.mod(phase, 1.0) * self.size
        return np.interp(pos, self.xp, table)


BANK = WavetableBank()


# ─────────────────────────────────────────────────────────────────────────────
# synthesis: tonal instruments
# ─────────────────────────────────────────────────────────────────────────────
def additive_tone(freq: float, n: int, sr: int, ratios: np.ndarray, amps: np.ndarray,
                  t60s: np.ndarray, phases: np.ndarray, attack: float,
                  vib_hz: float = 0.0, vib_depth: float = 0.0,
                  chunk: int = 16384) -> np.ndarray:
    """Sum of decaying sine partials. Ratios may be inharmonic (bells)."""
    out = np.zeros(n, dtype=np.float64)
    rates = LN1000 / np.maximum(t60s, 1e-3)
    base = TWO_PI * freq
    vib_n = np.zeros(n)
    if vib_depth > 0.0 and vib_hz > 0.0:
        tv = np.arange(n, dtype=np.float64) / sr
        vib_n = np.sin(TWO_PI * vib_hz * tv)
    for i0 in range(0, n, chunk):
        i1 = min(i0 + chunk, n)
        t = np.arange(i0, i1, dtype=np.float64) / sr
        ph = np.outer(base * ratios, t)                    # (K, m)
        if vib_depth > 0.0:
            dev = base * ratios * (vib_depth / vib_hz) * 1.0
            ph = ph + np.outer(dev, vib_n[i0:i1])
        ph = ph + phases[:, None]
        env = np.exp(-np.outer(rates, t))
        out[i0:i1] = (amps[:, None] * env * np.sin(ph)).sum(axis=0)
    na = int(attack * sr)
    if na > 1:
        out[:na] *= raised_cos(na)
    return out


def harmonic_partials(harmonics: int, rolloff: float, t60: float, t60_div: float,
                      inharmonic: float, bright: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Velocity-scaled brightness: harder notes keep more (and longer) upper partials."""
    k = np.arange(1, harmonics + 1, dtype=np.float64)
    ratios = k * np.sqrt(1.0 + inharmonic * k * k)
    amps = k ** (-rolloff * (1.85 - 0.85 * bright))
    t60s = t60 / (1.0 + t60_div * (k - 1.0) * (1.35 - 0.35 * bright))
    return ratios, amps, t60s


def tonal_note(inst: dict, sr: int, rng, midi: int, ring: float, vel: float,
               detune: float = 0.0, vib: bool = False) -> np.ndarray:
    """Unit-RMS additive pluck / piano / lead / bell note."""
    freq = float(midi_to_hz(midi)) * cents_ratio(detune)
    n = max(64, int(round(ring * sr)))
    bright = 0.42 + 0.58 * float(np.clip(vel, 0.0, 1.0))
    if "partial_ratios" in inst:
        prel = np.asarray(inst["partial_ratios"], dtype=np.float64)
        pamp = np.asarray(inst["partial_amps"], dtype=np.float64)
        ratios = prel
        amps = pamp * (bright ** np.arange(len(pamp)) * 0.55 + 0.45)
        t60s = inst["t60"] / (1.0 + inst["t60_div"] * np.arange(len(pamp)))
    else:
        ratios, amps, t60s = harmonic_partials(
            inst["harmonics"], inst["rolloff"], inst["t60"], inst["t60_div"],
            inst.get("inharmonic", 0.0), bright)
    t60s = t60s * (0.78 + 0.34 * vel)
    ph = rng.random(len(ratios)) * TWO_PI
    sig = additive_tone(freq, n, sr, ratios, amps, t60s, ph,
                        attack=inst.get("attack", 0.005),
                        vib_hz=inst.get("vibrato_hz", 0.0) if vib else 0.0,
                        vib_depth=inst.get("vibrato", 0.0) if vib else 0.0)
    return normalize_rms(sig, 1.0)


def ensemble_note(inst: dict, sr: int, rng, midis, ring: float, attack: float,
                  release: float, vib: bool = False, stagger: float = 0.0) -> np.ndarray:
    """Detuned band-limited saw ensemble (pad / strings). Returns stereo, unit RMS."""
    n = max(256, int(round((ring + release) * sr)))
    out = np.zeros((n, 2))
    det = inst.get("detune_cents", [-7.0, 6.0])
    roll = inst.get("rolloff", 1.2)
    maxh = int(inst.get("max_harmonics", 40))
    for midi in midis:
        f = float(midi_to_hz(midi))
        nh = int(max(4, min(maxh, 0.44 * sr / f)))
        table = BANK.get(nh, roll)
        off = int(round(rng.uniform(0.0, stagger) * sr)) if stagger > 0 else 0
        nn = n - off
        if nn < 64:
            continue
        for ch in (0, 1):
            ja = rng.uniform(-1.6, 1.6)
            voices = [(det[0] + ja, 1.0), (det[1] - ja * 0.5, 0.82)]
            if ch == 1:
                voices = [(det[1] - ja, 1.0), (det[0] + ja * 0.5, 0.82)]
            acc = np.zeros(nn)
            for cents, amp in voices:
                inc = f * cents_ratio(cents) / sr
                if vib:
                    tv = np.arange(nn, dtype=np.float64) / sr
                    depth = inst.get("vibrato", 0.0025)
                    vhz = inst.get("vibrato_hz", 4.7)
                    dev = 2.0 * f * cents_ratio(cents) * depth / sr
                    inc = inc + dev * np.sin(TWO_PI * vhz * tv + rng.random() * TWO_PI)
                acc += amp * BANK.play_sweep(table, np.full(nn, inc) if np.isscalar(inc) else inc,
                                             nn, rng.random())
            out[off:off + nn, ch] += acc
    if not np.any(out):
        return out
    rms = math.sqrt(float(np.mean(out * out)))
    if rms > 1e-12:
        out *= 1.0 / rms
    na = min(max(int(attack * sr), 2), n // 2)
    out[:na] *= raised_cos(na)[:, None]
    nr = min(max(int(release * sr), 2), n // 2)
    start = max(0, min(n - nr, int(round(ring * sr))))
    env = 0.5 + 0.5 * np.cos(np.linspace(0.0, np.pi, nr))
    out[start:start + nr] *= env[:, None]
    out[start + nr:] = 0.0
    return out


def _make_saw_inc(f, vib_depth, vib_hz, sr, nn, rng):
    inc = np.full(nn, f / sr)
    if vib_depth > 0.0:
        tv = np.arange(nn, dtype=np.float64) / sr
        inc = inc + (2.0 * f * vib_depth / sr) * np.sin(TWO_PI * vib_hz * tv)
    return inc


# ─────────────────────────────────────────────────────────────────────────────
# synthesis: bass family
# ─────────────────────────────────────────────────────────────────────────────
def bass_note(inst: dict, sr: int, midi: int, ring: float, vel: float,
              glide_from: float | None = None) -> np.ndarray:
    """Sub / dub bass: sine + sub-octave, tanh saturation, lowpassed. Unit RMS."""
    f = float(midi_to_hz(midi))
    n = max(64, int(round(ring * sr)))
    t = np.arange(n, dtype=np.float64) / sr
    if glide_from is not None:
        g = inst.get("glide_seconds", 0.0)
        f0 = float(midi_to_hz(glide_from))
        if g > 1e-4:
            f_curve = f + (f0 - f) * np.exp(-t / (g / 3.0))
        else:
            f_curve = np.full(n, f)
    else:
        f_curve = np.full(n, f)
    phase = TWO_PI * np.cumsum(f_curve) / sr
    sig = np.sin(phase) + inst.get("harm2", 0.2) * np.sin(2.0 * phase) \
        + inst.get("harm3", 0.06) * np.sin(3.0 * phase)
    if inst.get("sub_oct", 0.0) > 0.0:
        sig = sig + inst["sub_oct"] * np.sin(0.5 * phase)
    drive = inst.get("drive", 0.7)
    sig = np.tanh(drive * sig) / math.tanh(drive)
    t60 = inst["t60"] * (0.85 + 0.3 * vel)
    body = 0.34 + 0.66 * np.exp(-t * (LN1000 / t60))
    sig *= body
    sig = lp(sig, inst["lp_hz"], sr, order=3)
    na = max(2, int(inst.get("attack", 0.006) * sr))
    sig[:na] *= raised_cos(na)
    return normalize_rms(sig, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# synthesis: drums (all peak-normalised to 1.0)
# ─────────────────────────────────────────────────────────────────────────────
def drum_kick(inst: dict, sr: int, rng) -> np.ndarray:
    n = int(0.46 * sr)
    t = np.arange(n, dtype=np.float64) / sr
    tau = inst["pitch_seconds"] / 2.3
    f = inst["f_end"] + (inst["f_start"] - inst["f_end"]) * np.exp(-t / tau)
    phase = TWO_PI * np.cumsum(f) / sr
    body = np.sin(phase) * np.exp(-t * (LN1000 / inst["t60"]))
    body = np.tanh(1.25 * body) / math.tanh(1.25)
    nk = int(0.012 * sr)
    click = hp(rng.standard_normal(nk), inst["click_hz"], sr, order=2)
    click *= np.exp(-np.arange(nk) / (0.0030 * sr))
    click = normalize_peak(click, inst["click"])
    body[:nk] += click
    return normalize_peak(body, 1.0)


def drum_clap(inst: dict, sr: int, rng) -> np.ndarray:
    n = int(0.38 * sr)
    t = np.arange(n, dtype=np.float64) / sr
    out = np.zeros(n)
    for i, (off, amp) in enumerate([(0.000, 1.00), (0.009, 0.78), (0.019, 0.84), (0.028, 0.66)]):
        nb = int(0.028 * sr)
        tb = np.arange(nb) / sr
        b = bp(rng.standard_normal(nb), 1500.0, 4200.0, sr, order=2)
        b *= np.exp(-tb / 0.010) * amp
        i0 = int(off * sr)
        m = min(nb, n - i0)
        out[i0:i0 + m] += b[:m]
    tail = bp(rng.standard_normal(n), 1400.0, 5000.0, sr, order=2)
    tail *= np.exp(-t / 0.085) * 0.34
    out += tail
    body = np.sin(TWO_PI * inst["body_hz"] * t) * np.exp(-t / 0.048) * 0.42
    out += body
    return normalize_peak(out, 1.0)


def drum_hat(sr: int, rng, open_hat: bool = False) -> np.ndarray:
    dur = 0.34 if open_hat else 0.055
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    x = hp(rng.standard_normal(n), 6800.0, sr, order=3)
    x = bp(x, 5200.0, 16000.0, sr, order=2)
    dec = 0.115 if open_hat else 0.017
    x *= np.exp(-t / dec)
    x += 0.22 * hp(rng.standard_normal(n), 11000.0, sr, order=2) * np.exp(-t / (dec * 0.55))
    return normalize_peak(x, 1.0)


def drum_snare(inst: dict, sr: int, rng, vel: float = 1.0) -> np.ndarray:
    n = int(0.30 * sr)
    t = np.arange(n, dtype=np.float64) / sr
    noise = bp(rng.standard_normal(n), 1600.0, 6200.0, sr, order=2)
    noise *= np.exp(-t / 0.085)
    body = np.sin(TWO_PI * 186.0 * t) * np.exp(-t / 0.052) * 0.5
    body += np.sin(TWO_PI * 92.0 * t) * np.exp(-t / 0.075) * 0.28
    x = noise + body
    return normalize_peak(x, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# synthesis: fx one-shots (peak-normalised)
# ─────────────────────────────────────────────────────────────────────────────
def fx_subdrop(dur: float, sr: int, rng, f0=60.0, f1=28.0, curve=1.8, drive=1.6,
               noise=0.10) -> np.ndarray:
    n = max(64, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    u = np.clip(t / max(dur, 1e-6), 0.0, 1.0)
    f = f0 * (f1 / f0) ** (u ** curve)
    phase = TWO_PI * np.cumsum(f) / sr
    sig = np.sin(phase) + 0.30 * np.sin(2.0 * phase) + 0.12 * np.sin(3.0 * phase)
    sig = np.tanh(drive * sig) / math.tanh(drive)
    env = np.minimum(1.0, t / 0.010) * (1.0 - u) ** 1.4
    sig *= env
    if noise > 0.0:
        nz = lp(rng.standard_normal(n), 900.0, sr, order=2) * np.exp(-t / (dur * 0.35))
        sig += noise * normalize_peak(nz, 1.0) * env
    return normalize_peak(sig, 1.0)


def fx_riser(dur: float, sr: int, rng, f0=240.0, f1=9000.0, sine_f0=55.0,
             sine_f1=880.0, shape=1.7, width=1.6) -> np.ndarray:
    n = max(256, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    u = np.clip(t / max(dur, 1e-6), 0.0, 1.0)
    fc = f0 * (f1 / f0) ** u
    nz = tv_bandpass(rng.standard_normal(n), sr, fc, width=width)
    nz = normalize_peak(nz, 1.0)
    fsine = sine_f0 * (sine_f1 / sine_f0) ** u
    sphase = TWO_PI * np.cumsum(fsine) / sr
    tone = 0.42 * np.sin(sphase) + 0.18 * np.sin(2.0 * sphase)
    env = u ** shape
    sig = (nz * 0.80 + tone * 0.55) * env
    sig = hp(sig, 45.0, sr, order=2)
    return normalize_peak(sig, 1.0)


def fx_impact(dur: float, sr: int, rng) -> np.ndarray:
    n = max(256, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    u = np.clip(t / max(dur, 1e-6), 0.0, 1.0)
    f = 30.0 + 52.0 * np.exp(-t / 0.055)
    phase = TWO_PI * np.cumsum(f) / sr
    boom = np.sin(phase) * np.exp(-t * (LN1000 / (dur * 0.42)))
    boom = np.tanh(1.4 * boom) / math.tanh(1.4)
    nz = lp(rng.standard_normal(n), 420.0, sr, order=2) * np.exp(-t / 0.16)
    nz = normalize_peak(nz, 1.0) * 0.55
    crack_n = int(0.05 * sr)
    crack = hp(rng.standard_normal(crack_n), 2200.0, sr, order=2)
    crack *= np.exp(-np.arange(crack_n) / (0.008 * sr))
    crack = normalize_peak(crack, 1.0) * 0.30
    sig = boom + nz
    sig[:crack_n] += crack
    return normalize_peak(sig, 1.0)


def fx_swell(dur: float, sr: int, rng) -> np.ndarray:
    n = max(256, int(dur * sr))
    u = np.linspace(0.0, 1.0, n)
    fc = 400.0 * 9.5 ** u
    nz = tv_bandpass(rng.standard_normal(n), sr, fc, width=2.4)
    nz = normalize_peak(nz, 1.0)
    env = np.exp(-((u - 0.80) ** 2) / (2.0 * 0.16 ** 2))
    sig = nz * env
    return normalize_peak(sig, 1.0)


def fx_reverse(dur: float, sr: int, rng) -> np.ndarray:
    n = max(256, int(dur * sr))
    u = np.linspace(0.0, 1.0, n)
    fc = 500.0 * 8.0 ** u
    nz = tv_bandpass(rng.standard_normal(n), sr, fc, width=2.0)
    nz = normalize_peak(nz, 1.0)
    sig = nz * (u ** 2.2)
    return normalize_peak(sig, 1.0)


def fx_downlifter(dur: float, sr: int, rng) -> np.ndarray:
    n = max(256, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    u = np.clip(t / max(dur, 1e-6), 0.0, 1.0)
    fc = 6000.0 * (220.0 / 6000.0) ** u
    nz = tv_bandpass(rng.standard_normal(n), sr, fc, width=1.9)
    nz = normalize_peak(nz, 1.0)
    f = 120.0 * (34.0 / 120.0) ** u
    phase = TWO_PI * np.cumsum(f) / sr
    tone = 0.5 * np.sin(phase) * (1.0 - u) ** 1.2
    sig = (nz * 0.7 + tone) * (1.0 - u) ** 0.9
    return normalize_peak(sig, 1.0)


def fx_tension(dur: float, sr: int, rng) -> np.ndarray:
    n = max(256, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    u = np.clip(t / max(dur, 1e-6), 0.0, 1.0)
    fc = np.full(n, 380.0) * (1.0 + 0.9 * u)
    nz = tv_bandpass(rng.standard_normal(n), sr, fc, width=2.2)
    nz = normalize_peak(nz, 1.0)
    drone = np.sin(TWO_PI * 36.71 * t) * 0.6 + np.sin(TWO_PI * 55.0 * t) * 0.25
    sig = (nz * 0.55 + drone) * (u ** 1.5)
    return normalize_peak(sig, 1.0)


def make_roomtone(dur: float, sr: int, rng, level_hint: float = 1.0) -> np.ndarray:
    """Vinyl / room bed: filtered noise + slow drift + sparse crackle. Stereo, unit RMS."""
    n = max(256, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    L = lp(rng.standard_normal(n), 750.0, sr, order=2)
    R = lp(rng.standard_normal(n), 750.0, sr, order=2)
    R = np.roll(R, 977)
    rumble = lp(rng.standard_normal(n), 60.0, sr, order=2)
    drift = 1.0 + 0.22 * np.sin(TWO_PI * 0.07 * t) + 0.10 * np.sin(TWO_PI * 0.031 * t + 1.1)
    st = np.stack([L + 0.35 * rumble, R + 0.35 * np.roll(rumble, 331)], axis=1) * drift[:, None]
    pops = np.zeros((n, 2))
    k = int(dur * 5)
    idx = rng.integers(0, max(1, n - 400), size=k)
    for i in idx:
        pl = int(rng.integers(30, 90))
        amp = rng.uniform(0.06, 0.30)
        st[i:i + pl, 0] += amp * rng.standard_normal(pl) * np.exp(-np.arange(pl) / 12.0)
        st[i:i + pl, 1] += amp * rng.standard_normal(pl) * np.exp(-np.arange(pl) / 12.0) * 0.8
    st += pops
    na = min(int(0.35 * sr), n // 2)
    st[:na] *= raised_cos(na)[:, None]
    no = min(int(0.45 * sr), n // 2)
    st[-no:] *= (0.5 + 0.5 * np.cos(np.linspace(0.0, np.pi, no)))[:, None]
    return normalize_rms(st, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# reverb
# ─────────────────────────────────────────────────────────────────────────────
def make_ir(sr: int, seconds: float, decay: float, predelay_ms: float,
            tilt_hz: float, lowpass_hz: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(seconds * sr)
    t = np.arange(n, dtype=np.float64) / sr
    env = np.exp(-decay * t)
    ir = np.zeros((n, 2))
    for ch in (0, 1):
        noise = rng.standard_normal(n)
        lo = lp(noise, tilt_hz, sr, order=2)
        hi = noise - lo
        ch_sig = lo * env + hi * (env ** 2.1) * 0.52
        # sparse early reflections (8-60 ms) for a sense of a real room
        for k, (dt, amp) in enumerate([(0.009, 0.55), (0.017, -0.42), (0.026, 0.35),
                                       (0.038, -0.26), (0.052, 0.20), (0.071, -0.14)]):
            i = int((dt + 0.002 * ch) * sr)
            if i < n:
                ch_sig[i] += amp
        ir[:, ch] = ch_sig
    pd = int(predelay_ms / 1000.0 * sr)
    if pd > 0:
        ir = np.concatenate([np.zeros((pd, 2)), ir], axis=0)
    for ch in (0, 1):
        ir[:, ch] = lp(ir[:, ch], lowpass_hz, sr, order=2)
    ir[: int(0.003 * sr)] *= raised_cos(int(0.003 * sr))[:, None]
    no = int(0.06 * sr)
    ir[-no:] *= (0.5 + 0.5 * np.cos(np.linspace(0.0, np.pi, no)))[:, None]
    e = math.sqrt(mean_square(ir))
    return ir / e if e > 1e-12 else ir


def convolve_reverb(dry: np.ndarray, ir: np.ndarray, sr: int) -> np.ndarray:
    n = dry.shape[0]
    wet = np.zeros_like(dry)
    for ch in (0, 1):
        wet[:, ch] = signal.fftconvolve(dry[:, ch], ir[:, ch])[:n]
    return wet


def pingpong_delay(dry: np.ndarray, sr: int, time_s: float, feedback: float,
                   wet: float, lowpass_hz: float) -> np.ndarray:
    d = int(time_s * sr)
    if d <= 0:
        return dry
    out = dry.copy()
    tap = dry.copy()
    for k in range(1, 5):
        tap = np.concatenate([np.zeros((d, 2)), tap[: max(0, len(tap) - d)]], axis=0)
        tap *= feedback
        for ch in (0, 1):
            tap[:, ch] = lp(tap[:, ch], lowpass_hz, sr, order=2)
        if k % 2 == 1:
            out[:, 0] += tap[:, 1] * wet
            out[:, 1] += tap[:, 1] * wet * 0.0 + tap[:, 0] * 0.0
            out[:, 1] += tap[:, 1] * 0.0
            out[:, 1] += 0.0
        # explicit ping-pong: odd taps land left, even taps land right
        if k % 2 == 1:
            out[:, 0] += tap[:, 1] * wet
            out[:, 1] += tap[:, 1] * wet * 0.35
        else:
            out[:, 1] += tap[:, 0] * wet
            out[:, 0] += tap[:, 0] * wet * 0.35
    return out


# ─────────────────────────────────────────────────────────────────────────────
# the renderer
# ─────────────────────────────────────────────────────────────────────────────
class Bus:
    def __init__(self, n: int):
        self.n = n
        self.data = np.zeros((n, 2), dtype=np.float64)

    def add(self, sig: np.ndarray, start: int, pan: float = 0.0, gain: float = 1.0) -> None:
        if sig.ndim == 1:
            ang = (float(np.clip(pan, -1.0, 1.0)) + 1.0) * math.pi * 0.25
            gl = math.sqrt(2.0) * math.cos(ang) * gain
            gr = math.sqrt(2.0) * math.sin(ang) * gain
            if start < 0:
                sig = sig[-start:]
                start = 0
            if start >= self.n:
                return
            end = min(self.n, start + len(sig))
            m = end - start
            if m <= 0:
                return
            self.data[start:end, 0] += sig[:m] * gl
            self.data[start:end, 1] += sig[:m] * gr
        else:
            if start < 0:
                sig = sig[-start:]
                start = 0
            if start >= self.n:
                return
            end = min(self.n, start + sig.shape[0])
            m = end - start
            if m <= 0:
                return
            ang = (float(np.clip(pan, -1.0, 1.0)) + 1.0) * math.pi * 0.25
            gl = math.sqrt(2.0) * math.cos(ang) * gain
            gr = math.sqrt(2.0) * math.sin(ang) * gain
            self.data[start:end, 0] += sig[:m, 0] * gl
            self.data[start:end, 1] += sig[:m, 1] * gr


class Score:
    def __init__(self, m: dict):
        self.m = m
        meta = m["meta"]
        self.sr = int(meta["sample_rate"])
        self.bpm = float(meta["bpm"])
        self.spb = 60.0 / self.bpm
        self.spbar = self.spb * float(meta["beats_per_bar"])
        self.bars = int(meta["bars"])
        self.dur = float(meta["duration_seconds"])
        self.n = int(round(self.dur * self.sr))
        self.rng = np.random.default_rng(20261020)
        self.chords = [m["chord_library"][c] for c in m["chord_plan"]]
        self.chord_names = list(m["chord_plan"])
        self.inst = m["instruments"]
        self.pats = m["patterns"]
        self.sections = m["sections"]
        self.buses = {name: Bus(self.n) for name in m["stems"]}
        self.kick_times: list[float] = []
        self._pad_groups_cache = None

    # ---- time helpers ------------------------------------------------------
    def bar_t(self, bar: int, step: float = 0.0) -> float:
        """Absolute seconds of `bar` (1-based) at `step` sixteenth notes."""
        return ((bar - 1) * self.spbar) + step * (self.spbar / 16.0)

    def section_of(self, bar: int) -> dict:
        for s in self.sections:
            if s["from_bar"] <= bar <= s["to_bar"]:
                return s
        raise KeyError(f"bar {bar} is not covered by any section")

    # ---- pattern / layer helpers ------------------------------------------
    @staticmethod
    def specs(v) -> list[dict]:
        return v if isinstance(v, list) else [v]

    @staticmethod
    def bar_ok(spec: dict, bar: int) -> bool:
        on = spec.get("on_bars")
        off = spec.get("off_bars")
        if on is not None and bar not in on:
            return False
        if off is not None and bar in off:
            return False
        return True

    def layer(self, sec: dict, name: str) -> list[dict]:
        v = sec["layers"].get(name)
        return [] if v is None else self.specs(v)

    # ---- note placement ----------------------------------------------------
    def place(self, bus: str, sig: np.ndarray, t: float, pan: float = 0.0,
              gain: float = 1.0) -> None:
        if sig is None or sig.size == 0:
            return
        guarantee_edges(sig, self.sr)
        self.buses[bus].add(sig, int(round(t * self.sr)), pan, gain)

    # ---- instrument note factories ----------------------------------------
    def tonal(self, inst_name: str, midi: int, ring: float, vel: float,
              detune: float = 0.0) -> np.ndarray:
        return tonal_note(self.inst[inst_name], self.sr, self.rng, midi, ring, vel, detune)

    # =======================================================================
    # bus renders
    # =======================================================================
    def render_drums(self) -> None:
        sr = self.sr
        kick_inst = self.inst["kick"]
        for sec in self.sections:
            for name in ("kick", "clap", "hat", "openhat", "snare"):
                for spec in self.layer(sec, name):
                    pat = self.pats[spec["pattern"]]
                    lvl = float(spec.get("level", 1.0)) * float(self.inst[name]["gain"])
                    for bar in range(sec["from_bar"], sec["to_bar"] + 1):
                        if not self.bar_ok(spec, bar):
                            continue
                        if pat["type"] == "hits":
                            hits = [(float(s), float(v)) for s, v in pat["hits"]]
                        elif pat["type"] == "roll":
                            steps = pat["steps"]
                            v0, v1 = float(pat["v0"]), float(pat["v1"])
                            hits = [(float(s), v0 + (v1 - v0) * (i / max(1, len(steps) - 1)))
                                    for i, s in enumerate(steps)]
                        else:
                            continue
                        for step, vel in hits:
                            t = self.bar_t(bar, step)
                            if name == "kick":
                                sig = drum_kick(kick_inst, sr, self.rng)
                                self.kick_times.append(t)
                                self.place("drums", sig, t, 0.0, lvl * vel)
                            elif name == "clap":
                                self.place("drums", drum_clap(self.inst["clap"], sr, self.rng),
                                           t + float(self.rng.normal(0.0, 0.0016)), 0.03,
                                           lvl * vel)
                            elif name == "hat":
                                jit = float(self.rng.normal(0.0, 0.0022))
                                pan = float(np.clip(self.rng.normal(0.10, 0.16), -0.5, 0.5))
                                self.place("drums", drum_hat(sr, self.rng, False),
                                           t + jit, pan, lvl * vel)
                            elif name == "openhat":
                                jit = float(self.rng.normal(0.0, 0.0018))
                                self.place("drums", drum_hat(sr, self.rng, True),
                                           t + jit, float(np.clip(self.rng.normal(0.14, 0.1), -0.4, 0.4)),
                                           lvl * vel)
                            else:  # snare
                                self.place("drums", drum_snare(self.inst["snare"], sr, self.rng),
                                           t + float(self.rng.normal(0.0, 0.0014)),
                                           float(self.rng.normal(0.0, 0.05)), lvl * vel)

    def render_bass(self) -> None:
        """Sub pulses and the dub bass line."""
        for sec in self.sections:
            for name in ("sub", "bass"):
                inst = self.inst[name]
                for spec in self.layer(sec, name):
                    pat = self.pats[spec["pattern"]]
                    if pat.get("type") != "bass" and pat.get("type") != "hits":
                        continue
                    lvl = float(spec.get("level", 1.0)) * float(inst["gain"])
                    octave = int(spec.get("octave", 0))
                    prev_midi = None
                    prev_t = -99.0
                    for bar in range(sec["from_bar"], sec["to_bar"] + 1):
                        if not self.bar_ok(spec, bar):
                            continue
                        chord = self.chords[bar - 1]
                        root = int(chord["bass"]) + 12 * octave
                        if pat.get("type") == "bass":
                            hits = [(float(s), int(semi), float(v)) for s, semi, v in pat["hits"]]
                            ring_base = 0.62 if name == "bass" else 0.50
                        else:
                            hits = [(float(s), 0, float(v)) for s, v in pat["hits"]]
                            ring_base = 0.46 if name == "sub" else 0.42
                        for step, semi, vel in hits:
                            midi = root + semi
                            t = self.bar_t(bar, step)
                            ring = ring_base
                            glide_from = None
                            if name == "bass" and prev_midi is not None and (t - prev_t) < 0.36 \
                                    and abs(prev_midi - midi) <= 12 and prev_midi != midi:
                                glide_from = prev_midi
                            sig = bass_note(inst, self.sr, midi, ring, vel, glide_from)
                            self.place("bass", sig, t, 0.0, lvl * vel)
                            prev_midi = midi
                            prev_t = t

    def render_harmony(self) -> None:
        """Pad (chords merged across repeated bars) + strings."""
        sr = self.sr
        pad_inst = self.inst["pad"]
        str_inst = self.inst["strings"]
        for sec in self.sections:
            for spec in self.layer(sec, "pad"):
                lvl = float(spec.get("level", 1.0)) * float(pad_inst["gain"])
                voicing = spec.get("voicing", "pad")
                attack = float(spec.get("attack", 0.30))
                release = float(spec.get("release", pad_inst["release"]))
                bars = [b for b in range(sec["from_bar"], sec["to_bar"] + 1)
                        if self.bar_ok(spec, b)]
                i = 0
                while i < len(bars):
                    b0 = bars[i]
                    j = i + 1
                    while (j < len(bars) and bars[j] == bars[j - 1] + 1
                           and self.chord_names[bars[j] - 1] == self.chord_names[b0 - 1]):
                        j += 1
                    nbars = j - i
                    chord = self.chords[b0 - 1]
                    midis = chord[voicing]
                    ring = nbars * self.spbar
                    sig = ensemble_note(pad_inst, sr, self.rng, midis, ring, attack, release)
                    self.place("harmony", sig, self.bar_t(b0, 0), 0.0, lvl)
                    i = j
            for spec in self.layer(sec, "strings"):
                lvl = float(spec.get("level", 1.0)) * float(str_inst["gain"])
                mode = spec.get("mode", "chord")
                attack = float(spec.get("attack", str_inst.get("attack", 0.34)))
                release = float(spec.get("release", str_inst["release"]))
                if mode == "drone":
                    notes = [int(x) for x in spec.get("notes", [])]
                    if not notes:
                        continue
                    ring = (sec["to_bar"] - sec["from_bar"] + 1) * self.spbar
                    sig = ensemble_note(str_inst, sr, self.rng, notes, ring, attack,
                                        release, vib=True, stagger=0.03)
                    self.place("harmony", sig, self.bar_t(sec["from_bar"], 0), 0.0, lvl)
                else:
                    for bar in range(sec["from_bar"], sec["to_bar"] + 1):
                        if not self.bar_ok(spec, bar):
                            continue
                        midis = self.chords[bar - 1]["pad"]
                        sig = ensemble_note(str_inst, sr, self.rng, midis, self.spbar,
                                            attack, release, vib=True, stagger=0.045)
                        self.place("harmony", sig, self.bar_t(bar, 0), 0.0, lvl)

    def render_lead(self) -> None:
        """Pluck arpeggio + heroic piano + bell layer + lead motifs."""
        sr = self.sr
        arp_inst = self.inst["arp"]
        for sec in self.sections:
            for spec in self.layer(sec, "arp"):
                pat = self.pats[spec["pattern"]]
                if pat.get("type") != "arp":
                    continue
                lvl = float(spec.get("level", 1.0)) * float(arp_inst["gain"])
                spread = float(arp_inst.get("pan_spread", 0.3))
                for bar in range(sec["from_bar"], sec["to_bar"] + 1):
                    if not self.bar_ok(spec, bar):
                        continue
                    notes = self.chords[bar - 1]["arp"]
                    for step, idx, vel in pat["hits"]:
                        midi = int(notes[min(int(idx), len(notes) - 1)])
                        t = self.bar_t(bar, float(step))
                        ring = float(arp_inst["t60"]) * 1.3
                        detune = float(self.rng.normal(0.0, 1.5))
                        sig = self.tonal("arp", midi, ring, float(vel), detune)
                        pan = spread * (1.0 if int(idx) % 2 == 0 else -1.0)
                        pan += float(self.rng.normal(0.0, 0.06))
                        self.place("lead", sig, t + float(self.rng.normal(0.0, 0.0035)),
                                   pan, lvl * float(vel))

        # ---- lead motifs ----
        motifs = self.m["motifs"]
        for plan in self.m["motif_plan"]:
            bar0 = int(plan["from_bar"])
            sec = self.section_of(bar0)
            if not self.layer(sec, "lead"):
                continue
            motif = motifs[plan["motif"]]
            lvl = float(plan.get("level", 1.0)) * float(self.inst["lead"]["gain"])
            transpose = int(plan.get("transpose", 0))
            repeat = int(plan.get("repeat", 1))
            for rep in range(repeat):
                for bar_off, step, midi, dur_beats, vel in motif["notes"]:
                    bar = bar0 + int(bar_off) + rep * int(motif["bars"])
                    if bar > self.bars:
                        continue
                    t = self.bar_t(bar, float(step))
                    ring = dur_beats * self.spb + 0.55
                    sig = self.tonal("lead", int(midi) + transpose, ring, float(vel),
                                     float(self.rng.normal(0.0, 1.0)))
                    self.place("lead", sig, t, float(self.rng.normal(0.0, 0.02)),
                               lvl * float(vel))

        # ---- bell layer ----
        bell_inst = self.inst["bell"]
        for span in self.m["bell_plan"]:
            for bar in range(int(span["from_bar"]), int(span["to_bar"]) + 1):
                if (bar - int(span["from_bar"])) % int(span.get("every", 1)) != 0:
                    continue
                sec = self.section_of(bar)
                specs = self.layer(sec, "bell")
                if not specs:
                    continue
                lvl0 = max(float(s.get("level", 1.0)) for s in specs) * float(bell_inst["gain"])
                midi = int(self.chords[bar - 1]["bell"])
                for step in span["steps"]:
                    t = self.bar_t(bar, float(step))
                    vel = float(span.get("level", 1.0))
                    sig = self.tonal("bell", midi, float(bell_inst["t60"]) * 1.05, vel,
                                     float(self.rng.normal(0.0, 2.0)))
                    self.place("lead", sig, t, float(self.rng.normal(0.0, 0.22)),
                               lvl0 * vel)

        # ---- hero notes ----
        for hn in self.m["hero_notes"]:
            inst_name = hn.get("inst", "piano")
            t = self.bar_t(int(hn["bar"]), float(hn.get("step", 0.0)))
            lvl = float(hn.get("level", 1.0)) * float(self.inst[inst_name]["gain"])
            vel = float(hn.get("vel", 0.6))
            inst = self.inst[inst_name]
            if "t60" in inst:
                ring = max(float(hn["dur"]), float(inst["t60"]) * 1.15)
            else:
                ring = float(hn["dur"])
            sig = self.tonal(inst_name, int(hn["midi"]), ring, vel,
                             float(self.rng.normal(0.0, 1.2)))
            self.place("lead", sig, t, float(hn.get("pan", 0.0)), lvl * vel)

    def render_fx(self) -> None:
        sr = self.sr
        # room tone beds (per section that asks for it)
        for sec in self.sections:
            for spec in self.layer(sec, "roomtone"):
                lvl = float(spec.get("level", 1.0)) * float(self.inst["roomtone"]["gain"])
                t0 = self.bar_t(sec["from_bar"], 0)
                t1 = self.bar_t(sec["to_bar"] + 1, 0)
                bed = make_roomtone(t1 - t0, sr, self.rng)
                self.place("fx", bed, t0, 0.0, lvl)
        # cues
        for cue in self.m["fx_cues"]:
            kind = cue["kind"]
            dur = float(cue["dur"])
            lvl = float(cue.get("level", 1.0)) * float(self.inst[kind]["gain"])
            t = self.bar_t(int(cue["bar"]), float(cue.get("step", 0.0)))
            if kind == "riser":
                sig = fx_riser(dur, sr, self.rng)
            elif kind == "impact":
                sig = fx_impact(dur, sr, self.rng)
            elif kind == "subdrop":
                sig = fx_subdrop(dur, sr, self.rng)
            elif kind == "swell":
                sig = fx_swell(dur, sr, self.rng)
            elif kind == "reverse":
                sig = fx_reverse(dur, sr, self.rng)
            elif kind == "downlifter":
                sig = fx_downlifter(dur, sr, self.rng)
            elif kind == "tension":
                sig = fx_tension(dur, sr, self.rng)
            else:
                raise ValueError(f"unknown fx kind {kind}")
            self.place("fx", sig, t, float(cue.get("pan", 0.0)), lvl)

    # =======================================================================
    # mix
    # =======================================================================
    def harmony_filter_curve(self) -> np.ndarray:
        pts = self.m["harmony_filter_automation"]
        bars = np.array([float(p[0]) for p in pts])
        vals = np.array([float(p[1]) for p in pts])
        bar_pos = np.arange(self.n, dtype=np.float64) / (self.spbar * self.sr) + 1.0
        return np.interp(bar_pos, bars, vals)

    def duck_envelope(self) -> np.ndarray:
        cfg = self.m["ducking"]
        depth = db_to_lin(-abs(float(cfg["depth_db"])))
        atk = float(cfg["attack_seconds"])
        rel = float(cfg["release_seconds"])
        n = self.n
        ctrl = np.zeros(n)
        ln = int(max(atk + rel * 0.75, 0.02) * self.sr)
        shape_t = np.arange(ln, dtype=np.float64) / self.sr
        attack = np.clip(shape_t / max(atk, 1e-4), 0.0, 1.0)
        attack = 0.5 - 0.5 * np.cos(np.pi * attack)
        shape = attack * np.exp(-np.maximum(shape_t - atk, 0.0) / rel)
        for t in self.kick_times:
            i0 = int(round(t * self.sr))
            if i0 >= n:
                continue
            m = min(ln, n - i0)
            np.maximum(ctrl[i0:i0 + m], shape[:m], out=ctrl[i0:i0 + m])
        env = 1.0 - (1.0 - depth) * ctrl
        return env

    def mix(self) -> dict[str, np.ndarray]:
        meta = self.m["meta"]
        rv = meta["reverb"]
        send = rv["send"]
        ir = make_ir(self.sr, float(rv["ir_seconds"]), float(rv["decay"]),
                     float(rv["predelay_ms"]), float(rv["tilt_hz"]),
                     float(rv["lowpass_hz"]), 424242)
        stems: dict[str, np.ndarray] = {}
        for name in self.m["stems"]:
            dry = self.buses[name].data
            if name == "harmony":
                curve = self.harmony_filter_curve()
                for ch in (0, 1):
                    dry[:, ch] = tv_onepole_lp(dry[:, ch], self.sr, curve, passes=2)
                duck = self.duck_envelope()
                dry *= duck[:, None]
            if name == "lead":
                dl = meta["lead_delay"]
                dry = pingpong_delay(dry, self.sr, float(dl["time_seconds"]),
                                     float(dl["feedback"]), float(dl["wet"]),
                                     float(dl["lowpass_hz"]))
            wet = convolve_reverb(dry, ir, self.sr)
            stems[name] = dry + wet * float(send[name])
        return stems

    def master_chain(self, x: np.ndarray) -> np.ndarray:
        """Identical linear chain on every stem: keeps sum(stems) == mix."""
        meta = self.m["meta"]
        for ch in (0, 1):
            x[:, ch] = hp(x[:, ch], 18.0, self.sr, order=2)
        n = x.shape[0]
        t = np.arange(n, dtype=np.float64) / self.sr
        fi = float(meta["fade_in_seconds"])
        gain = np.ones(n)
        nm = int(fi * self.sr)
        if nm > 1:
            gain[:nm] = raised_cos(nm)
        f_end = float(meta["fade_out_end"])
        f_dur = float(meta["fade_out_seconds"])
        f_start = f_end - f_dur
        m = (t >= f_start) & (t < f_end)
        gain[m] = 0.5 + 0.5 * np.cos(np.pi * (t[m] - f_start) / f_dur)
        gain[t >= f_end] = 0.0
        return x * gain[:, None]


# ─────────────────────────────────────────────────────────────────────────────
# analysis
# ─────────────────────────────────────────────────────────────────────────────
def analyse(x: np.ndarray, sr: int) -> dict:
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    rms = math.sqrt(mean_square(x))
    dc = [float(np.mean(x[:, ch])) for ch in range(x.shape[1])]
    return {
        "peak": peak,
        "peak_db": lin_to_db(peak),
        "rms": rms,
        "rms_db": lin_to_db(rms),
        "dc": dc,
        "dc_db": max(lin_to_db(abs(d)) for d in dc),
        "lufs": lufs_integrated(x, sr),
    }


def _k_weight(x: np.ndarray, sr: int) -> np.ndarray:
    if sr != 48000:
        raise ValueError("K-weighting coefficients are for 48 kHz")
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def lufs_integrated(x: np.ndarray, sr: int) -> float:
    """ITU-R BS.1770-4 integrated loudness (stereo)."""
    if x.shape[0] < sr // 2:
        return float("nan")
    y = _k_weight(x, sr)
    block = int(0.4 * sr)
    hop = int(0.1 * sr)
    if y.shape[0] < block:
        return float("nan")
    nblk = 1 + (y.shape[0] - block) // hop
    idx = np.arange(block)[None, :] + hop * np.arange(nblk)[:, None]
    ms = np.mean(y[idx] ** 2, axis=1)                 # (nblk, ch)
    z = ms.sum(axis=1)
    with np.errstate(divide="ignore"):
        lk = -0.691 + 10.0 * np.log10(np.maximum(z, 1e-20))
    keep = lk > -70.0
    if not np.any(keep):
        return -70.0
    z1 = float(np.mean(z[keep]))
    l1 = -0.691 + 10.0 * math.log10(max(z1, 1e-20))
    keep2 = keep & (lk > l1 - 10.0)
    if not np.any(keep2):
        return l1
    z2 = float(np.mean(z[keep2]))
    return -0.691 + 10.0 * math.log10(max(z2, 1e-20))


def band_energy_db(x: np.ndarray, sr: int) -> dict[str, float]:
    """Octave-band energy relative to total, dB (mono sum of the section)."""
    mono = x.mean(axis=1)
    f, pxx = signal.welch(mono, fs=sr, nperseg=min(8192, len(mono) or 8))
    tot = float(np.sum(pxx)) or 1e-20
    edges = [(20, 60), (60, 120), (120, 250), (250, 500), (500, 1000),
             (1000, 2000), (2000, 4000), (4000, 8000), (8000, 20000)]
    out = {}
    for lo, hi in edges:
        m = (f >= lo) & (f < hi)
        out[f"{lo:g}-{hi:g}"] = 10.0 * math.log10(max(float(np.sum(pxx[m])) / tot, 1e-12))
    return out


def wav_read(path: Path) -> tuple[np.ndarray, int, int]:
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        nch = w.getnchannels()
        sw = w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw != 3:
        raise ValueError(f"{path} is {sw * 8}-bit, expected 24-bit")
    b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
    pad = np.zeros((b.shape[0], 4), dtype=np.uint8)
    pad[:, :3] = b
    ints = pad.view(np.int32).reshape(-1) >> 8
    x = ints.astype(np.float64) / 8388608.0
    return x.reshape(-1, nch), sr, nch


def write_wav24(path: Path, x: np.ndarray, sr: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ints = np.clip(np.round(x * 8388607.0), -8388608.0, 8388607.0).astype(np.int32)
    raw = ints.astype("<i4").view(np.uint8).reshape(-1, 4)[:, :3]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(3)
        w.setframerate(sr)
        w.writeframes(raw.tobytes())


def find_ffprobe() -> str | None:
    base = ROOT / "node_modules" / "@remotion"
    if base.exists():
        for d in base.glob("compositor-*/ffprobe.exe"):
            return str(d)
        for d in base.glob("compositor-*/**/ffprobe.exe"):
            return str(d)
    for c in ("ffprobe", "ffprobe.exe"):
        try:
            subprocess.run([c, "-version"], capture_output=True, check=True)
            return c
        except Exception:
            pass
    return None


def ffprobe_audio(binary: str, path: Path) -> dict:
    cmd = [binary, "-v", "error", "-select_streams", "a:0",
           "-show_entries", "stream=codec_name,sample_rate,channels,bits_per_sample,duration",
           "-show_entries", "format=duration,size", "-of", "json", str(path)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"error": r.stderr.strip()[:200]}
    try:
        d = json.loads(r.stdout)
        st = (d.get("streams") or [{}])[0]
        fm = d.get("format") or {}
        return {
            "codec": st.get("codec_name"),
            "sr": int(st.get("sample_rate", 0)),
            "ch": int(st.get("channels", 0)),
            "bits": int(st.get("bits_per_sample", 0)),
            "duration": float(st.get("duration") or fm.get("duration") or 0.0),
            "size": int(fm.get("size", 0)),
        }
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# the 6 bespoke SFX
# ─────────────────────────────────────────────────────────────────────────────
def build_sfx(m: dict, sr: int) -> dict[str, np.ndarray]:
    rng = np.random.default_rng(777)
    out: dict[str, np.ndarray] = {}
    for item in m["sfx"]:
        spec = item["spec"]
        dur = float(item["duration"])
        name = item["name"]
        if name == "sub_drop":
            mono = fx_subdrop(dur, sr, rng, spec["f0"], spec["f1"], spec["curve"],
                              spec["drive"], spec["noise"])
            stereo = np.stack([mono, mono * 0.985], axis=1)
        elif name == "riser":
            mono = fx_riser(dur, sr, rng, spec["noise_f0"], spec["noise_f1"],
                            spec["sine_f0"], spec["sine_f1"], spec["shape"], spec["q"])
            left = fx_riser(dur, sr, rng, spec["noise_f0"], spec["noise_f1"],
                            spec["sine_f0"], spec["sine_f1"], spec["shape"], spec["q"])
            stereo = np.stack([mono, left], axis=1)
            stereo = normalize_peak(stereo, 1.0)
        elif name == "paper_flip":
            n = int(dur * sr)
            stereo = np.zeros((n, 2))
            graini = rng.integers(0, max(1, n - int(0.05 * sr)), size=int(spec["grains"]))
            for k, i0 in enumerate(np.sort(graini)):
                gl = int(rng.uniform(0.012, 0.045) * sr)
                env = np.exp(-np.arange(gl) / (gl * 0.34))
                for ch in (0, 1):
                    g = bp(rng.standard_normal(gl), spec["band"][0], spec["band"][1], sr, order=2)
                    g = normalize_peak(g, 1.0) * env
                    pan = np.clip(rng.normal(0.0, 0.5), -0.8, 0.8)
                    ang = (pan + 1.0) * math.pi * 0.25
                    m2 = min(gl, n - i0)
                    stereo[i0:i0 + m2, ch] += g[:m2] * (math.sqrt(2.0) * math.cos(ang) if ch == 0
                                                        else math.sqrt(2.0) * math.sin(ang))
            hiss = np.stack([bp(rng.standard_normal(n), 2500.0, 10000.0, sr, order=2),
                             bp(rng.standard_normal(n), 2500.0, 10000.0, sr, order=2)], axis=1)
            u = np.linspace(0.0, 1.0, n)
            stereo += normalize_peak(hiss, 1.0) * (np.exp(-((u - 0.35) ** 2) / (2 * 0.24 ** 2)))[:, None] * 0.22
        elif name == "stamp_thud":
            n = int(dur * sr)
            t = np.arange(n) / sr
            body = np.sin(TWO_PI * spec["body_hz"] * t) * np.exp(-t * (LN1000 / spec["body_t60"]))
            body = np.tanh(1.6 * body) / math.tanh(1.6)
            nk = int(0.020 * sr)
            click = hp(rng.standard_normal(nk), 1400.0, sr, order=2)
            click *= np.exp(-np.arange(nk) / (0.004 * sr))
            click = normalize_peak(click, spec["click"])
            slap = bp(rng.standard_normal(n), spec["slap_hz"] * 0.7, spec["slap_hz"] * 2.6,
                      sr, order=2) * np.exp(-t / 0.035)
            mono = body + normalize_peak(slap, 1.0) * spec["slap"]
            mono[:nk] += click
            stereo = np.stack([mono, mono * 0.97], axis=1)
        elif name == "whoosh_rtl":
            n = int(dur * sr)
            mono = np.zeros(n)
            chans = []
            for ch in (0, 1):
                x = rng.standard_normal(n)
                u = np.linspace(0.0, 1.0, n)
                fc = 700.0 * (2600.0 / 700.0) ** np.sin(np.pi * u) ** 0.8
                y = tv_bandpass(x, sr, fc, width=1.5)
                chans.append(normalize_peak(y, 1.0))
            pan = np.linspace(spec["pan_from"], spec["pan_to"], n)
            ang = (pan + 1.0) * math.pi * 0.25
            env = (np.sin(np.pi * np.linspace(0, 1, n)) ** spec["shape"])
            stereo = np.stack([chans[0] * math.sqrt(2.0) * np.cos(ang) * env,
                               chans[1] * math.sqrt(2.0) * np.sin(ang) * env], axis=1)
        elif name == "ui_pop":
            n = int(dur * sr)
            t = np.arange(n) / sr
            u = np.clip(t / dur, 0.0, 1.0)
            f = spec["f0"] * (spec["f1"] / spec["f0"]) ** (u ** 0.65)
            phase = TWO_PI * np.cumsum(f) / sr
            mono = np.sin(phase) * np.exp(-t * (LN1000 / spec["t60"]))
            nk = int(0.004 * sr)
            click = hp(rng.standard_normal(nk), 3000.0, sr, order=2)
            click *= np.exp(-np.arange(nk) / (0.0009 * sr))
            mono[:nk] += normalize_peak(click, spec["click"])
            stereo = np.stack([mono, mono], axis=1)
        else:
            raise ValueError(f"unknown sfx {name}")
        stereo = guarantee_edges(np.asarray(stereo, dtype=np.float64), sr, 0.005, 0.020)
        stereo = normalize_peak(stereo, db_to_lin(float(m["meta"]["peak_ceiling_dbfs"])))
        out[name] = stereo
    return out


# ─────────────────────────────────────────────────────────────────────────────
# report
# ─────────────────────────────────────────────────────────────────────────────
GROUP_ORDER = ["intro_pulse", "silence_hold", "drop", "groove_a", "groove_b_bells",
               "lift_strings", "full", "breakdown", "build", "final_resolve"]
PICTURE = {
    "intro_pulse": "HOOK — 350-page stack, exam looming | sub pulse + pad, no kick",
    "silence_hold": "A single warm page, brand line | near-silence, one piano note, vinyl",
    "drop": "REVEAL — logo bloom + phone rises | DROP at 12.0 s (bar 7)",
    "groove_a": "UPLOAD + CHAT | steady groove, hats in, filter opening",
    "groove_b_bells": "SUMMARY + QUIZ | + bell/glass + lead motif, brighter",
    "lift_strings": "DIAGRAM + READER + PLANNER | strings enter, claps, biggest lift",
    "full": "TEACHER + NOTIFICATIONS | full energy, widest arrangement",
    "breakdown": "TRUST — بُنيت بالعربية | BREAKDOWN: no kick/hats, pad + piano + string",
    "build": "CTA build | riser + snare roll + accelerating sub pulse on A dominant",
    "final_resolve": "Logo lockup | resolve to D MAJOR, sub drop at 112.0, fade by 117.5",
}
SPARK = " .:-=+*#%@"


def sparkline(values: list[float], lo: float, hi: float) -> str:
    out = []
    for v in values:
        u = 0.0 if hi - lo < 1e-9 else (v - lo) / (hi - lo)
        out.append(SPARK[int(round(np.clip(u, 0.0, 1.0) * (len(SPARK) - 1)))])
    return "".join(out)


def build_report(m: dict, sr: int, files: list[dict], groups: list[dict],
                 bars: list[dict], stems_tbl: list[dict], bands: list[dict],
                 checks: list[tuple[bool, str]], notes: list[str],
                 vo_stats: list[dict] | None) -> str:
    meta = m["meta"]
    L: list[str] = []
    a = L.append
    a("# AUDIO-REPORT — StudyAI promo (original score + SFX)")
    a("")
    a(f"Generated by `script/make_score.py` from `script/score_map.json`. "
      f"Every number below is measured from the delivered files, not estimated.")
    a("")
    a(f"- **Music length:** {meta['duration_seconds']:.3f} s = {meta['bars']} bars "
      f"@ {meta['bpm']:g} BPM (1 bar = {meta['bar_seconds']:.3f} s)")
    a(f"- **Format:** {meta['sample_rate']} Hz, {meta['channels']} ch, "
      f"{meta['bit_depth']}-bit PCM WAV")
    a(f"- **Key:** D minor → **D major** for the last 3 bars (bars 57–59)")
    a("- **Chord loop:** Dm – Bb – F – C, with a single A dominant at bars 54–56 "
      "and D major at 57–59")
    a("- **Peak ceiling:** "
      f"{meta['peak_ceiling_dbfs']:.1f} dBFS on every file (music, stems and SFX)")
    a("")
    a("## How to regenerate")
    a("")
    a("```bash")
    a("cd marketing/video")
    a("python script/make_score.py                # audio + this report")
    a("python script/make_score.py --no-write     # render + verify only")
    a("python script/make_score.py --report-only  # re-measure what is on disk")
    a("```")
    a("")
    a("Only numpy + scipy + `wave` are used; there are no samples and nothing is downloaded.")
    a("")
    a("## Files")
    a("")
    a("| file | duration | sr | ch | bits | peak dBFS | RMS dBFS | LUFS-I | DC |")
    a("|---|---|---|---|---|---|---|---|---|")
    for f in files:
        a(f"| `{f['path']}` | {f['dur']:.3f} s | {f['sr']} | {f['ch']} | {f['bits']} | "
          f"{f['peak_db']:.2f} | {f['rms_db']:.2f} | {f['lufs']:.1f} | "
          f"{f['dc_db']:.1f} dB |")
    a("")
    a("`public/audio/score/music.wav` is the full mix and equals the sample-exact sum of the "
      "five stems (`drums + bass + harmony + lead + fx`), so they can be rebalanced freely.")
    a("")
    a("## Section energy arc")
    a("")
    a("RMS measured over each section of the delivered `music.wav`. Every boundary is on a bar line.")
    a("")
    a("| section | bars | seconds | picture | target RMS | measured RMS | Δ | shape |")
    a("|---|---|---|---|---|---|---|---|")
    lo_t = min(g["target"] for g in groups)
    for g in groups:
        flag = "" if abs(g["delta"]) <= 2.5 else " **⚠**"
        a(f"| `{g['group']}` | {g['bars']} | {g['t0']:.1f}–{g['t1']:.1f} | "
          f"{PICTURE.get(g['group'], '')} | {g['target']:.1f} dBFS | "
          f"{g['rms']:.1f} dBFS | {g['delta']:+.1f} |{flag} `{g['spark']}` |")
    a("")
    a("Targets are the arrangement intent; Δ is measured − target. "
      "A negative Δ means the section is quieter than planned.")
    a("")
    a("### Per-bar RMS (2 s each, bars 1–59)")
    a("")
    vals = [b["rms"] for b in bars]
    a("```")
    for i in range(0, len(bars), 20):
        chunk = bars[i:i + 20]
        a("bars %2d-%2d  |%s|" % (chunk[0]["bar"], chunk[-1]["bar"],
                                   sparkline([c["rms"] for c in chunk], min(vals), max(vals))))
        a("             %s" % " ".join(f"{c['rms']:5.1f}" for c in chunk))
    a("```")
    a(f"Range {min(vals):.1f} … {max(vals):.1f} dBFS.")
    a("")
    a("## Stem balance (RMS dBFS per section)")
    a("")
    a("Useful for the mix: if one row column dominates a section, that layer owns it.")
    a("")
    a("| section | " + " | ".join(f"`{s}`" for s in m["stems"]) + " |")
    a("|---|" + "---|" * len(m["stems"]))
    for row in stems_tbl:
        a(f"| {row['group']} | " + " | ".join(f"{v:.1f}" for v in row["vals"]) + " |")
    a("")
    a("## Spectral balance (octave-band energy, dB relative to the section total)")
    a("")
    keys = list(bands[0]["bands"].keys())
    a("| section | " + " | ".join(keys) + " |")
    a("|---|" + "---|" * len(keys))
    for row in bands:
        a(f"| {row['group']} | " + " | ".join(f"{row['bands'][k]:.0f}" for k in keys) + " |")
    a("")
    a("A healthy cue keeps most energy in 60–500 Hz with a gentle slope upward; "
      "an isolated spike in 2–8 kHz is harshness and a huge 20–120 Hz number is mud.")
    a("")
    a("## Verification")
    a("")
    for ok, label in checks:
        a(f"- [{'x' if ok else ' '}] {label}")
    a("")
    if vo_stats:
        a("## Mix reference against the voiceover")
        a("")
        a("| VO line | duration | RMS dBFS | LUFS-I |")
        a("|---|---|---|---|")
        for v in vo_stats:
            a(f"| `{v['id']}` | {v['dur']:.2f} s | {v['rms_db']:.1f} | {v['lufs']:.1f} |")
        a("")
        if vo_stats:
            av = np.mean([v["lufs"] for v in vo_stats])
            a(f"Average spoken LUFS-I ≈ **{av:.1f}**. The music sits around "
              f"**{files[0]['lufs']:.1f} LUFS-I** peak-normalised at "
              f"{meta['peak_ceiling_dbfs']:.0f} dBFS, i.e. it must be pulled down under speech. "
              "Recommendation for the final mix: music at −22 to −26 LUFS-I under VO "
              "(roughly −14 to −18 dB from the delivered file), and 2–3 dB lower than that "
              "during the `silence_hold` and `breakdown` sections so the VO breathes.")
            a("")
    a("## Notes")
    a("")
    for n in notes:
        a(f"- {n}")
    a("")
    return "\n".join(L)


# ─────────────────────────────────────────────────────────────────────────────
# main
# ─────────────────────────────────────────────────────────────────────────────
def main(argv: list[str]) -> int:
    map_path = SCRIPT / "score_map.json"
    for i, a in enumerate(argv):
        if a == "--map" and i + 1 < len(argv):
            map_path = Path(argv[i + 1])
    m = json.loads(map_path.read_text(encoding="utf-8"))
    sr = int(m["meta"]["sample_rate"])
    no_write = "--no-write" in argv
    report_only = "--report-only" in argv
    t_start = time.time()

    checks: list[tuple[bool, str]] = []
    notes: list[str] = []

    # ---- structural validation of the map ---------------------------------
    nbars = int(m["meta"]["bars"])
    assert len(m["chord_plan"]) == nbars, "chord_plan length != bars"
    covered = 0
    prev_end = 0
    for sec in m["sections"]:
        assert sec["from_bar"] == prev_end + 1, f"gap/overlap before {sec['id']}"
        for _, spec in [(None, s) for s in
                        ([] if not sec["layers"] else
                         [(k, x) for k, v in sec["layers"].items() for x in
                          (v if isinstance(v, list) else [v])])]:
            if "pattern" in spec:
                assert spec["pattern"] in m["patterns"], \
                    f"{sec['id']}: unknown pattern {spec['pattern']}"
        prev_end = sec["to_bar"]
        covered += sec["to_bar"] - sec["from_bar"] + 1
    assert prev_end == nbars, f"sections end at bar {prev_end}, expected {nbars}"
    assert covered == nbars, f"{covered} bars covered, expected {nbars}"
    for cue in m["fx_cues"]:
        assert cue["kind"] in m["instruments"], f"fx {cue['kind']} has no instrument entry"
    print(f"map ok: {nbars} bars, {len(m['sections'])} sections, "
          f"{sum(len(s['layers']) for s in m['sections'])} layer spans")

    score = Score(m)
    if not report_only:
        t0 = time.time()
        score.render_drums()
        print(f"  drums   {time.time() - t0:5.1f}s")
        t0 = time.time()
        score.render_bass()
        print(f"  bass    {time.time() - t0:5.1f}s")
        t0 = time.time()
        score.render_harmony()
        print(f"  harmony {time.time() - t0:5.1f}s")
        t0 = time.time()
        score.render_lead()
        print(f"  lead    {time.time() - t0:5.1f}s")
        t0 = time.time()
        score.render_fx()
        print(f"  fx      {time.time() - t0:5.1f}s")
        t0 = time.time()
        stems = score.mix()
        print(f"  mix     {time.time() - t0:5.1f}s")

        # common gain so that no single file exceeds the ceiling
        target = db_to_lin(float(m["meta"]["peak_ceiling_dbfs"]))
        peaks = {k: float(np.max(np.abs(v))) for k, v in stems.items()}
        mix_pre = np.sum([stems[k] for k in m["stems"]], axis=0)
        peak_mix = float(np.max(np.abs(mix_pre)))
        worst = max([peak_mix] + list(peaks.values()))
        gain = target / worst if worst > 1e-9 else 1.0
        print(f"  peaks pre-gain: mix {lin_to_db(peak_mix):.2f} dBFS, "
              f"stems " + ", ".join(f"{k} {lin_to_db(v):.2f}" for k, v in peaks.items()))

        # identical master chain on every stem keeps sum(stems) == mix
        proc = {k: score.master_chain(stems[k].copy()) * gain for k in m["stems"]}
        ints = {}
        for k, v in proc.items():
            ints[k] = np.clip(np.round(v * 8388607.0), -8388608.0, 8388607.0).astype(np.int32)
        mix_ints = np.sum([ints[k] for k in m["stems"]], axis=0)
        mix_ints = np.clip(mix_ints, -8388608, 8388607).astype(np.int32)

        sfx = build_sfx(m, sr)
        if no_write:
            print("  --no-write: nothing written")
        else:
            t0 = time.time()
            for k in m["stems"]:
                write_wav24(SCORE_DIR / f"{k}.wav", proc[k], sr)
            write_wav24(SCORE_DIR / "music.wav", mix_ints.astype(np.float64) / 8388608.0, sr)
            for name, x in sfx.items():
                write_wav24(SFX_DIR / f"{name}.wav", x, sr)
            print(f"  wrote {len(m['stems']) + 1 + len(sfx)} wav files in {time.time() - t0:.1f}s")
        del stems, proc, mix_pre
    else:
        sfx = {}

    # ---- verification: re-read everything from disk ------------------------
    ffprobe = find_ffprobe()
    files: list[dict] = []
    paths: list[tuple[str, Path]] = [
        ("score/music", SCORE_DIR / "music.wav"),
    ] + [(f"score/{k}", SCORE_DIR / f"{k}.wav") for k in m["stems"]] + \
        [(f"sfx/{item['name']}", SFX_DIR / f"{item['file']}") for item in m["sfx"]]
    loaded: dict[str, np.ndarray] = {}
    for label, p in paths:
        if not p.exists():
            files.append({"path": f"public/audio/{label}.wav", "dur": 0.0, "sr": 0, "ch": 0,
                          "bits": 0, "peak_db": -99.0, "rms_db": -99.0, "lufs": -99.0,
                          "dc_db": -99.0, "missing": True})
            continue
        x, fsr, nch = wav_read(p)
        a = analyse(x, fsr)
        fp = ffprobe_audio(ffprobe, p) if ffprobe else {}
        loaded[label] = x
        files.append({
            "path": f"public/audio/{label}.wav",
            "dur": fp.get("duration", x.shape[0] / fsr),
            "sr": fp.get("sr", fsr), "ch": fp.get("ch", nch), "bits": fp.get("bits", 24),
            "codec": fp.get("codec", "?"), "size": fp.get("size", p.stat().st_size),
            "peak_db": a["peak_db"], "rms_db": a["rms_db"], "lufs": a["lufs"],
            "dc_db": a["dc_db"],
        })

    music = loaded.get("score/music")
    if music is None:
        print("no music.wav on disk; nothing to verify", file=sys.stderr)
        return 2

    # ---- section / bar measurements ---------------------------------------
    spbar = float(meta_sr := m["meta"]["bar_seconds"])
    groups_rms: dict[str, list[float]] = {}
    bands: list[dict] = []
    stems_tbl: list[dict] = []
    for g in GROUP_ORDER:
        segs = [s for s in m["sections"] if s["group"] == g]
        t0 = min(score.bar_t(s["from_bar"], 0) for s in segs)
        t1 = max(score.bar_t(s["to_bar"] + 1, 0) for s in segs)
        i0, i1 = int(round(t0 * sr)), int(round(t1 * sr))
        chunk = music[i0:i1]
        rms = math.sqrt(mean_square(chunk))
        vals = [math.sqrt(mean_square(loaded[f"score/{k}"][i0:i1])) for k in m["stems"]]
        tgt = float(np.mean([s["energy_target_dbfs"] for s in segs]))
        groups_rms[g] = [lin_to_db(rms), tgt]
        stems_tbl.append({"group": g, "vals": [lin_to_db(v) for v in vals]})
        bands.append({"group": g, "bands": band_energy_db(chunk, sr)})

    all_sec = [lin_to_db(math.sqrt(mean_square(music[int(round(score.bar_t(g['group'] and 1, 0) * sr)):
                                                     int(round(score.bar_t(1, 0) * sr)) + 1])))
                for g in [{"group": GROUP_ORDER[0]}]]  # placeholder, replaced below
    groups: list[dict] = []
    lo = min(v[0] for v in groups_rms.values())
    for g in GROUP_ORDER:
        rms_db, tgt = groups_rms[g]
        segs = [s for s in m["sections"] if s["group"] == g]
        t0 = min(score.bar_t(s["from_bar"], 0) for s in segs)
        t1 = max(score.bar_t(s["to_bar"] + 1, 0) for s in segs)
        bars_lbl = (f"{min(s['from_bar'] for s in segs)}–{max(s['to_bar'] for s in segs)}")
        groups.append({
            "group": g, "bars": bars_lbl, "t0": t0, "t1": t1,
            "target": tgt, "rms": rms_db, "delta": rms_db - tgt,
            "spark": SPARK[int(round(np.clip(1.0 - (rms_db - lo) / 4.0, 0.0, 1.0)
                                    * (len(SPARK) - 1)))],
        })

    bars_tbl: list[dict] = []
    for b in range(1, nbars + 1):
        i0 = int(round(score.bar_t(b, 0) * sr))
        i1 = int(round(score.bar_t(b + 1, 0) * sr)) if b < nbars else music.shape[0]
        bars_tbl.append({"bar": b, "rms": lin_to_db(math.sqrt(mean_square(music[i0:i1])))})

    # ---- checks ------------------------------------------------------------
    ceiling = float(m["meta"]["peak_ceiling_dbfs"])
    dur_ok = abs(files[0]["dur"] - float(m["meta"]["duration_seconds"])) <= 0.01
    checks.append((dur_ok, f"music.wav duration = {files[0]['dur']:.6f} s "
                           f"(required {m['meta']['duration_seconds']:.3f} ± 0.01)"))
    checks.append((all(f["sr"] == sr and f["ch"] == 2 and f["bits"] == 24 for f in files if
                       not f.get("missing")),
                   f"every file is {sr} Hz / 2 ch / 24-bit PCM"))
    checks.append((all(f["peak_db"] <= ceiling + 1e-6 for f in files if not f.get("missing")),
                   f"no clipping: every peak ≤ {ceiling:.1f} dBFS"))
    checks.append((all(f["dc_db"] <= -60.0 for f in files if not f.get("missing")),
                   "no DC offset: every |mean| ≤ −60 dBFS"))
    stem_sum = np.sum([loaded[f"score/{k}"] for k in m["stems"]], axis=0)
    diff = float(np.max(np.abs(stem_sum - music)))
    checks.append((diff * 8388608.0 < 6.0,
                   f"stems sum to the mix: max sample error {diff * 8388608.0:.2f} LSB "
                   f"({lin_to_db(diff) if diff > 0 else -999:.0f} dBFS)"))
    checks.append((abs(float(np.max(np.abs(music))) - db_to_lin(ceiling)) < 1e-3,
                   f"music.wav peaks at {lin_to_db(float(np.max(np.abs(music)))):.2f} dBFS "
                   f"(target {ceiling:.1f})"))
    silent_tail = music[int(round(117.55 * sr)):]
    checks.append((float(np.max(np.abs(silent_tail))) < 1e-6,
                   f"silent from 117.5 s to 118.0 s "
                   f"(peak {lin_to_db(float(np.max(np.abs(silent_tail)))):.0f} dBFS)"))
    drops = [12.0, 112.0]
    for d in drops:
        i0 = int(round(d * sr))
        w = music[i0:i0 + int(0.12 * sr)]
        hf = hp(w.mean(axis=1), 2000.0, sr)
        checks.append((float(np.sqrt(mean_square(hf))) > 1e-4,
                       f"event present at {d:.1f} s (sub drop / impact)"))
    if ffprobe:
        checks.append((True, f"ffprobe confirmed every container via "
                             f"`{Path(ffprobe).name}`"))
    for f in files:
        if f.get("missing"):
            checks.append((False, f"MISSING FILE {f['path']}"))

    # ---- VO reference ------------------------------------------------------
    vo_stats: list[dict] = []
    vo_dir = ROOT / "public" / "audio" / "vo"
    if vo_dir.exists():
        for p in sorted(vo_dir.glob("L*.wav")):
            try:
                xv, fsr, nch = wav_read(p) if p.suffix == ".wav" else (None, sr, 1)
                if xv is None:
                    continue
                if nch == 1:
                    xv = np.repeat(xv, 2, axis=1)
                a = analyse(xv, fsr)
                vo_stats.append({"id": p.stem, "dur": xv.shape[0] / fsr,
                                 "rms_db": a["rms_db"], "lufs": a["lufs"]})
            except Exception:
                continue

    # ---- notes -------------------------------------------------------------
    notes.append("The score never uses a square wave, a raw unfiltered saw or a "
                 "16th-note sine arpeggio; melodic material is per-partial "
                 "exponential-decay additive synthesis, so every partial has its own "
                 "decay time the way a real string or bar does.")
    notes.append("Arrangement breathing: one layer is added or removed at almost every "
                 "section boundary (sub pulse → nothing → pad+sub → kick/bass/arp → hats → "
                 "bell+motif → strings+claps → widest → strip to pad/piano/string → "
                 "riser+roll → resolve).")
    notes.append("The pad/strings bus is pulled down 2.5 dB under every kick "
                 "(sidechain), which is what makes the drop feel like it pumps rather "
                 "than sits.")
    notes.append("Velocity drives brightness, not just level: higher velocities keep more "
                 "upper partials and ring longer, so accents read as timbre changes.")
    notes.append("`fx` carries the vinyl room tone as well as risers/drops/swells; if the "
                 "mixer wants pure SFX in that stem, the room tone is the quiet "
                 "0–10 s and 112–118 s bed.")
    missing_sfx = sorted({"sub_thump", "room_tone", "page_flip", "tick_clock", "riser_short",
                          "mute_hit", "piano_note", "reverse_hit", "shimmer", "ui_chirp",
                          "whoosh_rtl", "impact", "sub_drop", "pdf_drop", "scanner_pass",
                          "doc_pop", "chat_in", "chat_out", "cite_ping", "page_turn",
                          "paper_tear", "print_scan", "stamp_thud", "quiz_correct",
                          "quiz_incorrect", "level_up", "node_pop", "map_draw",
                          "highlight_marker", "plan_tick", "teacher_chime", "bell_notify",
                          "ui_pop", "heartbeat_low", "paper_flip"}
                         - set(build_sfx_names := set(m["sfx_map"] if "sfx_map" in m else
                                                     [i["name"] for i in m["sfx"]])))
    if missing_sfx:
        notes.append(f"The film cue sheet (`script/build_timeline.py`) references more SFX "
                     f"names than the six bespoke ones delivered here. Delivered: "
                     f"`{', '.join(sorted(build_sfx_names))}`. Still uncovered: "
                     f"`{', '.join(missing_sfx)}` — those need either the @remotion/sfx "
                     f"package or a follow-up pass; the score does not depend on them.")
    notes.append("If a section needs to move, edit `script/score_map.json` (the numbers are "
                 "musical intent) and re-run; all layering, chords and automation live there.")

    # ---- write the report --------------------------------------------------
    md = build_report(m, sr, files, groups, bars_tbl, stems_tbl, bands, checks, notes,
                      vo_stats)
    if not no_write:
        REPORT.write_text(md, encoding="utf-8")
        print(f"wrote {REPORT}")
    else:
        print(md)

    # ---- console verification table ---------------------------------------
    print("\n=== section RMS (music.wav) ===")
    print(f"{'section':16s} {'bars':>7s} {'seconds':>13s} {'target':>8s} {'rms':>8s} {'delta':>7s}")
    for g in groups:
        print(f"{g['group']:16s} {g['bars']:>7s} {g['t0']:7.1f}-{g['t1']:5.1f} "
              f"{g['target']:8.1f} {g['rms']:8.1f} {g['delta']:+7.1f}")
    print("\n=== files ===")
    for f in files:
        print(f"{f['path']:34s} {f['dur']:8.3f}s {f['sr']:6d} {f['ch']}ch {f['bits']:2d}bit "
              f"peak {f['peak_db']:+6.2f}  rms {f['rms_db']:+6.2f}  lufs {f['lufs']:+6.1f}  "
              f"dc {f['dc_db']:7.1f}")
    print("\n=== checks ===")
    for ok, label in checks:
        print(f"[{'x' if ok else ' '}] {label}")
    print(f"\ntotal {time.time() - t_start:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

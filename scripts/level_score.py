# -*- coding: utf-8 -*-
"""
Level the music bed so the score's own dynamics do not decide the mix.

The composed score swings from about -45 dBFS in the intro to -22 in the body.
Mixed under a voice-over that is a design bug: the first 25 s sound like there
is no music at all, and every gap between phrases drops to near silence.

Two stages, both slow enough to stay musical:
  1. auto-level  — RMS in 1.5 s windows towards -21 dBFS, gain limited to
                   [-7, +13] dB, then smoothed over ~3 s
  2. safety      — soft knee above 0.86 so the boosted intro cannot clip

Writes 16-bit 48 kHz stereo back to public/audio/score/music.wav and prints the
per-section RMS so the mix can be reasoned about with numbers.
"""
from __future__ import annotations

import struct
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "audio" / "score" / "music.wav"
BAK = ROOT / "public" / "audio" / "score" / "music.orig.wav"

TARGET_DB = -21.0
WIN_S = 1.5
GAIN_MIN, GAIN_MAX = -7.0, 13.0
SMOOTH_WIN = 3
KNEE = 0.86


def read_wav(path: Path) -> tuple[np.ndarray, int]:
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
    return v.reshape(-1, ch), sr


def write_wav(path: Path, x: np.ndarray, sr: int) -> None:
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def db(x: float) -> float:
    return float(20 * np.log10(max(1e-9, x)))


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}")
        return 1
    if not BAK.exists():
        BAK.write_bytes(SRC.read_bytes())
        print(f"backed up original -> {BAK.name}")

    src = BAK if BAK.exists() else SRC
    x, sr = read_wav(src)
    n = x.shape[0]
    mono = x.mean(axis=1)

    win = int(WIN_S * sr)
    hop = win // 2
    centres, gains = [], []
    for i in range(0, max(1, n - win), hop):
        seg = mono[i:i + win]
        rms = float(np.sqrt((seg ** 2).mean()))
        g = TARGET_DB - db(rms)
        g = max(GAIN_MIN, min(GAIN_MAX, g))
        centres.append(i + win / 2)
        gains.append(g)
    if not gains:
        gains, centres = [0.0], [n / 2]

    # smooth the gain curve so it never pumps
    k = np.ones(SMOOTH_WIN) / SMOOTH_WIN
    gains_s = np.convolve(np.pad(gains, (SMOOTH_WIN // 2, SMOOTH_WIN // 2), mode="edge"), k, mode="valid")

    curve = np.interp(np.arange(n), np.array(centres), gains_s)
    y = x * (10 ** (curve[:, None] / 20.0))

    # soft knee + peak normalise to -1.4 dBFS
    a = np.abs(y)
    over = a > KNEE
    if np.any(over):
        span = 1.0 - KNEE
        y[over] = np.sign(y[over]) * (KNEE + span * np.tanh((a[over] - KNEE) / span))
    peak = float(np.abs(y).max())
    if peak > 1e-9:
        y *= (10 ** (-1.4 / 20.0)) / peak

    write_wav(SRC, y, sr)
    print(f"wrote {SRC.name}  {n/sr:.2f}s  peak={db(float(np.abs(y).max())):.2f}dB  "
          f"rms={db(float(np.sqrt((y**2).mean()))):.2f}dB")

    step = int(7.375 * sr)
    for i in range(0, n, step):
        seg = y[i:i + step]
        if len(seg) > 1000:
            print(f"  {i/sr:5.1f}s rms={db(float(np.sqrt((seg**2).mean()))):6.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

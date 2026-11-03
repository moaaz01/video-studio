# Footage: talking head and clip factory

The studio's other forms draw every frame. These two start from a recording: a
camera, a podcast, or a screen capture with voice. The edit is measured, not
guessed: pauses come from the audio level, captions from the transcript, and
shorts from a score.

```bash
# 1. the recording lives under public/
python scripts/studio.py footage silence public/assets/talk/raw.mp4 --threshold -38   # -> film/edl.json
python scripts/studio.py footage transcribe public/assets/talk/raw.mp4 --lang ar      # -> film/transcript.json
python scripts/studio.py footage cut film/edl.json --out out/rough_cut.mp4            # optional: a quick jump-cut check

# 2a. talking head: one film, dressed
python scripts/studio.py footage beats film/edl.json --transcript film/transcript.json --out film/talk.json
python scripts/studio.py timeline --film film/talk.json --strict

# 2b. clip factory: several shorts from one long recording
python scripts/studio.py footage clips film/transcript.json --min 20 --max 55 --top 5  # -> film/clips.json
```

## What each step measures

- **silence**: RMS per 20 ms hop. A pause shorter than `--min-silence` (0.45 s)
  stays, because it is prosody. Each kept range breathes 80 ms on both sides.
  Ranges shorter than 0.25 s are dropped. The report gives seconds kept and removed.
  Raise `--threshold` toward -32 for a noisy room; lower it toward -45 for a quiet one.
- **transcribe**: faster-whisper (local, free) with word timestamps and VAD. If it
  is missing, `studio.py providers pick transcribe` names the cloud fallback.
- **clips**: every window that starts on a segment and lasts `--min` to `--max`
  seconds. The score adds three things: the hook in the first 8 words (a question,
  كيف/لماذا/سر/خطأ…, or a number), pace (2.2–3.2 words/s is comfortable), and a
  clean sentence ending. The picks never overlap. **Show `clips.json` to the user;
  the pipeline gate is their approval.**
- **beats**: one `footage` beat per kept range. Each beat carries `src`, `in`/`out`
  and the transcript words shifted to beat time.

## Dressing a `footage` beat (`src/scenes/Footage.tsx`)

| field | effect |
|---|---|
| `zoom[]` | `{at, scale, dur}` punch-ins; use one per idea, on the stressed word |
| `broll[]` | `{src, at, dur}` inserts over the speaker. The voice continues underneath. |
| `lowerThird` | `{title, sub, at, dur}`: the speaker's real name and role, once |
| `captions` | on by default. The active word is in the accent, with 3 words per page on 9:16 and 5 on 16:9. |
| `fit` | `cover` (crop to the canvas) or `contain` |

A footage film has `"format": "footage"` and beats in `seconds`, not bars: the cut
follows the speech, not the grid. Mix in `gfx` beats for the hook and the CTA. The
scene is pre-rolled like every other beat. It stays muted until its own frame,
then fades out under the hand-off, so jump cuts never double the audio.

Never re-stage what the person said. If a caption word is wrong, fix the
transcript, not the frame.

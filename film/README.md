# film/

The film's plan lives here, as data. Nothing in `src/` decides what the film says.

| File | What it is |
|---|---|
| `film.json` | The demo film: beats, `bars`, tone, on-screen copy, VO lines. |
| `brief.md` | Created by `studio.py new <slug>` — the one-page brief to fill before touching code. |
| `score.json` | Optional score map (sections, chords, layers) for `scripts/make_score.py`. Not shipped: see below. |
| `vo.json` | Created by `studio.py voice` from the `vo` lines — do not hand-edit. |

## Writing a beat

```json
{
  "id": "b02-device",
  "kind": "device",
  "bars": 5,
  "tone": "paper",
  "kicker": "الواجهة",
  "line1": "واجهةٌ حقيقية، بنفس أبعادها",
  "line2": "نفس الشاشات، ونفس التفاصيل، ونفس اللغة",
  "vo": ["كلُّ ما تراه في الفيديو\\، موجودٌ في التطبيق."]
}
```

- `bars` is the only timing control: one bar = 2.000 s at 120 BPM = 60 frames at 30 fps.
  Never write frames by hand; `make_timeline.py` derives them and refuses to compile
  if the measured VO plus 0.35 s of air does not fit.
- `kind` picks the scene component (`hook`, `device`, `stat`, `cta`).
- `vo` lines are vocalised Arabic (full tashkeel). `\،` is an Arabic comma — it is
  pronunciation, not punctuation decoration.
- `line1` is the claim; `line2` is the proof. If a beat needs a third line, it is
  two beats.

## Why the demo ships silent

`film_1080p.mp4` / `film_9x16.mp4` are **picture references**: they prove the engine,
the Arabic type, the device frame and the cut rhythm. They carry no audio track, so
`qa.py` reports them as `silent master` (a warning; `--require-audio` turns it into a
failure for deliverables).

Adding a bed is one command once a map exists:

```powershell
copy scripts/score_map.example.json film/score.json   # then rewrite it for this film
python scripts/studio.py score                        # 120 BPM bed + foley, levelled
python scripts/studio.py render
```

The example map is the **118-second StudyAI arrangement** (59 bars, D minor, four on
the floor, drops on the cuts) — it is a reference for the schema and a starting
point, not a drop-in for a 21-bar film. The audio path itself is proven: the shipped
StudyAI masters measure −2.15 dBFS peak / −22.21 RMS / 0 clipped samples with that
engine (see `examples/studyai/`).

Voice is separate from the bed: `studio.py voice` writes
`public/audio/vo/*.wav` + `src/generated/vo.json`, and `make_timeline.py --strict`
then checks the picture actually has room for the words.

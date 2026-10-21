# Voices — reuse the auditions, keep the diction

The film's voice is not a stock id any more. The four Shami auditions the user
called excellent are real Fish models now, cloned from their rendered probes, so
new copy can be recorded in the same voice instead of re-rolling a stranger's.

Catalogue (machine-readable): [`film/voices.json`](../film/voices.json).
This page is the reasoning, the method and the honest limits.

## The workflow

```powershell
# 0. once: the probe wavs live in out/vo-probe/, the key in .env (FISH_API_KEY)
$env:PYTHONIOENCODING = "utf-8"

# 1. clone a probe into a private voice model, print its reference id
python scripts/voice.py --clone out/vo-probe/shami-m-deep.wav --name "shami-m-deep"

# 2. record the script in that voice (per-line text + speed live in the script)
python scripts/voice.py --script projects/studyai-shami/vo-script.json

# 3. re-take one line without re-rolling the four that pass
python scripts/voice.py --script projects/studyai-shami/vo-script.json --only b04-stat-1

# 4. the gate: transcribe every delivered wav and compare it to the script
python scripts/voice_check.py --script projects/studyai-shami/vo-script.json --json out/qa/vo-asr-check.json
```

`--clone` POSTs multipart to `/model` (`type=tts`, `train_mode=fast`,
`visibility=private`, `enhance_audio_quality=true`); a fast-trained model comes back
`state=trained` and is usable as `reference_id` immediately. Fish also lets the same
model be inspected and renamed through `GET /model/{id}` and `PATCH /model/{id}`.

## What the user praised, and what it is now

The four probes are TTS renders, so they cannot be handed to Fish as references —
only a clone can. Each was cloned from the exact wav that was auditioned:

| audition | label | reference_id | register | pace |
|---|---|---|---|---|
| shami-m-deep | deep Shami male | `e2328a22742c40888b891ba66fc114fe` | 142 Hz | 2.3 w/s |
| shami-m-young | young Shami male | `6e03d5aa503644fbad84b1c19127d850` | 112 Hz | 2.1 w/s |
| syria-f-bright | bright Syrian female | `a66bdbae69a64906b5b75cd8d8775f36` | 194 Hz | 2.1 w/s |
| syrian-m-warm | warm Syrian male | `33e3262f79c143d795541efb55508590` | 111 Hz | 1.8 w/s |

Three further probes (Damascus male, Lebanese female, young Lebanese male) were
cloned the same way: `6e52d5af60ee4d27895a40db98f5b0cd`,
`baa6e6044edd4a199d5dc2b8f3b2f7f8`, `cdbc6170fc5a45cab5021b9186dbf8a9`.
A copy of every audition is committed under `audio/voices/` (44.1 kHz for the four
preferred, 16 kHz for the three extras, 2.2 MB total) so the catalogue is listenable
without touching the API.

Register is measured, not guessed: median F0 over contiguous voiced frames, 60–400
Hz autocorrelation band. It is accurate to about an octave, which is enough to say
"this is the deep one" and not enough to claim a note.

## The delivered cut

Voice: `shami-m-deep` (`e2328a…`), speed 0.95, no lead silence — the model already
starts each line with ~30 ms of clean air, so every take measures
`onset = −120 dBFS` and nothing is clipped at either end.

| beat | text actually synthesised | dur | +0.35 s | beat | ASR sim |
|---|---|---|---|---|---|
| b01-hook-1 | `مِن أوّل صَفْحة لآخِر امتِحان — بِتْفَهْمها مَرّة وَحدة.` | 4.117 s | 4.47 s | 6 s | 0.988 |
| b02-device-1 | `ارفع مِلَفّك PDF، وخَلِّي التطبيق يِشْتغِل عنك: يُلَخِّص، ويجاوب، ويِخْتَبِرك.` | 6.562 s | 6.91 s | 10 s | 0.964 |
| b03-device-1 | `اِسْأل أي شي بِبَساطة، وكل جَواب بيجيك مع رقم الصفحة اللي انطَلَق منها.` | 5.193 s | 5.54 s | 10 s | 0.992 |
| b04-stat-1 | `تلات خَطَوات بس: ارفع، اسأل، وافهم — والباقي علينا.` | 4.997 s | 5.35 s | 8 s | 0.953 |
| b05-cta-1 | `حَمِّل التطبيق من تيليجرام، مَجّانًا، وبَلَّش من أول صفحة عندك.` | 4.900 s | 5.25 s | 8 s | 0.990 |

Gate: `scripts/voice_check.py`, threshold 0.90 char similarity and ≤1 word delta —
5/5 pass, worst 0.953. Report: `out/qa/vo-asr-check.json`.

## Diction: what actually fixed the swallowed words

The complaint was that words carrying a shadda came out truncated, `يلخّص` most of
all. Three levers were tested per line — spelling, speed, lead air — and measured
with the ASR round-trip plus the waveform stats (`scripts/voice.py --measure`).

1. **Shadda plus its vowel, not the bare skeleton.** `خَلّي` (fatha on the shadda)
   was transcribed back as `وخلت تطبيق` — the model says "khallat", a different
   word. `خَلِّي` (kasra) came back as `وخل التطبيق`. Micro-audition files:
   `out/auditions/b02-device-1__refine_*`.
2. **Speed.** 0.92–0.95 beat 0.98 for the shadda lines; the delivered cut is 0.95
   everywhere, which costs ~0.3 s per line and still leaves 0.6–3 s of air per beat.
3. **Lead silence is not needed.** Every take already opens at −120 dBFS and ends
   between −40 and −70 dBFS, so the model is not clipping its onsets; adding silence
   changed nothing that the ear would notice and made the beats longer.

The ASR gate is the reason this is documented rather than claimed: `normalise()`
strips the harakat range (which includes the shadda) before comparing, so the gate
proves the **words survived** but it can never prove the **gemination was heard**.
That last call belongs to a human listening to `out/auditions/`.

The honest residual: `b02`'s `خَلِّي التطبيق` transcribes as `وخلت تطبيق` on some
passes and `وخل التطبيق` on others **from the same wav** — the boundary between the
doubled ل and the following `التطبيق` is the ASR's guess, not the audio changing.
`out/vo-work/asr_stability.py` reproduces that (3 passes per delivered line).

## Recommendations for other accents

Ids below were resolved with `GET /model/{id}`, then actually spoken with TTS and
transcribed back (ASR similarity in brackets). They are **recommendations, not
auditions**: nobody has listened to them for this film, and licensing a public
model for a client film is a decision, not a detail.

| accent | label | reference_id | round-trip |
|---|---|---|---|
| MSA | راوي فصحى | `e7c17216a46248edbc2defecfd30c9fd` | 0.989 |
| MSA | Calm Arabic Narrator | `c80ec42a3c914be0bc820a3739ded736` | 0.978–0.989 |
| Gulf | فويس اوفر خليجي حقيقي | `d9a25e02307043c4bfc1eb49d1b77e0d` | 0.989 |
| Saudi | شاب سعودي | `10c5c2a37a284a81bb0cf3c53955d795` | 0.989 |
| Egyptian | vo egyptian | `b60fe3f62571440394974849b5ade8f4` | 0.978–0.989 |
| Lebanese | Arabic Lebanese female voice | `113271b7290f4d5482bb4a57c2a9c446` | 0.989 |
| Shami | شاميه (female) | `374096626a244e6d9d15dcddb2c216c6` | 0.967–0.978 |
| Shami | شامي (male, the film's previous id) | `e58b89675fc345148a88d8bad896f28b` | 0.989 |

That last row matters for provenance: the id the previous cut used is a public
community model titled `شامي` by EyeOf Ideas, which is why it worked without any
account setup — and why it is replaceable by the clone above without changing the
film's character.

### English

A bilingual cut should not start from zero either. Three English models from the
Fish library were spoken with one product line and transcribed back; all three pass
the same 0.90 gate, so the choice is character, not quality. Samples:
`audio/voices/en-*.wav`.

| accent | label | reference_id | round-trip | pace |
|---|---|---|---|---|
| English (US, male, calm) | `en-adrian` | `bf322df2096a46f18c579d0baa36f41d` | 0.994 | 2.05 w/s |
| English (US, male, bright) | `en-ethan` | `536d3a5e000945adb7038665781a4aca` | 0.994 | 2.63 w/s |
| English (US, female, warm) | `en-abby` | `f6a19fe5ab494e1fa51bb1476d583a44` | 0.994 | 2.49 w/s |

`adrian` is the narrator default (slow enough for a 30 s film); `ethan` is a hook
voice; `abby` matches a female brand. They are stock library models, so the same
licensing caveat as the Arabic stock ids applies: technical fit proven, usage in a
client film is a decision.

### How to choose, quickly

1. Dialect first: MSA for a formal launch, Gulf/Saudi for a Gulf audience, Egyptian
   for the largest informal reach, Shami for Levantine warmth.
2. Then the four endorsed clones: `shami-m-deep` (the delivered film), `shami-m-young`,
   `syria-f-bright`, `syrian-m-warm` — all cloned from probes the client approved,
   reusable on new copy with the same diction.
3. Keep the brand name in English inside Arabic lines ("StudyAI") and say it the same
   way every time; the delivered script does this and the TTS renders it as one word.
4. Never trust a voice from its title: speak the actual script and run
   `voice_check.py` — a good-sounding id can still swallow a shadda.

## Limits, stated once

- Shadda pronunciation: constructed and audited by ear, not gate-verified (see above).
- Stock accents and genders are read off public titles; the round-trip only proves
  the id speaks Arabic.
- `audio/voices/*.wav` are the probes with a repaired RIFF header; Fish streams a
  placeholder size, so the copies are rewritten by `fix_wav_header` before delivery.

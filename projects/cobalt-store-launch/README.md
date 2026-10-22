# متجرك باسمك — Cobalt Ledger (48 s feature film)

A 48-second, 24-bar feature film for a complete digital-products store inside
Telegram. This cut goes deeper than the launch teaser: it explains **multi-source
sourcing**, **cheapest/priority routing**, **margin**, **automatic repricing**,
**wide payment coverage** and the **guided setup**.

**Deliverables** (after `python scripts/package_project.py --project projects/cobalt-store-launch`):

| file | what it is |
|---|---|
| `output/masters/cobalt-store-launch-16x9-1080p.mp4` | hero, 1920×1080 |
| `output/masters/cobalt-store-launch-9x16-1080p.mp4` | Reels / Shorts / TikTok, 1080×1920 |
| `output/masters/cobalt-store-launch-1x1-1080p.mp4` | feed square, 1080×1080 |
| `output/captions/{wide,vertical}.srt` | Arabic captions from the measured VO |
| `output/stills/*.png` | beat stills + covers |
| `output/qa/` | contact sheets, ASR, score report |
| `manifest.json`, `SHA256SUMS` | what shipped |

## The cut

- **Direction:** *Cobalt Ledger* — deep cobalt/navy, silver chrome, ivory Tajawal
  headlines, one champagne ledger line. Not green. Saffron is money only.
- **Clock:** 24 bars × 2 s = 48.00 s — open 3, setup 4, store 5, sources 5,
  owner 4, finale 3.
- **Setup:** the real wizard steps from `store.setup.ts`: هوية المتجر، العملة وسعر
  الليرة، وسائل الدفع، المصادر، المنتجات، الإطلاق. The `≈ 15 دقيقة` figure is the
  guide's own, conditioned on the payment/source keys being ready.
- **Payments:** wallet, شام كاش، سيريتل كاش، MTN كاش، USDT، Binance Pay، تحويل بنكي
  — the real templates in `ARCHITECTURE.md` §payment_methods.
- **Sources:** three generic source cards; a product linked to them; cheapest routing,
  a 15% margin, a source-cost rise and automatic repricing; «إن تعذّر: التالي
  تلقائياً»; wide only: «عند انخفاض التكلفة نُبلغك لتخفّض سعرك وتبقى منافساً».
  The numeric example is labelled «مثال».
- **CTA:** «للمزيد من التفاصيل أو لمتجرك — تواصل معنا على الخاص.» No price line.
- **Voice:** Damascene male on Fish **drama-3** (`6e52d5af…`), fully vocalised,
  temperature 0.6, per-line speed lifts. **ASR: 6/6, worst 0.985**, including
  «متجرك»، «بث إشعارات»، «مصادر»، «الأرخص»، «تلقائياً»، «بدون تطبيق». 41.2 s of
  speech; light EQ/de-esser/compressor.
- **Score:** `make_bed.py --style souk-drop`, 48 s, 120 BPM. Measured: RMS −19.27,
  sample peak −3.51, true peak −3.02, 0 clipped. The machine room sits under the
  source beat and the widest drop lands on the contact ticket.
- **Type:** Tajawal 700/800 headlines; IBM Plex Sans Arabic body; Reem Kufi only
  inside the product UI. No per-letter Arabic.

## Truth

The store, products, prices, wallet and dashboard numbers are the app's demo fixture
(labelled «لقطات الواجهة ببيانات تجريبية»). The source costs and the 15% margin are a
worked example, labelled «مثال». Payment method names and setup steps are the app's
own. No supplier name, live quote, rating, user count, award or price claim is
invented. Contacts are exactly `t.me/abumooaz1` and `wa.me/905528552420`.

## Re-render

```powershell
python scripts/studio.py timeline --strict
python scripts/studio.py voice
python scripts/make_bed.py --style souk-drop --report out/audio/score-report.json
python scripts/captions.py --film film/film.json --vo src/generated/vo.json
node_modules\.bin\remotion.cmd render src/index.ts Studio16x9 out\masters\film_16x9.mp4 --scale=1 --codec=h264 --crf=14 --x264-preset=medium --pixel-format=yuv420p --color-space=bt709 --image-format=jpeg --concurrency=8 --overwrite
python scripts/master_audio.py out/masters/film_16x9.mp4
python scripts/qa.py --files out/masters/film_16x9.mp4 --stills 8 --require-audio
```

The TTS EQ pass used after synthesis:

```
highpass=f=75, lowpass=f=16500,
equalizer=f=220:t=q:w=0.8:g=-1.4, equalizer=f=3000:t=q:w=1.0:g=1.2,
equalizer=f=7500:t=q:w=1.2:g=0.7,
deesser=i=0.35:m=0.4:f=0.5,
acompressor=threshold=0.09:ratio=2.2:attack=12:release=140:makeup=1.2,
alimiter=limit=0.89
```

## Files

| path | role |
|---|---|
| `film.json` | 6 beats, 24 bars, copy, VO, per-line speed |
| `style.json` | `cobalt-atelier`, motion, transitions, foley |
| `vo-script.json` | the Fish spec used for the delivered take |
| `PROMPT-PACK.md` | Cobalt Ledger prompts + Opus 5.5 references |
| `brief.md` | the six blocks, clock, gotchas |
| `assets/` | timeline, VO, music, captions, ASR |
| `output/masters/` | the three masters |
| `output/stills/` | beat stills and covers |
| `SHA256SUMS` | hashes of every delivered file |

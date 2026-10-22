# Third-party notices

The **MIT license in `LICENSE`** covers the studio's own code, scenes, scripts and
documentation. It does **not** relicense the dependencies or the demo product
content. Read this file before redistributing the repo or a film.

## Fonts (SIL Open Font License 1.1)

Bundled in `public/fonts/`:

- **Tajawal** — Copyright 2018 The Tajawal Project Authors.
- **IBM Plex Sans Arabic** — Copyright 2017 IBM Corp.
- **Reem Kufi** — Copyright 2017 The Reem Kufi Project Authors.
- **Amiri** — Copyright 2010–2022 The Amiri Project Authors.
- **Noto Naskh Arabic** — Copyright 2012 Google Inc.

All are licensed under the **SIL Open Font License, Version 1.1**. The full license
and the per-face copyright notices are in [`public/fonts/OFL.txt`](public/fonts/OFL.txt).
The OFL permits bundling and embedding; it does not permit selling the fonts by
themselves. Do not rename a modified font with its Reserved Font Name.

## Remotion and the renderer

This repo renders with **Remotion** (`remotion`, `@remotion/*`). Remotion is **not**
MIT-licensed; it has its own license with commercial-use terms. See
<https://www.remotion.dev/license> and the `LICENSE` file in the installed package.
The MIT license of this repo does not override it.

## Node and Python dependencies

`package-lock.json` and `requirements.txt` pin the full dependency tree. Each package
carries its own license; the common ones are MIT, ISC, Apache-2.0 and BSD. Run your
own license audit before a commercial distribution.

## Generated voice and music

- The score and SFX are synthesized by `scripts/make_bed.py` and the studio's SFX
  generator; no samples or library music are included.
- The delivered voice was generated with Fish Audio (and, in an earlier experiment,
  ElevenLabs). Voice cloning and TTS outputs are subject to the provider's terms and
  to the rights of the voice owner. The repository does not grant rights to a
  third-party voice; replace the voice reference before commercial use.
- The delivered WAVs under `public/audio/vo/` are included so a fresh clone renders
  with sound. They are not a license to a voice identity.

## Demo product content

The storefront, Arabic strings, product names, prices, wallet numbers, payment method
names and setup labels are a **technical example** reconstructed from the operator's
demo app. They remain the property of their owners and are not relicensed by MIT.
Replace them with your own product, your own strings and your own demo data before
shipping a commercial film.

The contacts printed in the reference films (`t.me/abumooaz1`,
`wa.me/905528552420`) are the operator's business contacts, included with permission
for the example. Replace them in your own film.

## Reference cards and prompt packs

`references/corpus/` links to public films, posts and prompt pages. The cards record
the **move** and the reason, not the frames, assets, fonts, music or full prompt text
of the source. `references/prompt-packs/` contains prompts written for this studio,
informed by the linked public material. If you reuse a linked source, check its own
license and attribution requirements.

## No warranty

The studio is provided “as is”. The authors are not liable for a claim arising from a
product name, price, voice, font, music, screenshot or client asset you put into a
film. Clear the rights before you publish.

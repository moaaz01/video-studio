# Security policy

## Secrets

This repository must never contain an API key, bot token, Telegram `initData`, a
private voice reference or a client's credentials.

- Keys live in `.env` (gitignored) or the process environment:
  `FISH_API_KEY`, `ELEVEN_API_KEY` (if you use ElevenLabs), `FISH_MODEL`.
- `.env.example` contains names only, never values.
- Generated audio, screenshots and `out/` are local artefacts; do not add a capture
  that contains a token, a private chat or a customer's data.
- If you find a secret in the tree or in history, **do not open a public issue**.
  Rotate the key first, then report privately.

## Reporting a vulnerability

Use GitHub's **Security → Report a vulnerability** (private advisory) on
<https://github.com/moaaz01/video-studio/security/advisories/new>, or contact the
maintainer through the contact in the README. Include the commit, the file, the
impact and a minimal reproduction. Do not include live keys or customer data.

## Scope

In scope: the studio scripts, the Remotion compositions, the generated data files and
the packaging/QA path. Out of scope: the demo product's backend, the third-party
providers (Fish, ElevenLabs, Remotion), and any film made with the studio by a third
party.

## Supported versions

The `main` branch is the supported line. There are no LTS branches. Fixes land on
`main`; a film project is reproducible from its own `film.json`/`style.json` and the
commit that produced it.

## Known limitations

- The Fish and ElevenLabs bridges call external APIs; their availability, pricing and
  voice-library access are outside this repo's control.
- `scripts/voice_check.py` is an ASR proxy, not a guarantee of a human-sounding voice.
- The QA gates measure the delivered files; they do not clear the rights to a product
  name, price, voice, font, music or client screenshot.

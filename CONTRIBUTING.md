# Contributing

Thanks for improving the studio. This repo is an Arabic-first film engine and a
portable Agent Skill; a change is only done when a rendered still or a measured
artifact proves it.

## Setup

```bash
npm install
python3 -m pip install -r requirements.txt
python3 scripts/studio.py doctor
python3 scripts/studio.py timeline --strict
```

On Windows, render with Windows Node (`cmd.exe` + `node_modules\.bin\remotion.cmd`);
WSL cannot load the native `@rspack/binding` used by this checkout.

## Before you open a PR

1. **No secrets.** Never commit `.env`, an API key, a bot token, a private voice
   reference or a customer's chat/screenshot. Use `.env.example` for names only.
2. **No client data.** Do not add a real client's app, strings, prices, contacts or
   screenshots unless you have permission. Demo content must be labelled as demo.
3. **No new dependency without a reason.** Prefer the existing Remotion/SVG/CSS
   stack; the studio must render offline after `npm install` and the Python deps.
4. **Typecheck.** `npx tsc --noEmit` (or `node_modules\.bin\tsc.cmd` on Windows).
5. **Template gate.** `python3 scripts/templates.py --check` must pass.
6. **Timeline gate.** `python3 scripts/studio.py timeline --strict` must pass.
7. **1:1 still.** Render at least one still per beat at full size. Check Arabic
   ascenders/descenders, overlaps and price alignment. A contact sheet is not proof.
8. **Voice gate.** If you touch a VO line, run
   `python3 scripts/voice_check.py --script film/vo.json --manifest src/generated/vo.json --threshold 0.90`.
9. **QA gate.** Render the master and run
   `python3 scripts/qa.py --files <masters> --stills 8 --require-audio`; report the
   measured peak/RMS/clip/black numbers, not the encoder's log.
10. **Docs.** If you add a look, beat kind, template or prompt pack, update
    `SKILL.md`, `AGENTS.md`, `references/visual-direction.md`, `docs/templates.md`
    and the template index in the same PR.

## Adding a reusable recipe

- Add a template card in `references/templates/`; run `templates.py --check`.
- Add a short playbook in `references/` with the clock, the gates and the pitfalls.
- Add a prompt pack in `references/prompt-packs/` only after a film ships and the
  prompts are proven on a real render.
- Add the reference cards (`scripts/corpus.py add`) with the **move** and the reason,
  not a bookmark.

## Reporting a bug

Open an issue with: the command, the commit, the expected frame, the actual still (or
the measured number), and whether it reproduces at 1:1. For a security issue, use
`SECURITY.md`; do not publish a key or a client file.

## License

By contributing, you agree that your code and original documentation are licensed
under the repo's MIT license. You retain the rights to any product content, voice,
font or client asset you add, and you confirm you have permission to publish it.
Third-party licenses are listed in `THIRD_PARTY_NOTICES.md`.

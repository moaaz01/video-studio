# Prompt packs

Ready prompts for the **generative layer** of a film: the room, the metal, the glass,
the camera, the transitions. They never generate the product UI, the Arabic copy, the
prices or the contacts — those are code and real data.

| pack | for | source |
|---|---|---|
| `cobalt-ledger.md` | a 48 s feature film about a Telegram store's economics; cobalt stage, chrome, glass data cards, multi-source/price-update scenes | `projects/cobalt-store-launch` |

## How to use a pack

1. Read the film's `brief.md` and `film.json` first; the pack is not a replacement for
   the copy or the product truth.
2. Use the **code-film prompt** with an agent that can write and render Remotion /
   SVG. Use the **b-roll prompts** with a video model only for material and camera.
3. Composite the real UI and the real Arabic type in code; a video model will mangle
   both.
4. Keep the negative prompt; do not generate logos, prices or invented screens.
5. Add a new pack only after a film ships and its prompt file is proven on a real
   render. Link the project and the pinned reference cards.

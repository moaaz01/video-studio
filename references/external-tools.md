# External tools: when a film needs more than the engine

The engine draws type, charts, UI, presenters and particles itself. Some shots need
a tool outside it. Rule: **the tool makes an asset; the asset enters the film as an
`image` or `footage` layer**, with its source recorded (`studio.py provenance`) and
any paid call priced first (`studio.py providers pick` / `providers spend`). Nothing
here is a dependency of this repo; install only what the film needs.

| Need | Tool | How it enters the film | Watch out |
|---|---|---|---|
| A real 3D product turn, a scene the camera flies through | Blender, driven by an agent through [mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) | render a PNG sequence or MP4 → `public/assets/<slug>/` → `image`/`footage` beat | model licences; render time; keep the 3D look consistent with the style card |
| Light 3D in the browser (orbiting object, globe, particles in depth) | [three.js](https://github.com/mrdoob/three.js) via `@remotion/three`, pinned to the installed `@remotion/*` version | a new scene kind, only after a 1:1 still in both aspects and a `kinds.py` check | do not add it for one shot; 2D parallax (`z`) usually reads as well |
| Generated stills or clips (backgrounds, textures, b-roll) | [ComfyUI](https://github.com/Comfy-Org/ComfyUI) locally, or a catalogued provider | `image` layer or footage beat; prompt + seed + model in the provenance record | **no generated image carries letters**; the renderer sets every word |
| Timeline easing the team already wrote in GSAP | [GSAP](https://github.com/greensock/GSAP) | port the curve to `src/lib/anim.ts` (`E`), never run GSAP inside Remotion | Remotion renders frame by frame; time comes from `useCurrentFrame`, not a running timeline |
| Pixel or game-style effects (fire, magic, pickups) | [pixelfx](https://github.com/patch-gg/pixelfx) (MIT) sprite sheets | export a transparent sheet → `image` layer; for simple accents use the engine's `burst` layer | keep it to one accent; pixel art fights a cinema grade |
| An HTML-first composition pipeline | [HyperFrames](https://github.com/heygen-com/hyperframes) | render there, bring the MP4 in as footage | two engines in one film need one style card and one clock |
| Learning how a reference ad was made, shot by shot | [rea-video](https://github.com/JuneYaooo/rea-video) (full AI/live/3D verdict) or `studio.py craft breakdown` (local, measured cuts) | findings → `refs add` cards; never the reference's assets | different from this repo's "REA" device-capture bridge |
| Remotion API questions | [remotion-dev/skills](https://github.com/remotion-dev/skills), Remotion docs | knowledge only | match the installed version (`package.json`) |
| Packaging this studio as a skill elsewhere | [anthropics/skills](https://github.com/anthropics/skills) format | `SKILL.md` frontmatter is already compatible; `install_check.py` verifies installs | — |
| UI that looks vibecoded inside a film | [unslop](https://github.com/heydamir/unslop) (CC BY 4.0), [impeccable](https://github.com/pbakaus/impeccable) | fix the real app or the `tools/mockups/` screen before capturing it | a mockup is never the real app |

Before using any of them, write one line in `film/decisions.jsonl` (via
`providers pick`, or by hand for a free local tool) saying why the engine alone was
not enough.

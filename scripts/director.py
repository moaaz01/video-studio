#!/usr/bin/env python3
"""Director: read the intake, choose the film that fits the product.

This is the studio's taste layer, not a template picker. It scores the product
type, the goal, the assets the user actually supplied, the emotion, the platforms
and the duration, then writes a treatment the agent shows the user before a beat
is written. Every choice is explained; every override is recorded.

    python scripts/director.py --intake film/intake.json
    python scripts/director.py --intake film/intake.json --format kinetic --direction '#kinetic'
    python scripts/director.py --intake film/intake.json --json

Outputs `film/treatment.json` and `film/treatment.md` (override with --out/--md).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import intake  # noqa: E402
from platform_matrix import ALL_ASPECTS, PLATFORMS, safe_for, targets_for  # noqa: E402

# ── the library of film forms ────────────────────────────────────────────────
# film_format is what `make_timeline.py` understands; format is the creative form.
SPECS: dict[str, dict] = {
    "kinetic": {
        "format": "kinetic", "film_format": "kinetic", "direction": "#kinetic",
        "bpm": 160, "voice": "none", "template": "references/templates/kinetic-launch.json",
        "grammar": "Words (slam/stack/split/cut) → Picture or proof → Logo",
        "duration": (15, 30), "pace": "one idea per beat, 0.375 s shots, grounds flip",
    },
    "explainer": {
        "format": "explainer", "film_format": "explainer", "direction": "#editorial",
        "bpm": 120, "voice": "fish", "template": "references/templates/explainer-reel.json",
        "grammar": "hook with a number → one sentence + one card per point → CTA",
        "duration": (40, 60), "pace": "word-synced headline, one card per sentence, calm cuts",
    },
    "device": {
        "format": "device", "film_format": "launch", "direction": "#device",
        "bpm": 120, "voice": "fish", "template": "references/templates/app-demo.json",
        "grammar": "hook → real device screens × 3–5 → CTA",
        "duration": (20, 40), "pace": "phone is the frame, UI at 1:1, one screen per beat",
    },
    "ui-film": {
        "format": "ui-film", "film_format": "launch", "direction": "#ui-film",
        "bpm": 120, "voice": "fish", "template": "references/templates/app-demo.json",
        "grammar": "hook → UI parts detach and rearrange → CTA",
        "duration": (20, 35), "pace": "real UI crops, one variable per beat",
    },
    "data-film": {
        "format": "data-film", "film_format": "launch", "direction": "#data-film",
        "bpm": 120, "voice": "fish", "template": "references/templates/cobalt-ledger.json",
        "grammar": "open → setup → store → sources → finale",
        "duration": (40, 55), "pace": "one data event per bar, 120 BPM, glass cards",
    },
    "editorial": {
        "format": "editorial", "film_format": "launch", "direction": "#editorial",
        "bpm": 110, "voice": "none", "template": "references/templates/arabic-editorial.json",
        "grammar": "hook → proof → proof → CTA",
        "duration": (20, 35), "pace": "ink on paper, rules, stamps, slow camera",
    },
    "launch": {
        "format": "launch", "film_format": "launch", "direction": "#launch",
        "bpm": 128, "voice": "none", "template": "references/templates/event-promo.json",
        "grammar": "hook → 3–5 full-bleed claims → CTA",
        "duration": (15, 30), "pace": "hard cuts on the kick, 1.05 punch-ins",
    },
    "code": {
        "format": "code", "film_format": "kinetic", "direction": "#code",
        "bpm": 160, "voice": "none", "template": "references/templates/kinetic-launch.json",
        "grammar": "Words → real source/terminal → Logo",
        "duration": (15, 25), "pace": "mono texture, glyph cuts, 160 BPM",
    },
}

# (product_type, goal) → first choice. Fallbacks below keep every combination valid.
RULES: dict[tuple[str, str], str] = {
    ("game", "launch"): "kinetic",
    ("game", "announce"): "kinetic",
    ("game", "explain"): "kinetic",
    ("game", "sell"): "kinetic",
    ("mobile-app", "launch"): "device",
    ("mobile-app", "explain"): "device",
    ("mobile-app", "sell"): "device",
    ("mobile-app", "teach"): "explainer",
    ("saas-web", "launch"): "ui-film",
    ("saas-web", "explain"): "explainer",
    ("saas-web", "sell"): "explainer",
    ("saas-web", "teach"): "explainer",
    ("store-service", "sell"): "data-film",
    ("store-service", "explain"): "data-film",
    ("store-service", "launch"): "data-film",
    ("physical-product", "sell"): "editorial",
    ("physical-product", "launch"): "launch",
    ("physical-product", "announce"): "editorial",
    ("course-education", "teach"): "explainer",
    ("course-education", "sell"): "explainer",
    ("course-education", "launch"): "explainer",
    ("personal-brand", "announce"): "editorial",
    ("personal-brand", "launch"): "editorial",
    ("personal-brand", "sell"): "editorial",
    ("api-devtool", "launch"): "code",
    ("api-devtool", "explain"): "explainer",
    ("api-devtool", "announce"): "code",
    ("api-devtool", "teach"): "explainer",
}

BY_PRODUCT = {
    "game": "kinetic", "mobile-app": "device", "saas-web": "explainer",
    "store-service": "data-film", "physical-product": "editorial",
    "course-education": "explainer", "personal-brand": "editorial",
    "api-devtool": "code", "other": "explainer",
}
BY_GOAL = {
    "launch": "launch", "explain": "explainer", "sell": "explainer",
    "teach": "explainer", "recruit": "editorial", "announce": "editorial",
}


def asset_paths(data: dict, name: str) -> list[str]:
    raw = (data.get("assets") or {}).get(name)
    if isinstance(raw, str):
        return [raw] if raw.strip() else []
    if isinstance(raw, list):
        return [str(v).strip() for v in raw if str(v).strip()]
    return []


def choose(a: dict, data: dict) -> tuple[str, list[str]]:
    ptype, goal = a.get("product_type"), a.get("goal")
    why: list[str] = []
    name = RULES.get((ptype, goal))
    if name:
        why.append(f"{ptype} + {goal} → {name}: the product and the job match this form.")
    else:
        name = BY_PRODUCT.get(ptype) or BY_GOAL.get(goal) or "explainer"
        if not ptype or not goal:
            why.append("product_type/goal not answered yet → explainer is a safe draft; ask the user before committing.")
        else:
            why.append(f"no exact rule for {ptype}/{goal}; {name} is the safest fit.")

    screens = bool(asset_paths(data, "screenshot"))
    shots = bool(asset_paths(data, "product_shot"))
    art = bool(asset_paths(data, "key_art"))
    visual = a.get("visual_mode")

    # Assets move the choice: real screens beat a re-drawn UI; no screens means type.
    if name in ("device", "ui-film") and not (screens or shots):
        name = "explainer" if a.get("goal") in ("explain", "teach") else "kinetic"
        why.append("no real screenshots/product shots supplied → type-led form, so the film never invents UI.")
    if name == "kinetic" and not (screens or shots or art) and visual in ("product-shots", "type+art"):
        why.append("visual_mode asks for images but no image asset is present → ask the user before rendering.")

    if a.get("emotion") == "hype" and name in ("explainer", "editorial"):
        name = "kinetic"
        why.append("emotion=hype → kinetic: the pace, not the copy, carries the feeling.")
    if a.get("emotion") in ("premium", "calm") and name == "kinetic" and ptype != "game":
        name = "editorial"
        why.append("emotion is premium/calm → editorial: a calmer camera and more air.")

    return name, why


def structure_for(name: str, duration: float, bpm: int, points: int = 6) -> list[dict]:
    if name == "explainer":
        rows = [{"beat": "hook", "kind": "explainer", "bars": 4, "purpose": "number hook + promise"}]
        rows += [{"beat": f"point-{i + 1}", "kind": "explainer", "bars": 3, "purpose": f"point {i + 1}: one sentence + one card"} for i in range(max(3, min(7, points)))]
        rows += [{"beat": "cta", "kind": "explainer", "bars": 3, "purpose": "keyword + freebie"}]
        return rows
    if name in ("kinetic", "code"):
        return [
            {"beat": "hook", "kind": "kinetic", "bars": 2, "purpose": "charge → first claim"},
            {"beat": "proof-1", "kind": "kinetic", "bars": 2, "purpose": "claim 2, ground flip"},
            {"beat": "proof-2", "kind": "kinetic", "bars": 2, "purpose": "claim 3, picture or proof"},
            {"beat": "proof-3", "kind": "kinetic", "bars": 2, "purpose": "claim 4, fastest cuts"},
            {"beat": "proof-4", "kind": "kinetic", "bars": 2, "purpose": "claim 5, resolve"},
            {"beat": "logo", "kind": "kinetic", "bars": 2, "purpose": "logo card, music stops"},
        ]
    if name == "data-film":
        return [
            {"beat": "open", "kind": "open", "bars": 3, "purpose": "the promise"},
            {"beat": "setup", "kind": "setup", "bars": 4, "purpose": "the path to launch"},
            {"beat": "store", "kind": "store", "bars": 5, "purpose": "the buyer's path"},
            {"beat": "sources", "kind": "sources", "bars": 5, "purpose": "sourcing + margin"},
            {"beat": "finale", "kind": "finale", "bars": 3, "purpose": "contact-first CTA"},
        ]
    if name == "device":
        return [
            {"beat": "hook", "kind": "hook", "bars": 3, "purpose": "claim + device enters"},
            {"beat": "screen-1", "kind": "device", "bars": 5, "purpose": "real screen 1"},
            {"beat": "screen-2", "kind": "device", "bars": 5, "purpose": "real screen 2"},
            {"beat": "screen-3", "kind": "device", "bars": 5, "purpose": "real screen 3"},
            {"beat": "cta", "kind": "cta", "bars": 3, "purpose": "one action"},
        ]
    return [
        {"beat": "hook", "kind": "hook", "bars": 3, "purpose": "claim"},
        {"beat": "proof-1", "kind": "device", "bars": 4, "purpose": "proof 1"},
        {"beat": "proof-2", "kind": "device", "bars": 4, "purpose": "proof 2"},
        {"beat": "cta", "kind": "cta", "bars": 3, "purpose": "one action"},
    ]


def recommend(data: dict) -> dict:
    a = data.get("answers") or {}
    name, why = choose(a, data)
    spec = dict(SPECS[name])
    direction = spec["direction"]
    if a.get("emotion") == "warm" and name == "explainer":
        direction = "#editorial"
        why.append("emotion=warm → editorial type on paper, not a dashboard.")
    if a.get("emotion") == "smart" and name == "explainer":
        direction = "#diagram"
        why.append("emotion=smart → diagram grammar: the mechanism is the argument.")

    platforms = [p for p in (a.get("platforms") or []) if p in PLATFORMS] or ["x"]
    primary = a.get("aspect") if a.get("aspect") in ALL_ASPECTS else ("9x16" if name == "explainer" else "16x9")
    targets = targets_for(platforms, primary)
    safe = safe_for(platforms)
    lo, hi = spec["duration"]
    try:
        asked = float(a.get("duration_s") or 0)
    except (TypeError, ValueError):
        asked = 0
    duration = asked if lo <= asked <= hi else (lo + hi) / 2
    if asked and duration != asked:
        why.append(f"duration {asked:g}s is outside the {name} range {lo}–{hi}s → {duration:g}s.")
    bpm = int(a.get("tempo_bpm") or spec["bpm"]) if name in ("kinetic", "code") else spec["bpm"]
    if name in ("kinetic", "code"):
        bpm = max(120, min(175, bpm))
    bars = max(4, round(duration / (240 / bpm)))
    points = len([p for p in (a.get("points") or []) if str(p).strip()])
    structure = structure_for(name, duration, bpm, points or 6)

    voice = a.get("voice_provider") or spec["voice"]
    if name in ("kinetic", "code") and voice == "fish":
        voice = "none"
        why.append("kinetic/code → no VO: the words are the picture; X autoplays muted.")

    assets_required = []
    if name in ("kinetic", "code"):
        assets_required.append("logo (SVG/PNG)")
        if a.get("visual_mode") == "type+art":
            assets_required.append("key_art 1–2 images (≥ 2048 px wide)")
        if a.get("visual_mode") == "product-shots":
            assets_required.append("product_shot 1–3 real images")
    elif name == "device":
        assets_required += ["screenshot 1–3 real screens", "logo"]
    elif name == "data-film":
        assets_required += ["screenshot/product_shot (optional but preferred)", "logo", "real numbers/claims"]
    elif name == "explainer":
        assets_required += ["screenshot/product_shot if the card shows the product", "logo (optional)"]
    elif name == "editorial":
        assets_required += ["product_shot 1–3 real images", "logo (optional)"]

    checks, problems = intake.check(data, strict=False)
    missing = [p["id"] for p in problems]
    confidence = 0.55 + 0.08 * sum(bool(a.get(k)) for k in ("product_type", "goal", "emotion", "platforms", "duration_s"))
    confidence = min(0.95, round(confidence, 2))

    alternatives = []
    for alt in ("explainer", "kinetic", "device", "data-film", "editorial"):
        if alt != name:
            alternatives.append({"format": alt, "when": SPECS[alt]["pace"]})
    alternatives = alternatives[:2]

    treatment = {
        "product": a.get("product_name") or data.get("slug") or "untitled",
        "slug": data.get("slug"),
        "format": spec["format"],
        "film_format": spec["film_format"],
        "direction": direction,
        "template": spec["template"],
        "grammar": spec["grammar"],
        "pace": spec["pace"],
        "bpm": bpm,
        "duration_s": duration,
        "bars": bars,
        "primary_aspect": primary,
        "targets": targets,
        "platforms": platforms,
        "platform_targets": {p: PLATFORMS[p]["aspects"] for p in platforms},
        "safe_presets": safe,
        "voice": voice,
        "music": a.get("music_mode") or "original",
        "structure": structure,
        "assets_required": assets_required,
        "why": why,
        "confidence": confidence,
        "alternatives": alternatives,
        "missing_intake": missing,
        "overridden": False,
    }
    return treatment


def markdown(t: dict) -> str:
    rows = "\n".join(f"| {r['beat']} | {r['kind']} | {r['bars']} | {r['purpose']} |" for r in t["structure"])
    why = "\n".join(f"- {line}" for line in t["why"])
    assets = "\n".join(f"- {line}" for line in t["assets_required"]) or "- none beyond the intake"
    targets = ", ".join(t["targets"])
    platforms = ", ".join(t["platforms"])
    missing = "\n".join(f"- {m}" for m in t["missing_intake"]) or "- none"
    alts = "\n".join(f"- **{a['format']}** — {a['when']}" for a in t["alternatives"])
    return f"""# Treatment — {t['product']}

**{t['format']}** · `{t['direction']}` · {t['duration_s']:g}s · {t['bpm']} BPM · {t['primary_aspect']}

> This is a proposal, not a render order. Show it to the user, get a yes (or an
> override), then write the film.

## Why this form

{why}

## The clock

| beat | kind | bars | what it lands |
|---|---|---|---|
{rows}

## Delivery

- **Platforms:** {platforms}
- **Aspects (all four by default):** {targets}
- **Safe presets:** {', '.join(f'{k}={v}' for k, v in t['safe_presets'].items()) or 'feed'}
- **Voice:** {t['voice']} · **Music:** {t['music']}
- **Template:** `{t['template']}`
- **Grammar:** {t['grammar']}
- **Pace:** {t['pace']}

## Ask the user for

{assets}

## Intake gaps (blocking before beats)

{missing}

## Alternatives

{alts}

## Next

```bash
python scripts/intake.py check --intake film/intake.json
python scripts/intake.py brief --intake film/intake.json
python scripts/studio.py new {t['slug'] or 'my-film'} --from {t['template']}
python scripts/studio.py timeline --film film/{t['slug'] or 'my-film'}.json
python scripts/studio.py voice --provider {t['voice']}      # if voice != none
python scripts/studio.py export --targets {','.join(t['targets'])}
```
"""


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="intake -> treatment")
    p.add_argument("--intake", default="film/intake.json")
    p.add_argument("--out", default="film/treatment.json")
    p.add_argument("--md", default="film/treatment.md")
    p.add_argument("--format", choices=sorted(SPECS), default=None, help="override the recommended form")
    p.add_argument("--direction", default=None, help="override the visual direction, e.g. #editorial")
    p.add_argument("--json", action="store_true")
    p.add_argument("--force", action="store_true")
    a = p.parse_args()

    data = intake.load(pathlib.Path(a.intake))
    t = recommend(data)
    if a.format:
        t["format"] = a.format
        t["film_format"] = SPECS[a.format]["film_format"]
        t["direction"] = SPECS[a.format]["direction"]
        t["template"] = SPECS[a.format]["template"]
        t["grammar"] = SPECS[a.format]["grammar"]
        t["pace"] = SPECS[a.format]["pace"]
        t["bpm"] = SPECS[a.format]["bpm"]
        t["voice"] = SPECS[a.format]["voice"]
        t["overridden"] = True
        t["why"].append(f"user override → {a.format}.")
    if a.direction:
        t["direction"] = a.direction
        t["overridden"] = True
        t["why"].append(f"user override → direction {a.direction}.")

    out = pathlib.Path(a.out)
    md = pathlib.Path(a.md)
    if not a.force and (out.exists() or md.exists()):
        print(f"{out} or {md} exists — pass --force to overwrite")
        sys.exit(1)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md.write_text(markdown(t), encoding="utf-8")
    if a.json:
        print(json.dumps(t, ensure_ascii=False, indent=2))
    else:
        print(f"format      {t['format']} · {t['direction']} · {t['duration_s']:g}s · {t['bpm']} BPM")
        print(f"delivery    {', '.join(t['targets'])}")
        print(f"confidence  {t['confidence']:.0%}")
        if t["missing_intake"]:
            print(f"missing     {len(t['missing_intake'])} intake item(s) — ask before beats")
        print(f"\nwrote {out}")
        print(f"      {md}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Template lab: the motion/design recipe archive and the style contract bridge.

The archive is data, not code: ``references/templates/<id>.json`` records a
pattern (beat structure, look, palette tokens, type rules, layout variants,
transitions, SFX map, background, motion weight) so a film can start from a
decision someone already made on purpose.

This script does three things and nothing else:

1. validates the archive against the repo's own capabilities -- looks come from
   ``src/look/looks.ts``, palette values must be ``src/theme.ts`` tokens, SFX
   stems must exist under ``public/audio/sfx/``;
2. scores the archive against a brief (``film.json`` or a hint object) and
   returns the pattern that fits, with the reasons, not a vibe;
3. writes the small contract the engine consumes:

       film/style.json = {template, look, motion, background, transitions, sfx}

No renderer, no assets, no prompts: a recipe that names a capability the repo
does not have is a validation error, not a wish.

Commands::

    python scripts/templates.py list [--json]
    python scripts/templates.py show <id> [--json]
    python scripts/templates.py pick --brief <film.json|-> [--aspect 16x9]
                                     [--energy low|mid|high] [--json]
    python scripts/templates.py apply <id> --film <film.json> --out <style.json>
    python scripts/templates.py --check
    python scripts/templates.py --self-test
"""

from __future__ import annotations

import argparse
import difflib
import json
import pathlib
import re
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "references" / "templates"
OUT_DIR = ROOT / "out" / "templates"
LOOKS_TS = ROOT / "src" / "look" / "looks.ts"
THEME_TS = ROOT / "src" / "theme.ts"
SFX_DIR = ROOT / "public" / "audio" / "sfx"

# The style contract. Exactly these six keys; the engine may read more later,
# but a template may never promise more than the engine can draw today.
STYLE_KEYS = ("template", "look", "motion", "background", "transitions", "sfx")

# Engine capability budget. Keep in sync with the composition, not with taste.
BACKGROUNDS = ("paper-glow", "ink-aurora", "emerald-depth")
TRANSITIONS = ("whip", "slide", "blur", "flash")
DEFAULT_LOOKS = ("cinema-warm", "paper-clean", "ink-noir", "vivid-launch", "ui-daylight")
SFX_KEYS = ("intro", "cut", "accent")

ASPECTS = ("16x9", "9x16", "1x1")
ASPECT_ALIASES = {"16:9": "16x9", "9:16": "9x16", "1:1": "1x1"}
ENERGIES = ("low", "mid", "high")
DIALECTS = ("ar-msa", "ar-levant", "ar-gulf", "ar-egypt")
ENGINE_KINDS = ("hook", "device", "stat", "cta")

# What a request can be, in the archive's own vocabulary.
REQUEST_KINDS = frozenset(
    {
        "launch",
        "product-launch",
        "event",
        "app-demo",
        "device-demo",
        "ui-film",
        "feature-reveal",
        "before-after",
        "impact",
        "stats-impact",
        "explainer",
        "testimonial",
        "editorial",
        "kinetic",
        "reel",
        "teaser",
    }
)

FONTS = ("Tajawal", "Amiri", "NotoNaskhArabic")
WEIGHTS = (300, 400, 500, 700, 800, 900)
LAYOUTS = frozenset(
    {
        "full-bleed-type",
        "device-left-copy-right",
        "device-stacked-caption",
        "screen-detail-crop",
        "number-centre",
        "paper-card",
        "quote-card",
        "evidence-grid",
        "split-screen",
        "stamp-corner",
        "lower-third",
        "end-card",
        "timeline-strip",
        "card-column",
    }
)

RECIPE_KEYS = frozenset(
    {
        "id",
        "title",
        "when",
        "structure",
        "look",
        "palette",
        "typography",
        "layouts",
        "transitions",
        "sfx",
        "background",
        "motion",
        "reference",
    }
)
OPTIONAL_RECIPE_KEYS = frozenset({"guardrails"})
WHEN_KEYS = frozenset({"kind", "aspects", "energy", "audience", "dialect", "duration"})
STRUCTURE_KEYS = frozenset({"beats", "total_bars"})
BEAT_KEYS = frozenset({"kind", "bars", "role"})
PALETTE_KEYS = frozenset({"ground", "surface", "ink", "accent", "support"})
PALETTE_REQUIRED = frozenset({"ground", "surface", "ink", "accent"})
TYPO_KEYS = frozenset({"face", "display_px", "body_px", "line_height", "weights", "rules"})
REFERENCE_KEYS = frozenset({"site", "url", "pattern", "move", "note"})
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
ID_RE = re.compile(r"^[a-z][a-z0-9-]{2,40}$")

MIN_RECIPES = 12
MIN_BARS, MAX_BARS = 8, 26
MAX_BEATS = 8
RECIPE_MOTION_MAX = 1.0
STYLE_MOTION_MAX = 1.5
MIN_PICK_SCORE = 60
MIN_PICK_MARGIN = 5

SELF_TEST_BRIEFS: tuple[tuple[str, str, dict[str, Any]], ...] = (
    (
        "device-launch",
        "app-demo",
        {
            "slug": "synthetic-device-launch",
            "kind": "app-demo",
            "energy": "mid",
            "dialect": "ar-levant",
            "audience": ["students"],
            "look": "ui-daylight",
            "fps": 30,
            "width": 1920,
            "height": 1080,
            "bpm": 120,
            "beats": [
                {"kind": "hook", "bars": 3},
                {"kind": "device", "bars": 5},
                {"kind": "device", "bars": 5},
                {"kind": "stat", "bars": 4},
                {"kind": "cta", "bars": 4},
            ],
        },
    ),
    (
        "stat-impact",
        "stats-impact",
        {
            "slug": "synthetic-stat-impact",
            "kind": "stats-impact",
            "energy": "high",
            "dialect": "ar-msa",
            "audience": ["students"],
            "look": "ink-noir",
            "fps": 30,
            "width": 1080,
            "height": 1920,
            "bpm": 120,
            "beats": [
                {"kind": "hook", "bars": 2},
                {"kind": "stat", "bars": 4},
                {"kind": "hook", "bars": 2},
                {"kind": "stat", "bars": 4},
                {"kind": "cta", "bars": 3},
            ],
        },
    ),
    (
        "arabic-editorial",
        "arabic-editorial",
        {
            "slug": "synthetic-arabic-editorial",
            "kind": "editorial",
            "energy": "low",
            "dialect": "ar-msa",
            "audience": ["institutions", "students"],
            "look": "paper-clean",
            "fps": 30,
            "width": 1920,
            "height": 1080,
            "bpm": 120,
            "beats": [
                {"kind": "hook", "bars": 3},
                {"kind": "device", "bars": 5},
                {"kind": "stat", "bars": 4},
                {"kind": "device", "bars": 5},
                {"kind": "cta", "bars": 4},
            ],
        },
    ),
    (
        "energetic-reel",
        "reel-vertical",
        {
            "slug": "synthetic-energetic-reel",
            "kind": "reel",
            "energy": "high",
            "dialect": "ar-levant",
            "audience": ["students", "consumer"],
            "look": "vivid-launch",
            "fps": 30,
            "width": 1080,
            "height": 1920,
            "bpm": 120,
            "beats": [
                {"kind": "hook", "bars": 2},
                {"kind": "device", "bars": 2},
                {"kind": "device", "bars": 2},
                {"kind": "cta", "bars": 3},
            ],
        },
    ),
)


class TemplateError(Exception):
    """A user-facing failure: bad archive, bad brief, bad output path."""


# --------------------------------------------------------------------------- #
# Capabilities: the repo's files are the source of truth
# --------------------------------------------------------------------------- #


def _rel(path: pathlib.Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def _read(path: pathlib.Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise TemplateError(f"cannot read {_rel(path)}: {exc}") from exc


def available_looks() -> tuple[str, ...]:
    """Read the look union from ``src/look/looks.ts``; never hard-code the list."""
    text = _read(LOOKS_TS)
    match = re.search(r"export type LookName\s*=\s*([^;]+);", text)
    if match is None:
        return DEFAULT_LOOKS
    names = tuple(name for name in re.findall(r'"([a-z][a-z-]*)"', match.group(1)) if name)
    return names or DEFAULT_LOOKS


def theme_colors() -> frozenset[str]:
    """Every colour token in ``src/theme.ts``; a template may invent none."""
    text = _read(THEME_TS)
    return frozenset(value.upper() for value in re.findall(r"#[0-9A-Fa-f]{6}", text))


def sfx_stems() -> frozenset[str]:
    if not SFX_DIR.is_dir():
        raise TemplateError(f"missing SFX directory {_rel(SFX_DIR)}")
    return frozenset(path.stem for path in SFX_DIR.glob("*.wav"))


def capabilities() -> dict[str, Any]:
    return {"looks": available_looks(), "colors": theme_colors(), "stems": sfx_stems()}


# --------------------------------------------------------------------------- #
# Archive loading and validation
# --------------------------------------------------------------------------- #


def load_archive() -> dict[str, dict[str, Any]]:
    if not TEMPLATES_DIR.is_dir():
        raise TemplateError(f"missing archive directory {_rel(TEMPLATES_DIR)}")
    paths = sorted(TEMPLATES_DIR.glob("*.json"))
    if not paths:
        raise TemplateError(f"archive is empty: {_rel(TEMPLATES_DIR)}")
    recipes: dict[str, dict[str, Any]] = {}
    for path in paths:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise TemplateError(f"{path.name}: invalid JSON ({exc.msg} at line {exc.lineno})") from exc
        except OSError as exc:
            raise TemplateError(f"{path.name}: cannot read ({exc})") from exc
        if not isinstance(data, dict):
            raise TemplateError(f"{path.name}: a recipe must be a JSON object")
        recipe_id = data.get("id")
        if not isinstance(recipe_id, str) or not ID_RE.match(recipe_id):
            raise TemplateError(f"{path.name}: missing or malformed id")
        if recipe_id != path.stem:
            raise TemplateError(f"{path.name}: id {recipe_id!r} does not match the filename")
        if recipe_id in recipes:
            raise TemplateError(f"duplicate recipe id {recipe_id!r}")
        recipes[recipe_id] = data
    return dict(sorted(recipes.items()))


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_num(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _hex_luma(value: str) -> float:
    r = int(value[1:3], 16) / 255.0
    g = int(value[3:5], 16) / 255.0
    b = int(value[5:7], 16) / 255.0
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast(first: str, second: str) -> float:
    def channel(value: float) -> float:
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    def luminance(hex_value: str) -> float:
        return (
            0.2126 * channel(int(hex_value[1:3], 16) / 255.0)
            + 0.7152 * channel(int(hex_value[3:5], 16) / 255.0)
            + 0.0722 * channel(int(hex_value[5:7], 16) / 255.0)
        )

    a, b = luminance(first), luminance(second)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def recipe_errors(recipe: dict[str, Any], caps: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    def need(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    unknown = sorted(set(recipe) - RECIPE_KEYS - OPTIONAL_RECIPE_KEYS)
    missing = sorted(RECIPE_KEYS - set(recipe))
    need(not unknown, f"unknown keys: {', '.join(unknown)}")
    need(not missing, f"missing keys: {', '.join(missing)}")
    if unknown or missing:
        return errors

    need(bool(ID_RE.match(recipe["id"])), "id must be lower-kebab-case")
    need(isinstance(recipe["title"], str) and bool(recipe["title"].strip()), "title must be a non-empty string")

    # when ------------------------------------------------------------------
    when = recipe["when"]
    if not isinstance(when, dict):
        errors.append("when must be an object")
    else:
        unknown = sorted(set(when) - WHEN_KEYS)
        missing = sorted(WHEN_KEYS - set(when))
        need(not unknown, f"when: unknown keys: {', '.join(unknown)}")
        need(not missing, f"when: missing keys: {', '.join(missing)}")
        if not unknown and not missing:
            kinds = when["kind"]
            need(isinstance(kinds, list) and bool(kinds), "when.kind must be a non-empty list")
            if isinstance(kinds, list):
                bad = [kind for kind in kinds if kind not in REQUEST_KINDS]
                need(not bad, f"when.kind: unknown request kinds: {', '.join(map(str, bad))}")
            aspects = when["aspects"]
            need(isinstance(aspects, list) and bool(aspects), "when.aspects must be a non-empty list")
            if isinstance(aspects, list):
                bad = [aspect for aspect in aspects if aspect not in ASPECTS]
                need(not bad, f"when.aspects: unknown aspects: {', '.join(map(str, bad))}")
            need(when["energy"] in ENERGIES, f"when.energy must be one of {', '.join(ENERGIES)}")
            audience = when["audience"]
            need(isinstance(audience, list) and bool(audience), "when.audience must be a non-empty list")
            if isinstance(audience, list):
                bad = [item for item in audience if not isinstance(item, str) or not item.strip()]
                need(not bad, "when.audience entries must be non-empty strings")
            dialect = when["dialect"]
            need(isinstance(dialect, list) and bool(dialect), "when.dialect must be a non-empty list")
            if isinstance(dialect, list):
                bad = [item for item in dialect if item not in DIALECTS]
                need(not bad, f"when.dialect: unknown dialects: {', '.join(map(str, bad))}")
            duration = when["duration"]
            need(
                isinstance(duration, list)
                and len(duration) == 2
                and all(_is_int(value) for value in duration)
                and 5 <= duration[0] < duration[1] <= 120,
                "when.duration must be [low, high] whole seconds, 5 <= low < high <= 120",
            )

    # structure -------------------------------------------------------------
    structure = recipe["structure"]
    if not isinstance(structure, dict):
        errors.append("structure must be an object")
    else:
        unknown = sorted(set(structure) - STRUCTURE_KEYS)
        missing = sorted(STRUCTURE_KEYS - set(structure))
        need(not unknown, f"structure: unknown keys: {', '.join(unknown)}")
        need(not missing, f"structure: missing keys: {', '.join(missing)}")
        if not unknown and not missing:
            beat_list = structure["beats"]
            if not isinstance(beat_list, list) or not 3 <= len(beat_list) <= MAX_BEATS:
                errors.append(f"structure.beats must be a list of 3-{MAX_BEATS} beats")
            else:
                total = 0
                previous = None
                for index, beat in enumerate(beat_list, start=1):
                    if not isinstance(beat, dict):
                        errors.append(f"structure.beats[{index}] must be an object")
                        continue
                    unknown = sorted(set(beat) - BEAT_KEYS)
                    missing = sorted(BEAT_KEYS - set(beat))
                    need(not unknown, f"structure.beats[{index}]: unknown keys: {', '.join(unknown)}")
                    need(not missing, f"structure.beats[{index}]: missing keys: {', '.join(missing)}")
                    if unknown or missing:
                        continue
                    kind = beat["kind"]
                    bars = beat["bars"]
                    need(kind in ENGINE_KINDS, f"structure.beats[{index}]: unknown kind {kind!r}")
                    need(_is_int(bars) and 1 <= bars <= 8, f"structure.beats[{index}]: bars must be 1-8")
                    need(
                        isinstance(beat["role"], str) and bool(beat["role"].strip()),
                        f"structure.beats[{index}]: role must be a non-empty string",
                    )
                    if _is_int(bars):
                        total += bars
                    if kind == previous and kind != "device":
                        errors.append(
                            f"structure.beats[{index}]: two {kind!r} beats in a row "
                            "(only device may repeat, for a second screen)"
                        )
                    previous = kind
                need(
                    _is_int(structure["total_bars"]) and structure["total_bars"] == total,
                    f"structure.total_bars is {structure['total_bars']!r}; the beats sum to {total}",
                )
                need(
                    MIN_BARS <= total <= MAX_BARS,
                    f"structure is {total} bars; the film grammar is {MIN_BARS}-{MAX_BARS} "
                    "(16-52 s at 120 BPM)",
                )
                need(
                    beat_list[0]["kind"] == "hook" if beat_list and isinstance(beat_list[0], dict) else False,
                    "structure must open on a hook",
                )
                need(
                    beat_list[-1]["kind"] == "cta" if beat_list and isinstance(beat_list[-1], dict) else False,
                    "structure must close on a cta",
                )
                if isinstance(when, dict) and isinstance(when.get("duration"), list) and len(when["duration"]) == 2:
                    low, high = when["duration"]
                    need(
                        low <= total * 2 <= high,
                        f"structure is {total * 2:.0f} s but when.duration is {low}-{high} s",
                    )

    # look and palette ------------------------------------------------------
    looks = caps["looks"]
    need(recipe["look"] in looks, f"look {recipe['look']!r} is not in src/look/looks.ts ({', '.join(looks)})")

    palette = recipe["palette"]
    if not isinstance(palette, dict):
        errors.append("palette must be an object")
    else:
        unknown = sorted(set(palette) - PALETTE_KEYS)
        missing = sorted(PALETTE_REQUIRED - set(palette))
        need(not unknown, f"palette: unknown keys: {', '.join(unknown)}")
        need(not missing, f"palette: missing keys: {', '.join(missing)}")
        if not unknown and not missing:
            colors = caps["colors"]
            for name, value in palette.items():
                if not isinstance(value, str) or not HEX_RE.match(value):
                    errors.append(f"palette.{name}: {value!r} is not a #RRGGBB colour")
                    continue
                need(
                    value.upper() in colors,
                    f"palette.{name}: {value} is not a src/theme.ts token (add the token first)",
                )
            if isinstance(palette.get("ground"), str) and HEX_RE.match(palette["ground"]) and isinstance(
                palette.get("ink"), str
            ) and HEX_RE.match(palette["ink"]):
                contrast = _contrast(palette["ink"], palette["ground"])
                need(contrast >= 4.5, f"palette: ink on ground is {contrast:.2f}:1, below 4.5:1")
                ground_luma = _hex_luma(palette["ground"])
                if recipe["look"] == "ink-noir":
                    need(ground_luma <= 0.35, "palette: ink-noir needs a dark ground")
                if recipe["look"] in ("paper-clean", "ui-daylight"):
                    need(ground_luma >= 0.55, f"palette: {recipe['look']} needs a light ground")

    # typography ------------------------------------------------------------
    typography = recipe["typography"]
    if not isinstance(typography, dict):
        errors.append("typography must be an object")
    else:
        unknown = sorted(set(typography) - TYPO_KEYS)
        missing = sorted(TYPO_KEYS - set(typography))
        need(not unknown, f"typography: unknown keys: {', '.join(unknown)}")
        need(not missing, f"typography: missing keys: {', '.join(missing)}")
        if not unknown and not missing:
            need(typography["face"] in FONTS, f"typography.face must be one of {', '.join(FONTS)}")
            for key in ("display_px", "body_px"):
                values = typography[key]
                need(
                    isinstance(values, list)
                    and len(values) == 2
                    and all(_is_int(value) for value in values)
                    and 12 <= values[0] < values[1] <= 400,
                    f"typography.{key} must be [low, high] pixels, 12 <= low < high <= 400",
                )
            line_height = typography["line_height"]
            need(
                _is_num(line_height) and 1.0 <= line_height <= 1.6,
                "typography.line_height must be 1.0-1.6",
            )
            weights = typography["weights"]
            need(isinstance(weights, list) and bool(weights), "typography.weights must be a non-empty list")
            if isinstance(weights, list):
                bad = [weight for weight in weights if weight not in WEIGHTS]
                need(not bad, f"typography.weights: unknown weights: {', '.join(map(str, bad))}")
            rules = typography["rules"]
            need(
                isinstance(rules, list)
                and 2 <= len(rules) <= 6
                and all(isinstance(rule, str) and bool(rule.strip()) for rule in rules),
                "typography.rules must be 2-6 non-empty strings",
            )

    # layouts and cuts ------------------------------------------------------
    layouts = recipe["layouts"]
    need(
        isinstance(layouts, list) and 2 <= len(layouts) <= 5,
        "layouts must be 2-5 variants",
    )
    if isinstance(layouts, list):
        bad = [layout for layout in layouts if layout not in LAYOUTS]
        need(not bad, f"layouts: unknown variants: {', '.join(map(str, bad))}")
        need(len(set(layouts)) == len(layouts), "layouts: duplicate variants")

    transitions = recipe["transitions"]
    need(isinstance(transitions, list) and 1 <= len(transitions) <= 2, "transitions must be 1-2 cuts")
    if isinstance(transitions, list):
        bad = [transition for transition in transitions if transition not in TRANSITIONS]
        need(not bad, f"transitions: unknown cuts: {', '.join(map(str, bad))}")
        need(len(set(transitions)) == len(transitions), "transitions: duplicate cuts")

    # sfx -------------------------------------------------------------------
    sfx = recipe["sfx"]
    if not isinstance(sfx, dict):
        errors.append("sfx must be an object")
    else:
        unknown = sorted(set(sfx) - set(SFX_KEYS))
        missing = sorted(set(SFX_KEYS) - set(sfx))
        need(not unknown, f"sfx: unknown keys: {', '.join(unknown)}")
        need(not missing, f"sfx: missing keys: {', '.join(missing)}")
        if not unknown and not missing:
            stems = caps["stems"]
            for key, stem in sfx.items():
                if not isinstance(stem, str) or not stem:
                    errors.append(f"sfx.{key}: must be a stem name")
                elif stem not in stems:
                    errors.append(f"sfx.{key}: public/audio/sfx/{stem}.wav does not exist")

    # background and motion -------------------------------------------------
    need(recipe["background"] in BACKGROUNDS, f"background must be one of {', '.join(BACKGROUNDS)}")
    need(
        _is_num(recipe["motion"]) and 0.0 <= float(recipe["motion"]) <= RECIPE_MOTION_MAX,
        f"motion must be 0.0-{RECIPE_MOTION_MAX} in a recipe",
    )

    # reference -------------------------------------------------------------
    reference = recipe["reference"]
    if not isinstance(reference, dict):
        errors.append("reference must be an object")
    else:
        unknown = sorted(set(reference) - REFERENCE_KEYS)
        missing = sorted(REFERENCE_KEYS - set(reference))
        need(not unknown, f"reference: unknown keys: {', '.join(unknown)}")
        need(not missing, f"reference: missing keys: {', '.join(missing)}")
        if not unknown and not missing:
            for key, value in reference.items():
                need(
                    isinstance(value, str) and bool(value.strip()),
                    f"reference.{key} must be a non-empty string",
                )
            url = reference["url"]
            need(
                isinstance(url, str) and url.startswith("https://"),
                "reference.url must be an https:// URL",
            )
            note = reference["note"]
            need(
                isinstance(note, str) and len(note) >= 40,
                "reference.note must say what was adapted and what was not reused (>= 40 chars)",
            )
            need(
                any(word in note.lower() for word in ("pattern", "anatomy", "adapted")),
                "reference.note must state that a pattern was adapted, not an asset copied",
            )

    guardrails = recipe.get("guardrails")
    if guardrails is not None:
        need(
            isinstance(guardrails, list)
            and 1 <= len(guardrails) <= 4
            and all(isinstance(item, str) and bool(item.strip()) for item in guardrails),
            "guardrails must be 1-4 non-empty strings",
        )

    return errors


def archive_errors(recipes: dict[str, dict[str, Any]], caps: dict[str, Any]) -> dict[str, list[str]]:
    problems: dict[str, list[str]] = {}
    if len(recipes) < MIN_RECIPES:
        problems["(archive)"] = [f"only {len(recipes)} recipes; the archive restocks at {MIN_RECIPES}"]
    for recipe_id, recipe in recipes.items():
        errors = recipe_errors(recipe, caps)
        if errors:
            problems[recipe_id] = errors
    return problems


# --------------------------------------------------------------------------- #
# Briefs and scoring
# --------------------------------------------------------------------------- #


def read_json_source(source: str) -> Any:
    if source == "-":
        text = sys.stdin.read()
    else:
        path = pathlib.Path(source)
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise TemplateError(f"cannot read {source}: {exc}") from exc
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise TemplateError(f"{source}: invalid JSON ({exc.msg} at line {exc.lineno})") from exc


def _normalise_aspect(value: Any, where: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise TemplateError(f"{where}: aspect must be a string")
    aspect = ASPECT_ALIASES.get(value, value.strip().lower().replace(":", "x"))
    if aspect not in ASPECTS:
        raise TemplateError(f"{where}: aspect must be one of {', '.join(ASPECTS)}")
    return aspect


def aspect_of(width: Any, height: Any) -> str | None:
    if not _is_int(width) or not _is_int(height) or width <= 0 or height <= 0:
        return None
    ratio = width / height
    for name, (w, h) in (("16x9", (16, 9)), ("9x16", (9, 16)), ("1x1", (1, 1))):
        if abs(ratio - w / h) / (w / h) <= 0.02:
            return name
    return None


def derive_energy(duration: float | None, look: Any) -> str:
    if look == "vivid-launch":
        return "high"
    if duration is None:
        return "mid"
    if duration <= 26:
        return "high"
    if duration >= 48:
        return "low"
    return "mid"


def normalize_brief(data: Any, aspect: str | None = None, energy: str | None = None) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise TemplateError("a brief must be a JSON object (film.json, or a hint object with kind/energy/aspect)")
    beat_kinds: list[str] = []
    total_bars = 0
    beats = data.get("beats")
    if beats is not None:
        if not isinstance(beats, list):
            raise TemplateError("brief: beats must be a list")
        for index, beat in enumerate(beats, start=1):
            if not isinstance(beat, dict) or beat.get("kind") not in ENGINE_KINDS:
                raise TemplateError(
                    f"brief: beats[{index}].kind must be one of {', '.join(ENGINE_KINDS)}"
                )
            bars = beat.get("bars")
            if not _is_int(bars) or bars <= 0:
                raise TemplateError(f"brief: beats[{index}].bars must be a positive whole number")
            beat_kinds.append(beat["kind"])
            total_bars += bars

    bpm = data.get("bpm", 120)
    if not _is_num(bpm) or bpm <= 0:
        bpm = 120
    duration = round(total_bars * 240.0 / float(bpm), 2) if total_bars else None

    brief_aspect = _normalise_aspect(aspect, "--aspect") or _normalise_aspect(
        data.get("aspect"), "brief"
    ) or aspect_of(data.get("width"), data.get("height"))

    if energy is not None and energy not in ENERGIES:
        raise TemplateError(f"--energy must be one of {', '.join(ENERGIES)}")
    brief_energy = energy or data.get("energy") or derive_energy(duration, data.get("look"))
    if brief_energy not in ENERGIES:
        raise TemplateError(f"brief: energy must be one of {', '.join(ENERGIES)}")

    dialect = data.get("dialect")
    if dialect is not None and dialect not in DIALECTS:
        raise TemplateError(f"brief: dialect must be one of {', '.join(DIALECTS)}")

    audience = data.get("audience") or []
    if not isinstance(audience, list) or any(not isinstance(item, str) or not item.strip() for item in audience):
        raise TemplateError("brief: audience must be a list of non-empty strings")

    look = data.get("look")
    kind = data.get("kind")
    if kind is not None and kind not in REQUEST_KINDS:
        raise TemplateError(f"brief: kind must be one of {', '.join(sorted(REQUEST_KINDS))}")

    return {
        "slug": data.get("slug") or data.get("title") or "brief",
        "kind": kind,
        "aspect": brief_aspect,
        "energy": brief_energy,
        "dialect": dialect,
        "audience": audience,
        "look": look,
        "beat_kinds": beat_kinds,
        "total_bars": total_bars or None,
        "duration_s": duration,
        "bpm": bpm,
    }


def _lcs(first: list[str], second: list[str]) -> int:
    previous = [0] * (len(second) + 1)
    for a in first:
        current = [0]
        for index, b in enumerate(second, start=1):
            current.append(previous[index - 1] + 1 if a == b else max(previous[index], current[index - 1]))
        previous = current
    return previous[-1]


def _adjacent_energy(first: str, second: str) -> bool:
    order = list(ENERGIES)
    return abs(order.index(first) - order.index(second)) == 1


def score_recipe(recipe: dict[str, Any], brief: dict[str, Any]) -> tuple[int, list[str]]:
    """Score 0-100 with the reasons that produced the number."""
    score = 0
    reasons: list[str] = []
    when = recipe["when"]
    structure = recipe["structure"]

    kind = brief.get("kind")
    if kind and kind in when["kind"]:
        # The first entry in ``when.kind`` is the template's home genre. Matching a
        # sibling category is worth less than matching the genre the cut was
        # designed for, otherwise an explainer and an editorial at the same length
        # score identically.
        if kind == when["kind"][0]:
            score += 15
            reasons.append(f"request kind {kind} is the template's home genre (+15)")
        else:
            score += 8
            reasons.append(f"request kind {kind} is a family match, not the home genre (+8)")

    beat_kinds = brief["beat_kinds"]
    if beat_kinds:
        structure_kinds = [beat["kind"] for beat in structure["beats"]]
        matched = _lcs(beat_kinds, structure_kinds)
        points = round(40 * matched / len(beat_kinds))
        score += points
        if points:
            reasons.append(
                f"beat sequence matches {matched}/{len(beat_kinds)} kinds "
                f"({', '.join(beat_kinds)} vs {', '.join(structure_kinds)}) (+{points})"
            )
    else:
        score += 15
        reasons.append("no beat map in the brief; structural fit is neutral (+15)")

    look = brief.get("look")
    if look == recipe["look"]:
        score += 10
        reasons.append(f"look {look} matches the brief (+10)")

    aspect = brief.get("aspect")
    if aspect is not None and aspect in when["aspects"]:
        score += 8
        reasons.append(f"aspect {aspect} is supported by the template (+8)")

    energy = brief["energy"]
    if energy == when["energy"]:
        score += 8
        reasons.append(f"energy {energy} matches (+8)")
    elif _adjacent_energy(energy, when["energy"]):
        score += 4
        reasons.append(f"energy {energy} is one step from the template's {when['energy']} (+4)")

    duration = brief.get("duration_s")
    if duration is not None:
        low, high = when["duration"]
        if low <= duration <= high:
            score += 6
            reasons.append(f"runtime {duration:.0f} s sits inside the template's {low}-{high} s (+6)")
    else:
        score += 6

    total_bars = brief.get("total_bars")
    if total_bars:
        difference = abs(total_bars - structure["total_bars"])
        closeness = max(0.0, 1.0 - difference / total_bars)
        points = round(5 * closeness)
        score += points
        if points:
            reasons.append(
                f"structure length {structure['total_bars']} bars vs the brief's {total_bars} (+{points})"
            )
    else:
        score += 5

    dialect = brief.get("dialect")
    if dialect and dialect in when["dialect"]:
        score += 4
        reasons.append(f"dialect {dialect} is in the template's tag set (+4)")

    audience = brief.get("audience") or []
    shared = sorted(set(audience) & set(when["audience"]))
    if shared:
        score += 4
        reasons.append(f"audience tag match: {', '.join(shared)} (+4)")

    return min(score, 100), reasons


def pick_brief(brief: dict[str, Any], recipes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    scored = []
    for recipe_id, recipe in recipes.items():
        score, reasons = score_recipe(recipe, brief)
        scored.append({"id": recipe_id, "score": score, "reasons": reasons})
    scored.sort(key=lambda row: (-row["score"], row["id"]))
    best = scored[0]
    runner_up = scored[1] if len(scored) > 1 else None
    return {
        "brief": brief,
        "picked": best["id"],
        "score": best["score"],
        "reasons": best["reasons"],
        "runner_up": None if runner_up is None else {"id": runner_up["id"], "score": runner_up["score"]},
        "margin": 0 if runner_up is None else best["score"] - runner_up["score"],
        "ambiguous": runner_up is None or best["score"] - runner_up["score"] < MIN_PICK_MARGIN,
        "alternatives": [{"id": row["id"], "score": row["score"]} for row in scored[1:5]],
    }


# --------------------------------------------------------------------------- #
# The style contract
# --------------------------------------------------------------------------- #


def style_from_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    return {
        "template": recipe["id"],
        "look": recipe["look"],
        "motion": round(float(recipe["motion"]), 2),
        "background": recipe["background"],
        "transitions": list(recipe["transitions"]),
        "sfx": dict(recipe["sfx"]),
    }


def style_errors(style: Any, caps: dict[str, Any], where: str = "style") -> list[str]:
    errors: list[str] = []
    if not isinstance(style, dict):
        return [f"{where} must be a JSON object"]
    unknown = sorted(set(style) - set(STYLE_KEYS))
    missing = sorted(set(STYLE_KEYS) - set(style))
    if unknown:
        errors.append(f"{where}: unknown keys: {', '.join(unknown)}")
    if missing:
        errors.append(f"{where}: missing keys: {', '.join(missing)}")
    if unknown or missing:
        return errors
    if not isinstance(style["template"], str) or not style["template"].strip():
        errors.append(f"{where}.template must be a non-empty string")
    if style["look"] not in caps["looks"]:
        errors.append(f"{where}.look {style['look']!r} is not in src/look/looks.ts")
    if not _is_num(style["motion"]) or not 0.0 <= float(style["motion"]) <= STYLE_MOTION_MAX:
        errors.append(f"{where}.motion must be 0.0-{STYLE_MOTION_MAX}")
    if style["background"] not in BACKGROUNDS:
        errors.append(f"{where}.background must be one of {', '.join(BACKGROUNDS)}")
    transitions = style["transitions"]
    if not isinstance(transitions, list) or not 1 <= len(transitions) <= 2:
        errors.append(f"{where}.transitions must be a list of 1-2 cuts")
    elif any(item not in TRANSITIONS for item in transitions):
        errors.append(f"{where}.transitions: unknown cuts: {', '.join(map(str, transitions))}")
    elif len(set(transitions)) != len(transitions):
        errors.append(f"{where}.transitions must not repeat a cut")
    sfx = style["sfx"]
    if not isinstance(sfx, dict) or set(sfx) != set(SFX_KEYS):
        errors.append(f"{where}.sfx must have exactly the keys {', '.join(SFX_KEYS)}")
    else:
        for key, stem in sfx.items():
            if not isinstance(stem, str) or stem not in caps["stems"]:
                errors.append(f"{where}.sfx.{key}: public/audio/sfx/{stem}.wav does not exist")
    return errors


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #


def _recipe(recipes: dict[str, dict[str, Any]], recipe_id: str) -> dict[str, Any]:
    recipe = recipes.get(recipe_id)
    if recipe is None:
        close = difflib.get_close_matches(recipe_id, recipes, n=3)
        hint = f"; did you mean {', '.join(close)}?" if close else ""
        raise TemplateError(f"unknown template {recipe_id!r}{hint}")
    return recipe


def _write_json(path: pathlib.Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _rows(recipes: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for recipe_id, recipe in recipes.items():
        structure = recipe["structure"]
        rows.append(
            {
                "id": recipe_id,
                "title": recipe["title"],
                "beats": len(structure["beats"]),
                "bars": structure["total_bars"],
                "seconds": structure["total_bars"] * 2,
                "look": recipe["look"],
                "background": recipe["background"],
                "motion": recipe["motion"],
                "energy": recipe["when"]["energy"],
                "transitions": ",".join(recipe["transitions"]),
                "sfx": recipe["sfx"],
            }
        )
    return rows


def command_list(recipes: dict[str, dict[str, Any]], as_json: bool) -> int:
    rows = _rows(recipes)
    if as_json:
        print(json.dumps({"version": 1, "count": len(rows), "recipes": rows}, ensure_ascii=True, indent=2))
        return 0
    header = (
        f"{'ID':<20} {'BEATS':>5} {'BARS':>4} {'S':>4} {'LOOK':<13} "
        f"{'BACKGROUND':<13} {'MOT':>4} {'ENERGY':<6} CUTS"
    )
    print(header)
    print("-" * len(header))
    for row in rows:
        print(
            f"{row['id']:<20} {row['beats']:>5} {row['bars']:>4} {row['seconds']:>4.0f} "
            f"{row['look']:<13} {row['background']:<13} {row['motion']:>4.2f} "
            f"{row['energy']:<6} {row['transitions']}"
        )
    print(f"\n{len(rows)} recipes in {_rel(TEMPLATES_DIR)}")
    return 0


def command_show(recipes: dict[str, dict[str, Any]], recipe_id: str, as_json: bool) -> int:
    recipe = _recipe(recipes, recipe_id)
    if as_json:
        print(json.dumps(recipe, ensure_ascii=True, indent=2))
        return 0
    when = recipe["when"]
    structure = recipe["structure"]
    typography = recipe["typography"]
    print(f"{recipe['id']} - {recipe['title']}")
    print(f"  when          {', '.join(when['kind'])} | {', '.join(when['aspects'])} | "
          f"{when['energy']} energy | {', '.join(when['dialect'])}")
    print(f"  audience      {', '.join(when['audience'])}")
    print(f"  runtime       {when['duration'][0]}-{when['duration'][1]} s "
          f"({structure['total_bars']} bars, {structure['total_bars'] * 2} s)")
    print("  structure")
    for index, beat in enumerate(structure["beats"], start=1):
        print(f"    {index}. {beat['kind']:<6} {beat['bars']} bar  {beat['role']}")
    print(f"  look          {recipe['look']} on {recipe['background']}, motion {recipe['motion']:.2f}")
    palette = ", ".join(f"{name} {value}" for name, value in recipe["palette"].items())
    print(f"  palette       {palette}")
    print(f"  type          {typography['face']} {typography['display_px'][0]}-{typography['display_px'][1]} px, "
          f"lh {typography['line_height']}, weights {', '.join(map(str, typography['weights']))}")
    for rule in typography["rules"]:
        print(f"    - {rule}")
    print(f"  layouts       {', '.join(recipe['layouts'])}")
    print(f"  cuts          {', '.join(recipe['transitions'])}")
    print(f"  sfx           intro {recipe['sfx']['intro']}, cut {recipe['sfx']['cut']}, "
          f"accent {recipe['sfx']['accent']}")
    reference = recipe["reference"]
    print(f"  reference     {reference['site']} / {reference['pattern']} - {reference['url']}")
    print(f"                {reference['move']}")
    print(f"                {reference['note']}")
    for guardrail in recipe.get("guardrails", []):
        print(f"  guardrail     {guardrail}")
    return 0


def command_pick(
    recipes: dict[str, dict[str, Any]],
    brief_source: str,
    aspect: str | None,
    energy: str | None,
    as_json: bool,
) -> int:
    brief = normalize_brief(read_json_source(brief_source), aspect, energy)
    result = pick_brief(brief, recipes)
    if as_json:
        print(json.dumps(result, ensure_ascii=True, indent=2))
        return 0
    print(f"brief: {brief_source}")
    if brief["beat_kinds"]:
        print(f"  beats   {', '.join(brief['beat_kinds'])} "
              f"({brief['total_bars']} bars, {brief['duration_s']:.1f} s)")
    else:
        print("  beats   none (hint-only brief)")
    print(f"  aspect  {brief['aspect'] or 'unknown'}")
    print(f"  energy  {brief['energy']}")
    if brief["look"]:
        print(f"  look    {brief['look']}")
    print(f"picked: {result['picked']} (score {result['score']}/100)")
    for reason in result["reasons"]:
        print(f"  - {reason}")
    if result["runner_up"]:
        print(f"runner-up: {result['runner_up']['id']} ({result['runner_up']['score']}), "
              f"margin {result['margin']}")
    if result["ambiguous"]:
        print(f"warning: margin below {MIN_PICK_MARGIN}; the brief is ambiguous, "
              "compare the runner-up before committing to a template")
    return 0


def command_apply(
    recipes: dict[str, dict[str, Any]],
    caps: dict[str, Any],
    recipe_id: str,
    film_source: str,
    out_source: str,
) -> int:
    recipe = _recipe(recipes, recipe_id)
    recipe_problems = recipe_errors(recipe, caps)
    if recipe_problems:
        raise TemplateError(f"{recipe_id} is not a valid recipe: {recipe_problems[0]}")

    film = normalize_brief(read_json_source(film_source))
    style = style_from_recipe(recipe)
    problems = style_errors(style, caps)
    if problems:
        raise TemplateError(f"refusing to write an invalid style contract: {problems[0]}")

    out_path = pathlib.Path(out_source)
    if not out_path.is_absolute():
        out_path = pathlib.Path.cwd() / out_path
    out_path = out_path.resolve()
    _write_json(out_path, style)

    print(f"film: {film_source} ({film['slug']}, {len(film['beat_kinds'])} beats, "
          f"{film['total_bars'] or 0} bars, {film['duration_s'] or 0:.1f} s)")
    print(f"wrote: {_rel(out_path)}")
    print(f"  template     {style['template']}")
    print(f"  look         {style['look']}")
    print(f"  motion       {style['motion']:.2f}")
    print(f"  background   {style['background']}")
    print(f"  transitions  {', '.join(style['transitions'])}")
    print(f"  sfx          intro {style['sfx']['intro']} / cut {style['sfx']['cut']} / "
          f"accent {style['sfx']['accent']}")
    return 0


def command_check(recipes: dict[str, dict[str, Any]], caps: dict[str, Any]) -> int:
    problems = archive_errors(recipes, caps)
    looks = ", ".join(caps["looks"])
    print(f"template archive: {_rel(TEMPLATES_DIR)} ({len(recipes)} recipes)")
    print(f"capabilities: {len(caps['looks'])} looks ({looks}); {len(BACKGROUNDS)} backgrounds; "
          f"{len(TRANSITIONS)} transitions; {len(caps['stems'])} sfx stems; "
          f"{len(caps['colors'])} theme colours")
    if problems:
        for recipe_id, errors in problems.items():
            for error in errors:
                print(f"FAIL {recipe_id}: {error}")
        valid = len(recipes) - len([recipe_id for recipe_id in problems if recipe_id != "(archive)"])
        print(f"\n{valid}/{len(recipes)} recipes valid")
        return 1
    print(f"PASS: {len(recipes)}/{len(recipes)} recipes valid; style contract keys: "
          f"{', '.join(STYLE_KEYS)}")
    return 0


def command_self_test(
    recipes: dict[str, dict[str, Any]], caps: dict[str, Any]
) -> int:
    problems = archive_errors(recipes, caps)
    print(f"self-test: {_rel(TEMPLATES_DIR)} ({len(recipes)} recipes)")
    if problems:
        for recipe_id, errors in problems.items():
            for error in errors:
                print(f"FAIL archive {recipe_id}: {error}")
        print("SELF-TEST FAIL (archive does not validate)")
        return 1
    print(f"archive valid: {len(recipes)}/{len(recipes)} recipes")

    _write_json(OUT_DIR / "archive.json", {"version": 1, "recipes": list(recipes.values())})

    results = []
    all_ok = True
    for name, expected, raw_brief in SELF_TEST_BRIEFS:
        brief_path = OUT_DIR / "briefs" / f"{name}.json"
        _write_json(brief_path, raw_brief)
        try:
            brief = normalize_brief(raw_brief)
            result = pick_brief(brief, recipes)
            pick_ok = (
                result["picked"] == expected
                and result["score"] >= MIN_PICK_SCORE
                and result["margin"] >= MIN_PICK_MARGIN
            )
            style = style_from_recipe(recipes[result["picked"]])
            style_problems = style_errors(style, caps)
            style_ok = not style_problems
            style_path = OUT_DIR / "styles" / f"{name}.json"
            _write_json(style_path, style)
            _write_json(
                OUT_DIR / "picks" / f"{name}.json",
                {
                    "brief": name,
                    "source": _rel(brief_path),
                    "expected": expected,
                    "picked": result["picked"],
                    "score": result["score"],
                    "margin": result["margin"],
                    "reasons": result["reasons"],
                    "alternatives": result["alternatives"],
                    "style": _rel(style_path),
                    "style_valid": style_ok,
                },
            )
        except TemplateError as exc:
            pick_ok, style_ok, result = False, False, None
            style_problems = [str(exc)]
        status = "PASS" if (pick_ok and style_ok) else "FAIL"
        all_ok = all_ok and pick_ok and style_ok
        if result is None:
            print(f"{status} {name}: cannot score ({style_problems[0]})")
            results.append({"brief": name, "status": status, "error": style_problems[0]})
            continue
        print(
            f"{status} pick {name}: expected {expected}, picked {result['picked']} "
            f"({result['score']}, margin {result['margin']})"
        )
        print(
            f"     style {name}: {style['template']} -> {style['look']}/{style['background']}, "
            f"{'valid' if style_ok else 'INVALID: ' + style_problems[0]}"
        )
        results.append(
            {
                "brief": name,
                "expected": expected,
                "picked": result["picked"],
                "score": result["score"],
                "margin": result["margin"],
                "pick_ok": pick_ok,
                "style_ok": style_ok,
                "status": status,
            }
        )

    passed = sum(1 for row in results if row.get("status") == "PASS")
    _write_json(
        OUT_DIR / "self-test.json",
        {
            "version": 1,
            "recipes": len(recipes),
            "archive_valid": True,
            "passed": all_ok,
            "summary": f"{passed}/{len(results)} picks and styles",
            "results": results,
        },
    )
    print(f"\nSELF-TEST {'PASS' if all_ok else 'FAIL'} "
          f"({passed}/{len(results)} picks, {len(recipes)}/{len(recipes)} recipes, "
          f"style schema valid)")
    return 0 if all_ok else 1


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="templates.py",
        description="Motion/design recipe archive and the film/style.json contract.",
    )
    parser.add_argument("--check", action="store_true", help="validate every recipe in the archive")
    parser.add_argument("--self-test", action="store_true", help="validate the archive, score 4 synthetic briefs, apply the winners")

    sub = parser.add_subparsers(dest="command", metavar="command")

    list_parser = sub.add_parser("list", help="print the archive")
    list_parser.add_argument("--json", action="store_true", help="machine-readable output")

    show_parser = sub.add_parser("show", help="print one recipe")
    show_parser.add_argument("id", help="recipe id")
    show_parser.add_argument("--json", action="store_true", help="machine-readable output")

    pick_parser = sub.add_parser("pick", help="score the archive against a brief")
    pick_parser.add_argument("--brief", required=True, metavar="FILE|-", help="film.json, or - for stdin")
    pick_parser.add_argument("--aspect", choices=ASPECTS, help="override the brief's aspect")
    pick_parser.add_argument("--energy", choices=ENERGIES, help="override the brief's energy")
    pick_parser.add_argument("--json", action="store_true", help="machine-readable output")

    apply_parser = sub.add_parser("apply", help="write film/style.json for a recipe")
    apply_parser.add_argument("id", help="recipe id")
    apply_parser.add_argument("--film", required=True, metavar="FILE", help="the film.json the style is for")
    apply_parser.add_argument("--out", required=True, metavar="FILE", help="where to write style.json")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        caps = capabilities()
        recipes = load_archive()
        if args.self_test:
            return command_self_test(recipes, caps)
        if args.check:
            return command_check(recipes, caps)
        # Everything below scores, shows or applies a recipe, so a malformed
        # archive must stop the command instead of raising a KeyError halfway in.
        problems = archive_errors(recipes, caps)
        if problems:
            first_id, first_errors = next(iter(problems.items()))
            raise TemplateError(
                f"archive is invalid ({len(problems)} problem recipe(s); "
                f"{first_id}: {first_errors[0]}). Run --check for the full list."
            )
        if args.command == "list":
            return command_list(recipes, args.json)
        if args.command == "show":
            return command_show(recipes, args.id, args.json)
        if args.command == "pick":
            return command_pick(recipes, args.brief, args.aspect, args.energy, args.json)
        if args.command == "apply":
            return command_apply(recipes, caps, args.id, args.film, args.out)
        parser.print_help()
        return 0
    except TemplateError as exc:
        print(f"templates: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

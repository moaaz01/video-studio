#!/usr/bin/env python3
"""The platform/aspect matrix shared by the director and the exporter.

One film, four canvases: 16:9, 9:16, 4:5 and 1:1. Every platform gets the subset
it actually uses, plus the safe-area preset that matches its chrome. The exporter
renders the union, so a Reel is never delivered without its square and wide cuts.
"""
from __future__ import annotations

PLATFORMS: dict[str, dict] = {
    "x": {"label": "X", "aspects": ["16x9", "1x1"], "safe": "feed", "max_s": 140},
    "instagram": {"label": "Instagram", "aspects": ["9x16", "4x5", "1x1"], "safe": "reels", "max_s": 90},
    "tiktok": {"label": "TikTok", "aspects": ["9x16"], "safe": "reels", "max_s": 60},
    "youtube": {"label": "YouTube", "aspects": ["16x9", "9x16"], "safe": "shorts", "max_s": 60},
    "linkedin": {"label": "LinkedIn", "aspects": ["1x1", "16x9"], "safe": "feed", "max_s": 120},
    "snapchat": {"label": "Snapchat", "aspects": ["9x16"], "safe": "story", "max_s": 60},
    "facebook": {"label": "Facebook", "aspects": ["4x5", "9x16", "16x9"], "safe": "feed", "max_s": 120},
}

ASPECTS: dict[str, dict] = {
    "16x9": {"composition": "Studio16x9", "width": 1920, "height": 1080, "label": "16:9"},
    "9x16": {"composition": "Studio9x16", "width": 1080, "height": 1920, "label": "9:16"},
    "4x5": {"composition": "Portrait4x5", "width": 1080, "height": 1350, "label": "4:5"},
    "1x1": {"composition": "Square1x1", "width": 1080, "height": 1080, "label": "1:1"},
}

ALL_ASPECTS = ["9x16", "16x9", "4x5", "1x1"]


def targets_for(platforms: list[str], primary: str | None = None) -> list[str]:
    """Union of the platform aspects, primary first, then the four masters."""
    wanted: list[str] = []
    if primary:
        wanted.append(primary)
    for name in platforms:
        spec = PLATFORMS.get(name)
        if spec:
            for aspect in spec["aspects"]:
                if aspect not in wanted:
                    wanted.append(aspect)
    for aspect in ALL_ASPECTS:
        if aspect not in wanted:
            wanted.append(aspect)
    return wanted


def safe_for(platforms: list[str]) -> dict[str, str]:
    """The strictest chrome for each platform; the exporter checks each target."""
    return {name: PLATFORMS[name]["safe"] for name in platforms if name in PLATFORMS}


def max_seconds(platforms: list[str]) -> int | None:
    values = [PLATFORMS[name]["max_s"] for name in platforms if name in PLATFORMS]
    return min(values) if values else None

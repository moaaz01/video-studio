"""Tests for the UI mockup factory's manifest, tokens and RTL rules.

    python -m unittest tests.test_mockups -v

The factory is a Vite app, so these tests do not render React. They guard the
contract between `screens.json`, `brands.json`, the screen registry and the
captured PNGs — the parts a Python gate can check without a browser.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "mockups"
SCREENS = TOOL / "screens.json"
BRANDS = TOOL / "brands.json"
STYLES = TOOL / "src" / "styles" / "theme.css"
DATA = TOOL / "src" / "data" / "waha.ts"
CATALOGUES = TOOL / "src" / "data" / "index.ts"
REGISTRY = TOOL / "src" / "screens" / "index.tsx"
MANIFEST = ROOT / "public" / "mockups" / "manifest.json"

sys.path.insert(0, str(ROOT / "scripts"))
import mockups  # noqa: E402

REQUIRED_TOKENS = {
    "accent",
    "accentDeep",
    "accentSoft",
    "accentInk",
    "paper",
    "surface",
    "sunken",
    "ink",
    "muted",
    "border",
    "borderStrong",
    "gold",
    "goldSoft",
    "rose",
    "shadow",
}


class ManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.screens = json.loads(SCREENS.read_text(encoding="utf-8"))
        self.brands = json.loads(BRANDS.read_text(encoding="utf-8"))

    def test_version_and_screens(self) -> None:
        self.assertEqual(self.screens["version"], 1)
        self.assertTrue(self.screens["screens"])
        self.assertTrue(self.screens["outDir"].startswith("public/"))

    def test_slugs_are_unique_and_well_formed(self) -> None:
        slugs = [screen["slug"] for screen in self.screens["screens"]]
        self.assertEqual(len(slugs), len(set(slugs)))
        for slug in slugs:
            self.assertRegex(slug, r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

    def test_every_screen_is_complete(self) -> None:
        for screen in self.screens["screens"]:
            for key in ("slug", "title", "screen", "brand", "mode", "width", "height", "scale"):
                self.assertIn(key, screen, screen.get("slug"))
            self.assertIn(screen["brand"], self.brands, screen["slug"])
            self.assertIn(screen["mode"], {"light", "dark"}, screen["slug"])
            self.assertGreater(screen["width"], 0)
            self.assertGreater(screen["height"], 0)
            self.assertIn(screen["scale"], {1, 2, 3})

    def test_registry_knows_every_screen_kind(self) -> None:
        registry = REGISTRY.read_text(encoding="utf-8")
        keys = set(re.findall(r"^\s{2}([a-zA-Z]+):", registry, re.MULTILINE))
        for screen in self.screens["screens"]:
            self.assertIn(screen["screen"], keys, screen["slug"])

    def test_no_duplicate_outputs(self) -> None:
        paths = []
        for screen in self.screens["screens"]:
            prefix = f"{screen['brand']}-"
            name = screen["slug"].removeprefix(prefix)
            paths.append(f"mockups/{screen['brand']}/{name}.png")
        self.assertEqual(len(paths), len(set(paths)))


class BrandTests(unittest.TestCase):
    def setUp(self) -> None:
        self.brands = json.loads(BRANDS.read_text(encoding="utf-8"))

    def test_every_brand_has_both_modes_and_all_tokens(self) -> None:
        for key, brand in self.brands.items():
            if key.startswith("$"):
                continue
            self.assertEqual(brand["slug"], key)
            for mode in ("light", "dark"):
                self.assertIn(mode, brand, key)
                self.assertEqual(set(brand[mode]), REQUIRED_TOKENS, f"{key}.{mode}")
                for token, value in brand[mode].items():
                    if token == "shadow":
                        self.assertRegex(value, r"^\d{1,3},\d{1,3},\d{1,3}$", f"{key}.{mode}.{token}")
                    else:
                        self.assertRegex(value, r"^#[0-9A-Fa-f]{6}$", f"{key}.{mode}.{token}")

    def test_every_brand_has_a_catalogue(self) -> None:
        registry = CATALOGUES.read_text(encoding="utf-8")
        keys = set(re.findall(r"^\s{2}([a-zA-Z0-9]+):", registry, re.MULTILINE))
        for key in self.brands:
            if key.startswith("$"):
                continue
            self.assertIn(key, keys, f"add src/data/{key}.ts and register it")

    def test_brand_name_is_arabic(self) -> None:
        for key, brand in self.brands.items():
            if key.startswith("$"):
                continue
            self.assertRegex(brand["name"], r"[\u0600-\u06FF]", key)


class CopyTests(unittest.TestCase):
    def test_fixture_uses_western_digits_only(self) -> None:
        text = DATA.read_text(encoding="utf-8")
        self.assertIsNone(
            re.search(r"[\u0660-\u0669\u06F0-\u06F9]", text),
            "Arabic-Indic digits found in the fixture; use 123",
        )

    def test_fixture_has_no_placeholder_lorem(self) -> None:
        text = DATA.read_text(encoding="utf-8")
        self.assertNotIn("lorem", text.lower())
        self.assertNotIn("TODO", text)


class CssTests(unittest.TestCase):
    def test_no_physical_rtl_properties(self) -> None:
        css = STYLES.read_text(encoding="utf-8")
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
        forbidden = [
            r"(?<![\w-])left\s*:",
            r"(?<![\w-])right\s*:",
            r"margin-(?:left|right)\s*:",
            r"padding-(?:left|right)\s*:",
            r"border-(?:left|right)\s*:",
            r"text-align\s*:\s*(?:left|right)\b",
        ]
        for pattern in forbidden:
            self.assertIsNone(re.search(pattern, css), pattern)

    def test_arabic_letter_spacing_is_zero(self) -> None:
        css = STYLES.read_text(encoding="utf-8")
        self.assertIn("letter-spacing: 0", css)


class PngTests(unittest.TestCase):
    def test_png_size_reads_ihdr(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "tiny.png"
            path.write_bytes(
                b"\x89PNG\r\n\x1a\n"
                + b"\x00\x00\x00\rIHDR"
                + struct.pack(">II", 7, 9)
                + b"\x08\x06\x00\x00\x00"
            )
            self.assertEqual(mockups.png_size(path), (7, 9))

    def test_png_size_rejects_other_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "no.png"
            path.write_bytes(b"not a png at all")
            with self.assertRaises(ValueError):
                mockups.png_size(path)


@unittest.skipUnless(MANIFEST.exists(), "no captures yet — run the capture step")
class CaptureTests(unittest.TestCase):
    def test_manifest_matches_the_pngs(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], 1)
        for entry in manifest["screens"]:
            path = ROOT / "public" / entry["path"]
            self.assertTrue(path.exists(), entry["path"])
            data = path.read_bytes()
            self.assertEqual(mockups.png_size(path), (entry["width"], entry["height"]))
            self.assertEqual(len(data), entry["bytes"], entry["path"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), entry["sha256"], entry["path"])

    def test_verify_cli_passes(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "mockups.py"), "verify"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class CliTests(unittest.TestCase):
    def test_help(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "mockups.py"), "--help"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("capture", result.stdout)
        self.assertIn("verify", result.stdout)

    def test_studio_delegate(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "studio.py"), "mockups", "list"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("waha-storefront", result.stdout)


if __name__ == "__main__":
    unittest.main()

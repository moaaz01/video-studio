#!/usr/bin/env python3
"""
Ground the film in the app that actually exists.

A promo film that invents its own screens is a lie the audience catches in two
seconds. This script reads the real project and writes the inventory the build
steps against:

  python scripts/ui_source.py --dir C:/path/to/app
      -> film/ui-source.json   screens, nav routes, every user-facing string in
                               each locale, colour tokens, type resources
      -> printed table          what the project actually has

  python scripts/ui_source.py --rea              the reverse-engineering commands
                                                 (device screen, device density,
                                                 APK string tables, web viewport)
  python scripts/ui_source.py --capture <serial> one real screenshot -> evidence/

Two directions of truth, use both:
- source scan   (this file, no device needed): names, strings, tokens, routes.
- device capture (REA + adb): what the screen *looks* like at the real density,
  which is the part a rebuild gets wrong.

Output is generated data and is gitignored: film/ui-source.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DEFAULT = ROOT / "film" / "ui-source.json"

COMPOSABLE = re.compile(r"@Composable\s+(?:private\s+|internal\s+|public\s+)?fun\s+(\w+)\s*\(", re.S)
ROUTE_CALL = re.compile(r"""composable\s*\(\s*(?:route\s*=\s*)?"([^"]+)\"""")
ROUTE_CONST = re.compile(r"""const\s+val\s+(\w+)\s*=\s*"([^"]+)\"""")
STRING_ENTRY = re.compile(r"<string\s+name=\"([^\"]+)\"[^>]*>(.*?)</string>", re.S)
COLOR_XML = re.compile(r"<color\s+name=\"([^\"]+)\"\s*>\s*([^<]+?)\s*</color>", re.S)
COLOR_KT = re.compile(r"val\s+(\w+)\s*=\s*Color\(\s*0x([0-9A-Fa-f]{8})")
FONT_KT = re.compile(r"FontFamily\(|resId\s*=\s*R\.font\.(\w+)")
NAMESPACE = re.compile(r"(?:namespace|applicationId)\s*=?\s*\"([^\"]+)\"")
CDATA = re.compile(r"<!\[CDATA\[(.*?)\]\]>", re.S)


def read(path: pathlib.Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def clean_xml_value(value: str) -> str:
    value = CDATA.sub(r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("\\'", "'").replace('\\"', '"').strip()
    return re.sub(r"\s+", " ", value)


def scan_screens(root: pathlib.Path) -> tuple[list[dict], list[str]]:
    screens, warnings = [], []
    kt = list(root.rglob("*.kt"))
    for path in kt:
        text = read(path)
        names = COMPOSABLE.findall(text)
        if not names:
            continue
        rel = path.relative_to(root).as_posix()
        if "/test/" in rel or "/androidTest/" in rel:
            continue
        screens.append({"file": rel, "composables": names, "supports_rtl": "Rtl" if "Rtl" in text else ""})
    screens.sort(key=lambda s: s["file"])
    if not screens:
        warnings.append("no @Composable functions found — is --dir the app module or the repo root?")
    return screens, warnings


def scan_routes(root: pathlib.Path) -> list[str]:
    routes: set[str] = set()
    for path in root.rglob("*.kt"):
        text = read(path)
        routes.update(ROUTE_CALL.findall(text))
        for _name, value in ROUTE_CONST.findall(text):
            if value.startswith("/") or re.fullmatch(r"[a-z0-9_/{}-]+", value):
                routes.add(value)
    return sorted(r for r in routes if r and "/" in r or r in {"home", "settings", "library"})


def scan_strings(root: pathlib.Path) -> dict[str, dict[str, str]]:
    tables: dict[str, dict[str, str]] = {}
    for res in root.rglob("values*/strings.xml"):
        locale = res.parent.name
        locale = "default" if locale == "values" else locale.replace("values-", "", 1)
        table = tables.setdefault(locale, {})
        for name, value in STRING_ENTRY.findall(read(res)):
            table[name] = clean_xml_value(value)
    return tables


def scan_colors(root: pathlib.Path) -> list[dict]:
    found: list[dict] = []
    for f in root.rglob("res/values*/colors.xml"):
        for name, value in COLOR_XML.findall(read(f)):
            found.append({"name": name, "value": value.strip(), "from": f.parent.name})
    for f in root.rglob("*.kt"):
        text = read(f)
        if "Color(" not in text:
            continue
        for name, argb in COLOR_KT.findall(text):
            found.append({"name": name, "value": "#" + argb[2:], "from": f.name})
    seen, out = set(), []
    for c in found:
        key = (c["name"], c["value"])
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def scan_fonts(root: pathlib.Path) -> list[str]:
    names: set[str] = set()
    for f in root.rglob("res/font/*"):
        names.add(f.stem)
    for f in root.rglob("*.kt"):
        text = read(f)
        if "FontFamily" in text or "R.font." in text:
            names.update(FONT_KT.findall(text))
    return sorted(n for n in names if n)


def scan_package(root: pathlib.Path) -> str:
    for name in ("build.gradle.kts", "build.gradle"):
        for f in root.rglob(name):
            m = NAMESPACE.search(read(f))
            if m:
                return m.group(1)
    return ""


def rea_commands(serial: str, apk: str, out_dir: str) -> str:
    return f"""# 1. is anything attached?
adb devices -l

# 2. the display's real size + density (this is how you map px -> dp)
#    dp = px * 160 / density
npx -y rea-agents@latest inspect-adb-display {serial} --format json

# 3. one real screen, digested, into the evidence folder
npx -y rea-agents@latest capture-adb-screen {serial} --output-directory {out_dir}

# 4. the APK's own string tables, Arabic and friends (no device needed)
npx -y rea-agents@latest decode-android-resources {apk} --locale ar --format json

# 5. a website viewport, when the product is a web app
#    list-browser-targets first, then:
#    npx -y rea-agents@latest capture-web-screenshot <cdp-endpoint> <targetId>

# 6. what REA thinks of this machine (providers, engines, registrations)
npx -y rea-agents@latest doctor

# Evidence goes to references/corpus/evidence/<slug>/ and is cited by card:
python scripts/corpus.py add --url <url> --title "<film>" --source rea \\
    --direction device --move "..." --why "..."
"""


def capture(serial: str, out_dir: pathlib.Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    shot = out_dir / f"screen-{dt.datetime.now().strftime('%H%M%S')}.png"
    adb = shutil.which("adb")
    if not adb:
        print("adb is not on PATH — install Android platform-tools, or use REA's capture-adb-screen")
        return 1
    devices = subprocess.run([adb, "devices"], capture_output=True, text=True).stdout
    if serial not in devices:
        print(f"device '{serial}' not attached. attached:\n{devices.strip()}")
        return 1
    raw = subprocess.run([adb, "-s", serial, "exec-out", "screencap", "-p"], capture_output=True)
    if raw.returncode != 0 or len(raw.stdout) < 1024:
        print("screencap failed (is the screen unlocked?)")
        return 1
    shot.write_bytes(raw.stdout)
    size = subprocess.run(
        [adb, "-s", serial, "shell", "wm", "size"], capture_output=True, text=True
    ).stdout.strip()
    density = subprocess.run(
        [adb, "-s", serial, "shell", "wm", "density"], capture_output=True, text=True
    ).stdout.strip()
    print(f"wrote {shot.relative_to(ROOT) if shot.is_relative_to(ROOT) else shot}")
    print(f"  {size}")
    print(f"  {density}")
    print("  dp = px * 160 / density — wire that into src/theme.ts PHONE/SCREEN_DP")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="read a real app project into a UI inventory")
    ap.add_argument("--dir", help="app project root (Android/Compose, web, or any repo)")
    ap.add_argument("--out", default=str(OUT_DEFAULT))
    ap.add_argument("--rea", action="store_true", help="print the reverse-engineering commands")
    ap.add_argument("--serial", default="<serial>")
    ap.add_argument("--apk", default="app/build/outputs/apk/release/app-release.apk")
    ap.add_argument("--capture", metavar="SERIAL", help="capture one real device screen")
    ap.add_argument("--evidence", default="references/corpus/evidence")
    args = ap.parse_args()

    if args.rea:
        print(rea_commands(args.serial, args.apk, args.evidence))
        return

    if args.capture:
        sys.exit(capture(args.capture, (ROOT / args.evidence / "capture").resolve()))

    if not args.dir:
        ap.error("--dir is required (or --rea / --capture)")

    root = pathlib.Path(args.dir).resolve()
    if not root.is_dir():
        print(f"not a directory: {root}")
        sys.exit(2)

    kotlin_files = len(list(root.rglob("*.kt")))
    if kotlin_files:
        screens, warnings = scan_screens(root)
        routes = scan_routes(root)
        strings = scan_strings(root)
        colors = scan_colors(root)
        fonts = scan_fonts(root)
        mode = "android"
        counts = {
            "files_kt": kotlin_files,
            "screens": len(screens),
            "routes": len(routes),
            "locales": len(strings),
            "strings": {k: len(v) for k, v in sorted(strings.items())},
            "colors": len(colors),
            "fonts": len(fonts),
        }
        tokens: dict[str, str] = {}
    else:
        web = scan_web(root)
        screens = web["screens"]
        routes = web["routes"]
        strings = web["strings"]
        colors = web["colors"]
        fonts = web["fonts"]
        tokens = web["tokens"]
        mode = "web"
        warnings = []
        if not screens:
            warnings.append("no Svelte/Vue/React components found — is --dir the app root?")
        else:
            warnings.append(
                "web mode: pixels still need a real capture — run the dev server and "
                "screenshot the Mini App at 1:1 (see references/fidelity-pipeline.md)"
            )
        counts = {
            "files_web": web["files_web"],
            "screens": len(screens),
            "routes": len(routes),
            "files_with_copy": len(strings),
            "strings": {"web": sum(len(v) for v in strings.values())},
            "colors": len(colors),
            "tokens": len(tokens),
            "fonts": len(fonts),
        }

    data = {
        "source_dir": str(root),
        "mode": mode,
        "package": scan_package(root),
        "scanned_at": dt.datetime.now().isoformat(timespec="seconds"),
        "counts": counts,
        "screens": screens,
        "routes": routes,
        "strings": strings,
        "colors": colors,
        "tokens": tokens,
        "fonts": fonts,
        "warnings": warnings,
    }

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    c = data["counts"]
    print(f"mode        {data['mode']}")
    print(f"package     {data['package'] or '-'}")
    if data["mode"] == "android":
        print(f"kotlin      {c['files_kt']} files")
    else:
        print(f"web files   {c['files_web']} (components {c['screens']})")
    print(f"screens     {c['screens']}")
    print(f"routes      {c['routes']}")
    print(f"strings     " + ", ".join(f"{k}:{v}" for k, v in c["strings"].items()))
    print(f"colors      {c['colors']}")
    print(f"fonts       {c['fonts']}")
    if data["mode"] == "web":
        print(f"tokens      {c['tokens']} css variables")
        print(f"copy        {c['strings']['web']} Arabic strings in {c['files_with_copy']} files")
    print(f"\nwrote {out}")
    print("\nthe film now has a source of truth for names, copy and tokens.")
    print("ground truth for pixels: python scripts/ui_source.py --rea")
    for w in warnings:
        print(f"warning: {w}")


# --------------------------------------------------------------------------- #
# Web mode: Svelte / Vue / React apps (a Mini App is a web app)
# --------------------------------------------------------------------------- #

WEB_GLOBS = ("*.svelte", "*.vue", "*.tsx", "*.jsx")
ARABIC_RUN = re.compile(
    r"[\u0600-\u06FF][\u0600-\u06FF\s\u060C\u061B\u061F\u0640\u064B-\u0652\u0670"
    r"\u0660-\u0669A-Za-z0-9$%.,:!?()\[\]«»/+\-]*"
)
CSS_VAR = re.compile(r"--([a-z0-9-]+)\s*:\s*([^;]+);")
FONT_FAMILY = re.compile(r"font-family\s*:\s*([^;\n}]+)")
HASH_ROUTE = re.compile(r"['\"`](#/[a-z0-9/_\-]*)['\"`]")
WEB_SKIP = ("node_modules", "dist", "build", ".git", "coverage", ".svelte-kit")


def _web_files(root: pathlib.Path) -> list[pathlib.Path]:
    out: list[pathlib.Path] = []
    for pattern in WEB_GLOBS:
        for path in root.rglob(pattern):
            rel = path.relative_to(root).as_posix()
            if any(part in rel for part in WEB_SKIP):
                continue
            out.append(path)
    return sorted(out)


def scan_web(root: pathlib.Path) -> dict:
    """An inventory of a web UI: screens, Arabic copy, colour tokens, faces, routes."""
    files = _web_files(root)
    screens: list[dict] = []
    strings: dict[str, list[str]] = {}
    colors: set[str] = set()
    tokens: dict[str, str] = {}
    fonts: set[str] = set()
    routes: set[str] = set()
    for path in files:
        rel = path.relative_to(root).as_posix()
        text = read(path)
        seen: list[str] = []
        for match in ARABIC_RUN.finditer(text):
            value = match.group(0).strip()
            if len(value) >= 3 and value not in seen:
                seen.append(value)
        if seen:
            strings[rel] = seen[:400]
        colors.update(value.upper() for value in re.findall(r"#[0-9A-Fa-f]{6}", text))
        for name, value in CSS_VAR.findall(text):
            tokens.setdefault(name, value.strip())
        for family in FONT_FAMILY.findall(text):
            for name in family.split(","):
                name = name.strip().strip("'\"")
                if name and not name.startswith("var(") and name.lower() not in ("inherit", "sans-serif", "serif", "monospace"):
                    fonts.add(name)
        routes.update(HASH_ROUTE.findall(text))
        if path.suffix in (".svelte", ".vue", ".tsx", ".jsx"):
            screens.append(
                {
                    "file": rel,
                    "strings": len(seen),
                    "rtl": "rtl" in text,
                }
            )
    screens.sort(key=lambda s: s["file"])
    return {
        "screens": screens,
        "strings": strings,
        "colors": sorted(colors),
        "tokens": dict(sorted(tokens.items())),
        "fonts": sorted(fonts),
        "routes": sorted(routes),
        "files_web": len(files),
    }

if __name__ == "__main__":
    main()

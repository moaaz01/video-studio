#!/usr/bin/env python3
"""The UI mockup factory: Astryx screens, captured as real 2× stills.

    python scripts/mockups.py list
    python scripts/mockups.py capture                 # build + capture every screen
    python scripts/mockups.py capture --only waha-storefront --no-build
    python scripts/mockups.py verify                  # dimensions, hashes, blank frames
    python scripts/mockups.py doctor                  # node / browser / manifest

The factory is a separate Vite app under `tools/mockups/`; it is not a dependency
of the Remotion bundle. Captures land in `public/mockups/<brand>/` with a
`manifest.json` that a scene can read with `staticFile`.

This wrapper exists so the studio has one entry point on Windows and WSL: WSL
cannot launch Edge, so `capture` hands the job to `cmd.exe` and Windows Node.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import platform
import shutil
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "mockups"
SCREENS = TOOL / "screens.json"
BRANDS = TOOL / "brands.json"
PUBLIC = ROOT / "public"
MANIFEST = PUBLIC / "mockups" / "manifest.json"


def read_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def png_size(path: pathlib.Path) -> tuple[int, int]:
    """Read the IHDR without Pillow, so `verify` works on a bare install."""
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", data[16:24])


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_wsl() -> bool:
    return sys.platform.startswith("linux") and (
        "WSL_DISTRO_NAME" in os.environ or pathlib.Path("/mnt/c/Windows").exists()
    )


def windows_path(path: pathlib.Path) -> str:
    try:
        result = subprocess.run(
            ["wslpath", "-w", str(path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return str(path)


def manifest_screens() -> dict[str, dict]:
    if not MANIFEST.exists():
        return {}
    data = read_json(MANIFEST)
    return {entry["slug"]: entry for entry in data.get("screens", [])}


def cmd_list(args: argparse.Namespace) -> int:
    screens = read_json(SCREENS)
    brands = read_json(BRANDS)
    captured = manifest_screens()
    print(f"\n  {len(screens['screens'])} screen(s) declared in {SCREENS.relative_to(ROOT)}")
    print(f"  {'slug':26s} {'screen':12s} {'brand':8s} {'mode':6s} {'css':10s} {'out':10s} path")
    for screen in screens["screens"]:
        entry = captured.get(screen["slug"])
        state = "captured" if entry else "—"
        size = f"{screen['width']}×{screen['height']}"
        path = entry["path"] if entry else f"mockups/{screen['brand']}/{screen['slug'].removeprefix(screen['brand'] + '-')}.png"
        brand = brands.get(screen["brand"], {}).get("name", screen["brand"])
        print(
            f"  {screen['slug']:26s} {screen['screen']:12s} {brand:8s} {screen['mode']:6s} "
            f"{size:10s} {state:10s} {path}"
        )
    print()
    return 0


def run_capture(args: argparse.Namespace) -> int:
    node = shutil.which("node")
    if not node:
        print("node not found — install Node 20+", file=sys.stderr)
        return 1
    script = TOOL / "scripts" / "capture.mjs"
    if not script.exists():
        print(f"missing {script}", file=sys.stderr)
        return 1

    flags: list[str] = []
    if args.only:
        flags += ["--only", args.only]
    if args.no_build:
        flags.append("--no-build")

    env = os.environ.copy()
    if args.browser:
        env["MOCKUP_BROWSER"] = args.browser

    if is_wsl():
        # Edge lives on Windows. A small .bat avoids cmd.exe's quoting rules
        # (a quoted `cd /d` is misread when invoked from WSL) and handles repo
        # paths with spaces. It lives under out/ and is removed afterwards.
        batch_dir = ROOT / "out"
        batch_dir.mkdir(parents=True, exist_ok=True)
        batch = batch_dir / "mockups-capture.bat"
        lines = [
            "@echo off",
            f'cd /d "{windows_path(TOOL)}"',
            f'node scripts\\capture.mjs {" ".join(flags)}'.strip(),
        ]
        batch.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
        try:
            print(f"$ cmd.exe /c {windows_path(batch)}", flush=True)
            return subprocess.run(["cmd.exe", "/c", windows_path(batch)], cwd=ROOT, env=env).returncode
        finally:
            batch.unlink(missing_ok=True)

    command = [node, str(script), *flags]
    print("$ " + " ".join(command), flush=True)
    return subprocess.run(command, cwd=TOOL, env=env).returncode


def blank_frame(path: pathlib.Path) -> bool:
    """A capture that is one flat colour means the screen failed to paint."""
    try:
        from PIL import Image, ImageStat
    except ImportError:
        return False
    with Image.open(path) as image:
        stat = ImageStat.Stat(image.convert("RGB"))
    return max(stat.stddev) < 1.0


def cmd_verify(args: argparse.Namespace) -> int:
    screens = read_json(SCREENS)
    brands = read_json(BRANDS)
    if not MANIFEST.exists():
        print(f"missing {MANIFEST.relative_to(ROOT)} — run `python scripts/studio.py mockups capture`", file=sys.stderr)
        return 1

    manifest = read_json(MANIFEST)
    if manifest.get("version") != 1:
        print(f"unsupported manifest version {manifest.get('version')}", file=sys.stderr)
        return 1
    entries = {entry["slug"]: entry for entry in manifest.get("screens", [])}
    failures: list[str] = []
    seen_paths: set[str] = set()

    print(f"\n  manifest  {MANIFEST.relative_to(ROOT)}")
    print(f"  generated {manifest.get('generatedAt', '?')}")
    print(f"  {'slug':26s} {'px':12s} {'kb':>7s}  sha256       status")

    for screen in screens["screens"]:
        slug = screen["slug"]
        entry = entries.get(slug)
        if not entry:
            failures.append(f"{slug}: not captured")
            print(f"  {slug:26s} {'—':12s} {'—':>7s}  {'—':12s} MISSING")
            continue

        path = (PUBLIC / entry["path"]).resolve()
        if PUBLIC.resolve() not in path.parents:
            failures.append(f"{slug}: path escapes public/")
            print(f"  {slug:26s} {'—':12s} {'—':>7s}  {'—':12s} BAD PATH")
            continue
        if str(path) in seen_paths:
            failures.append(f"{slug}: duplicate output path")
        seen_paths.add(str(path))

        if not path.exists():
            failures.append(f"{slug}: missing {entry['path']}")
            print(f"  {slug:26s} {'—':12s} {'—':>7s}  {'—':12s} MISSING")
            continue

        data = path.read_bytes()
        try:
            width, height = png_size(path)
        except ValueError as error:
            failures.append(f"{slug}: {error}")
            print(f"  {slug:26s} {'—':12s} {'—':>7s}  {'—':12s} NOT PNG")
            continue

        expected = (screen["width"] * screen["scale"], screen["height"] * screen["scale"])
        digest = hashlib.sha256(data).hexdigest()
        problems: list[str] = []
        if (width, height) != expected:
            problems.append(f"size {width}×{height} != {expected[0]}×{expected[1]}")
        if entry.get("width") != width or entry.get("height") != height:
            problems.append("manifest size disagrees with the PNG")
        if entry.get("sha256") and entry["sha256"] != digest:
            problems.append("sha256 changed")
        if entry.get("bytes") and entry["bytes"] != len(data):
            problems.append("byte count changed")
        if blank_frame(path):
            problems.append("flat frame")
        if screen["brand"] not in brands:
            problems.append("unknown brand")
        if entry.get("screen") != screen["screen"]:
            problems.append("screen kind changed")
        if entry.get("brand") != screen["brand"]:
            problems.append("brand changed")
        if entry.get("mode") != screen["mode"]:
            problems.append("mode changed")

        if problems:
            failures.extend(f"{slug}: {problem}" for problem in problems)
            status = "FAIL — " + "; ".join(problems)
        else:
            status = "ok"
        print(
            f"  {slug:26s} {width}×{height:<7d} {len(data) / 1024:7.0f}  "
            f"{digest[:12]}  {status}"
        )

    extra = set(entries) - {screen["slug"] for screen in screens["screens"]}
    for slug in sorted(extra):
        print(f"  {slug:26s} {'—':12s} {'—':>7s}  {'—':12s} STALE (not in screens.json)")
        if args.strict:
            failures.append(f"{slug}: stale capture (not in screens.json)")

    if failures:
        print(f"\n  {len(failures)} problem(s):")
        for failure in failures:
            print(f"    - {failure}")
        return 1
    print(f"\n  all {len(screens['screens'])} screen(s) verified: dimensions, hashes, no flat frames\n")
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    ok = True
    print("\n  mockup factory doctor\n")
    print(f"  tool          {TOOL.relative_to(ROOT)}")

    node = shutil.which("node")
    version = "MISSING"
    if node:
        result = subprocess.run([node, "--version"], capture_output=True, text=True)
        version = result.stdout.strip() or "present"
    print(f"  node          {version}")
    ok &= bool(node)

    package = TOOL / "node_modules" / "@astryxdesign" / "core" / "package.json"
    if package.exists():
        core = read_json(package)
        print(f"  astryx        {core.get('version', '?')}  (pinned, MIT)")
    else:
        print("  astryx        MISSING — cd tools/mockups && npm install")
        ok = False

    playwright = TOOL / "node_modules" / "playwright-core" / "package.json"
    print(f"  playwright    {'present' if playwright.exists() else 'MISSING — npm install'}")
    ok &= playwright.exists()

    dist = TOOL / "dist" / "index.html"
    print(f"  build         {'present' if dist.exists() else 'missing — npm run build'}")
    print(f"  screens       {len(read_json(SCREENS)['screens'])} declared")

    captured = manifest_screens()
    print(f"  captures      {len(captured)} in {MANIFEST.relative_to(ROOT) if MANIFEST.exists() else '—'}")
    if is_wsl():
        print("  capture host  WSL → cmd.exe (Edge on Windows)")
    elif platform.system() == "Windows":
        print("  capture host  Windows (Edge/Chrome)")
    else:
        print("  capture host  Linux (Chromium/Chrome must be installed)")
    print()
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="UI mockup factory (Astryx → 2× stills)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="list declared screens and capture state")
    p_list.set_defaults(func=cmd_list)

    p_capture = sub.add_parser("capture", help="build the factory and capture 2× PNGs")
    p_capture.add_argument("--only", default=None, help="comma-separated slugs")
    p_capture.add_argument("--no-build", action="store_true", help="reuse dist/")
    p_capture.add_argument("--browser", default=None, help="Playwright channel (msedge, chrome, chromium)")
    p_capture.set_defaults(func=run_capture)

    p_verify = sub.add_parser("verify", help="check dimensions, hashes and blank frames")
    p_verify.add_argument("--strict", action="store_true", help="also fail on stale captures")
    p_verify.set_defaults(func=cmd_verify)

    p_doctor = sub.add_parser("doctor", help="check node, Astryx, Playwright and captures")
    p_doctor.set_defaults(func=cmd_doctor)

    args = parser.parse_args()
    sys.exit(args.func(args) or 0)


if __name__ == "__main__":
    main()

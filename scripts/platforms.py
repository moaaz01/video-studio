#!/usr/bin/env python3
"""One film, every screen: plan and export the platform set.

The studio renders from one timeline, so the 9:16 Reel, the 16:9 YouTube cut, the
4:5 feed and the 1:1 card are the same edit re-composed — not four hand-made
videos. This tool renders the union of the requested platforms, checks each file
and each safe area, and writes a manifest with the measured numbers.

    python scripts/platforms.py plan --film film/film.json --platforms x,instagram
    python scripts/platforms.py export --film film/film.json --targets 9x16,16x9,1x1,4x5
    python scripts/platforms.py export --platforms instagram,tiktok --dry-run

The default target set is all four masters. `--strict` fails on a safe-area WARN
or an audio gate; the manifest is written either way.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from platform_matrix import ALL_ASPECTS, ASPECTS, PLATFORMS, safe_for, targets_for  # noqa: E402
import qa  # noqa: E402
from safe_area import measure as safe_measure  # noqa: E402

PY = sys.executable


def node_bin(name: str) -> str | None:
    exe = f"{name}.cmd" if sys.platform == "win32" else name
    local = ROOT / "node_modules" / ".bin" / exe
    return str(local) if local.exists() else shutil.which(name)


def run(cmd: list[str], timeout: int | None = None) -> int:
    print("$ " + " ".join(cmd))
    return subprocess.run(cmd, cwd=str(ROOT), timeout=timeout).returncode


def load_film(path: str) -> dict:
    p = pathlib.Path(path)
    if not p.is_absolute():
        p = ROOT / p
    return json.loads(p.read_text(encoding="utf-8"))


def plan(args: argparse.Namespace) -> dict:
    film = load_film(args.film)
    slug = args.slug or film.get("slug") or pathlib.Path(args.film).stem
    platforms = [p.strip() for p in (args.platforms or "").split(",") if p.strip()]
    platforms = [p for p in platforms if p in PLATFORMS] or ["x"]
    primary = args.primary or film.get("aspect") or ("9x16" if film.get("format") == "explainer" else "16x9")
    if primary not in ALL_ASPECTS:
        primary = "9x16" if film.get("format") == "explainer" else "16x9"
    if args.targets:
        targets = [t.strip() for t in args.targets.split(",") if t.strip()]
        targets = [t for t in targets if t in ASPECTS]
    else:
        targets = targets_for(platforms, primary)
        for aspect in ALL_ASPECTS:
            if aspect not in targets:
                targets.append(aspect)
    return {
        "slug": slug,
        "film": args.film,
        "format": film.get("format", "launch"),
        "platforms": platforms,
        "platform_targets": {p: PLATFORMS[p]["aspects"] for p in platforms},
        "primary": primary,
        "targets": targets,
        "safe_presets": safe_for(platforms),
        "out_dir": f"out/exports/{slug}",
        "files": [
            {
                "aspect": t,
                "composition": ASPECTS[t]["composition"],
                "width": ASPECTS[t]["width"],
                "height": ASPECTS[t]["height"],
                "file": f"out/exports/{slug}/{slug}-{t}.mp4",
            }
            for t in targets
        ],
    }


def cmd_plan(args: argparse.Namespace) -> int:
    p = plan(args)
    print(json.dumps(p, ensure_ascii=False, indent=2))
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    p = plan(args)
    if args.dry_run:
        print(json.dumps(p, ensure_ascii=False, indent=2))
        return 0

    out_dir = ROOT / p["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    npx = node_bin("npx")
    if not npx:
        print("npx not found — npm install first")
        return 1

    if not args.skip_compile:
        rc = run([PY, str(ROOT / "scripts" / "make_timeline.py"), "--film", args.film])
        if rc:
            return rc

    manifest = {**p, "renders": [], "pass": True, "strict": args.strict}
    for entry in p["files"]:
        target = entry["aspect"]
        dest = ROOT / entry["file"]
        cmd = [
            npx, "remotion", "render", "src/index.ts", entry["composition"], str(dest),
            "--scale=1", "--codec=h264", "--crf", str(args.crf), "--x264-preset=medium",
            "--pixel-format=yuv420p", "--color-space=bt709", "--image-format=jpeg",
            f"--concurrency={args.concurrency}", "--overwrite",
        ]
        if args.manifest_only:
            if not dest.exists():
                manifest["pass"] = False
                manifest["renders"].append({"aspect": target, "file": entry["file"], "error": "missing (manifest-only)"})
                continue
        else:
            rc = run(cmd, timeout=None)
            if rc:
                manifest["pass"] = False
                manifest["renders"].append({"aspect": target, "file": entry["file"], "error": f"render exit {rc}"})
                continue

        probe = qa.probe(dest)
        loud = qa.loudness(dest)
        for stale in (ROOT / "out" / "qa").glob(f"_probe_{dest.stem}.wav"):
            stale.unlink(missing_ok=True)
        safe = None
        if not args.no_safe:
            still = out_dir / f"_safe_{target}.png"
            ff = qa.FFMPEG
            if ff:
                subprocess.run(
                    [ff, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(args.still_second),
                     "-i", str(dest), "-frames:v", "1", str(still)],
                    check=False,
                )
            if still.exists():
                from PIL import Image
                preset = args.safe or {"9x16": "reels", "4x5": "feed", "1x1": "feed", "16x9": "feed"}.get(target, "feed")
                safe = safe_measure(Image.open(still), preset)
                safe["preset"] = preset
                still.unlink(missing_ok=True)

        audio_ok = bool(loud) and loud.get("clipped", 1) == 0 and -24.0 <= loud.get("rms_db", -99) <= -14.0 and loud.get("peak_db", 1) <= -0.8
        safe_ok = safe is None or safe.get("verdict") == "PASS"
        row = {
            "aspect": target,
            "file": entry["file"],
            "probe": probe,
            "audio": loud,
            "safe": safe,
            "audio_ok": audio_ok,
            "safe_ok": safe_ok,
        }
        if args.strict and not (audio_ok and safe_ok):
            manifest["pass"] = False
        manifest["renders"].append(row)
        print(f"  {target}: {probe.get('width')}x{probe.get('height')} {probe.get('duration')}s "
              f"peak {loud.get('peak_db') if loud else '?'} safe {safe.get('verdict') if safe else 'n/a'}")

    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {out_dir / 'manifest.json'}")
    return 0 if manifest["pass"] else 1


def main() -> None:
    p = argparse.ArgumentParser(description="platform plan + multi-aspect export")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--film", default="film/film.json")
        sp.add_argument("--slug", default=None)
        sp.add_argument("--platforms", default="", help="x,instagram,tiktok,youtube,linkedin,snapchat,facebook")
        sp.add_argument("--targets", default="", help="9x16,16x9,4x5,1x1 (default: all four)")
        sp.add_argument("--primary", default=None)

    pl = sub.add_parser("plan", help="print the target/aspect plan")
    common(pl)
    pl.set_defaults(func=cmd_plan)

    ex = sub.add_parser("export", help="render every target and write a manifest")
    common(ex)
    ex.add_argument("--crf", type=int, default=15)
    ex.add_argument("--concurrency", default="8")
    ex.add_argument("--still-second", type=float, default=2.0)
    ex.add_argument("--safe", default=None, help="override the safe-area preset")
    ex.add_argument("--no-safe", action="store_true")
    ex.add_argument("--skip-compile", action="store_true")
    ex.add_argument("--manifest-only", action="store_true", help="probe/check existing files, do not render")
    ex.add_argument("--dry-run", action="store_true")
    ex.add_argument("--strict", action="store_true")
    ex.set_defaults(func=cmd_export)

    args = p.parse_args()
    sys.exit(args.func(args) or 0)


if __name__ == "__main__":
    main()

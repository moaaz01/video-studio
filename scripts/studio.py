#!/usr/bin/env python3
"""The studio orchestrator: one entry point for every phase.

    python scripts/studio.py doctor            # is this machine ready?
    python scripts/studio.py timeline          # film.json -> timeline.json
    python scripts/studio.py voice             # film.json VO lines -> Fish Audio -> vo.json
    python scripts/studio.py score             # original bed + foley, levelled
    python scripts/studio.py still 502         # one frame, 1:1, for eyeballing
    python scripts/studio.py render 16x9 9x16  # masters (both by default)
    python scripts/studio.py qa --stills 8     # gates + contact sheets
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
PY = sys.executable
NPM = "npm.cmd" if sys.platform == "win32" else "npm"


def run(cmd: list[str], cwd: pathlib.Path | None = None) -> int:
    print("$ " + " ".join(cmd))
    return subprocess.run(cmd, cwd=str(cwd or ROOT)).returncode


def node_bin(name: str) -> str | None:
    """Prefer the local node_modules/.bin so no global install is required."""
    exe = f"{name}.cmd" if sys.platform == "win32" else name
    local = ROOT / "node_modules" / ".bin" / exe
    return str(local) if local.exists() else shutil.which(name)


def doctor() -> int:
    ok = True
    print("video-studio doctor\n")

    v = sys.version_info
    print(f"python      {v.major}.{v.minor}.{v.micro}  {'ok' if v >= (3, 10) else 'NEEDS 3.10+'}")
    ok &= v >= (3, 10)

    for mod, hint in (
        ("numpy", "the score engine and every measurement"),
        ("scipy", "make_score.py: the bed's filter design"),
        ("PIL", "qa.py: contact sheets and crops"),
    ):
        try:
            m = __import__(mod)
            print(f"{mod:11s} {getattr(m, '__version__', 'present'):11s} {hint}")
        except ImportError:
            print(f"{mod:11s} MISSING — pip install -r requirements.txt  ({hint})")
            ok = False

    npx = node_bin("npx") or shutil.which("npx")
    print(f"node tool   {'found' if npx else 'MISSING (install Node 18+)'}")
    ok &= bool(npx)

    deps = ROOT / "node_modules" / "remotion"
    print(f"remotion    {'installed' if deps.exists() else 'MISSING — npm install'}")
    ok &= deps.exists()

    fonts = sorted((ROOT / "public" / "fonts").glob("*.ttf"))
    print(f"fonts       {len(fonts)} face(s) in public/fonts")
    ok &= len(fonts) >= 2

    env = ROOT / ".env"
    has_key = False
    if env.exists():
        has_key = any(l.startswith("FISH_API_KEY") and l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines())
    import os
    has_key = has_key or bool(os.environ.get("FISH_API_KEY"))
    print(f"fish key    {'present' if has_key else 'absent — voice phase will fail (add .env)'}")

    tl = ROOT / "src" / "generated" / "timeline.json"
    print(f"timeline    {'compiled' if tl.exists() else 'not compiled — run: studio.py timeline'}")

    ff = list((ROOT / "node_modules" / "@remotion").glob("compositor-*/ffprobe*"))
    print(f"ffmpeg      {'bundled with remotion' if ff else 'system PATH only'}")

    print("\nready" if ok else "\nnot ready — fix the MISSING lines")
    return 0 if ok else 1


def timeline(args: argparse.Namespace) -> int:
    return run([PY, str(ROOT / "scripts" / "make_timeline.py"), "--film", args.film, *(["--strict"] if args.strict else [])])


def voice(args: argparse.Namespace) -> int:
    """Build the Fish spec from the film's own beats, then synthesise + measure."""
    film = json.loads((ROOT / args.film).read_text(encoding="utf-8"))
    lines = []
    for b in film.get("beats", []):
        for i, text in enumerate(b.get("vo") or []):
            lines.append({"id": f"{b['id']}-{i + 1}", "text": text})
    if not lines:
        print("no `vo` lines in the film — nothing to synthesise")
        return 0

    v = film.get("voice", {})
    spec = {
        "voice": {
            "model": v.get("model", "s2.1-pro-free"),
            "reference_id": v.get("reference_id") or "",
            "speed": v.get("speed", 1.0),
        },
        "out_dir": "public/audio/vo",
        "manifest": "src/generated/vo.json",
        "lines": lines,
    }
    spec_path = ROOT / "film" / "vo.json"
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(lines)} lines -> film/vo.json")
    if args.dry_run:
        print("dry run: not calling the API")
        return 0
    rc = run([PY, str(ROOT / "scripts" / "voice.py"), "--script", str(spec_path.relative_to(ROOT))])
    if rc == 0:
        print("\nrecompile the timeline so the beats fit the measured speech:")
        print("  python scripts/studio.py timeline --strict")
    return rc


def score(args: argparse.Namespace) -> int:
    """Compose the bed. The timeline-driven composer is the default: it needs no
    hand-written score map, so a re-cut re-scores itself. A hand-written map is
    still honoured when one exists."""
    map_path = ROOT / args.map
    score_script = ROOT / "scripts" / "make_score.py"
    if map_path.exists() and score_script.exists():
        rc = run([PY, str(score_script), "--map", str(map_path)])
    else:
        rc = run([PY, str(ROOT / "scripts" / "make_bed.py")])
    if rc:
        return rc
    leveler = ROOT / "scripts" / "level_score.py"
    music = ROOT / "public" / "audio" / "score" / "music.wav"
    orig = ROOT / "public" / "audio" / "score" / "music.orig.wav"
    if leveler.exists() and music.exists():
        shutil.copy2(music, orig)  # level_score always levels the *raw* render
        rc = run([PY, str(leveler)])
    return rc


def still(args: argparse.Namespace) -> int:
    outdir = ROOT / "out" / "qa"
    outdir.mkdir(parents=True, exist_ok=True)
    comp = args.composition or ("Studio9x16" if args.vertical else "Studio16x9")
    dest = outdir / f"still_{args.frame}{'_v' if args.vertical else ''}.png"
    npx = node_bin("npx")
    if not npx:
        print("npx not found")
        return 1
    return run([npx, "remotion", "still", "src/index.ts", comp, str(dest), f"--frame={args.frame}"])


RENDERS = {
    "16x9": ("Studio16x9", "film_1080p.mp4", "75%"),
    "9x16": ("Studio9x16", "film_9x16.mp4", "75%"),
    "4x5": ("Portrait4x5", "film_4x5.mp4", "75%"),
    "1x1": ("Square1x1", "film_1x1.mp4", "75%"),
}


def render(args: argparse.Namespace) -> int:
    npx = node_bin("npx")
    if not npx:
        print("npx not found")
        return 1
    (ROOT / "out").mkdir(exist_ok=True)
    rc = 0
    for aspect in args.aspects:
        comp, name, conc = RENDERS[aspect]
        cmd = [
            npx, "remotion", "render", "src/index.ts", comp, str(ROOT / "out" / name),
            "--scale=1", "--codec=h264", "--crf", str(args.crf), "--x264-preset=medium",
            "--pixel-format=yuv420p", "--color-space=bt709", "--image-format=jpeg",
            f"--concurrency={args.concurrency or conc}", "--overwrite",
        ]
        rc = run(cmd) or rc
    return rc


def qa(args: argparse.Namespace) -> int:
    cmd = [PY, str(ROOT / "scripts" / "qa.py")]
    if args.stills:
        cmd += ["--stills", str(args.stills)]
    return run(cmd)


def new(args: argparse.Namespace) -> int:
    """Clone the demo film into a named slug, plus a brief to fill in."""
    src = ROOT / "film" / "film.json"
    dest = ROOT / "film" / f"{args.slug}.json"
    if dest.exists() and not args.force:
        print(f"{dest.relative_to(ROOT)} exists - pass --force to overwrite")
        return 1
    data = json.loads(src.read_text(encoding="utf-8"))
    data["slug"] = args.slug
    dest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bars = int(sum(float(b.get("bars", 0)) for b in data["beats"]))
    fps = data.get("fps", 30)
    seconds = bars * 60 / fps
    brief = ROOT / "film" / "brief.md"
    if not brief.exists():
        template = (ROOT / "film" / "brief.template.md").read_text(encoding="utf-8")
        template = template.replace("# <film title> - brief", f"# {args.slug} - brief")
        template = template.replace("# <film title> \u2014 brief", f"# {args.slug} - brief")
        brief.write_text(
            template
            + f"\n---\n\nThe demo grid this scaffold came from: {bars} bars @ "
            f"{data.get('bpm', 120)} BPM = {seconds:.2f} s at {fps} fps.\n",
            encoding="utf-8",
        )
        print(f"wrote {brief.relative_to(ROOT)}")
    print(f"wrote {dest.relative_to(ROOT)}")
    print("\nnext:")
    print(f"  edit film/{args.slug}.json  (beats, bars, Arabic copy, vo lines)")
    print(f"  python scripts/studio.py timeline --film film/{args.slug}.json")
    print("  python scripts/studio.py voice")
    print("  python scripts/studio.py score")
    print("  python scripts/studio.py render")
    return 0


DELEGATES = {
    "ui": "ui_source.py",
    "refs": "corpus.py",
    "advise": "advise.py",
    "storyboard": "storyboard.py",
    "looks": "looks.py",
    "eval": "../evals/run_evals.py",
    "lut": "lut.py",
    "safe": "safe_area.py",
    "captions": "captions.py",
    "provenance": "provenance.py",
    "bed": "make_bed.py",
    "master": "master_audio.py",
}


def main() -> None:
    argv = sys.argv[1:]
    if argv and argv[0] in DELEGATES:
        sys.exit(run([sys.executable, str(SCRIPTS / DELEGATES[argv[0]]), *argv[1:]]))

    p = argparse.ArgumentParser(description="video-studio orchestrator")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor")

    n = sub.add_parser("new", help="scaffold a named film + brief")
    n.add_argument("slug")
    n.add_argument("--force", action="store_true")

    t = sub.add_parser("timeline")
    t.add_argument("--film", default="film/film.json")
    t.add_argument("--strict", action="store_true")

    v = sub.add_parser("voice")
    v.add_argument("--film", default="film/film.json")
    v.add_argument("--dry-run", action="store_true")

    s = sub.add_parser("score")
    s.add_argument("--map", default="film/score.json")

    st = sub.add_parser("still")
    st.add_argument("frame", type=int)
    st.add_argument("--vertical", action="store_true")
    st.add_argument("--composition", default=None, help="any composition id, e.g. Portrait4x5")

    r = sub.add_parser("render")
    r.add_argument("aspects", nargs="*", default=["16x9", "9x16"])
    r.add_argument("--crf", type=int, default=15)
    r.add_argument("--concurrency", default=None)

    m = sub.add_parser("master", help="one audio gain stage over the masters, video untouched")
    m.add_argument("files", nargs="*", default=[])
    m.add_argument("--target", type=float, default=-1.5)

    q = sub.add_parser("qa")
    q.add_argument("--stills", type=int, default=0)

    args = p.parse_args()
    handlers = {
        "doctor": lambda a: doctor(),
        "new": new,
        "timeline": timeline,
        "voice": voice,
        "score": score,
        "still": still,
        "render": render,
        "qa": qa,
    }
    sys.exit(handlers[args.cmd](args) or 0)


if __name__ == "__main__":
    main()

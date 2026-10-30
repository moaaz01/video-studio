#!/usr/bin/env python3
"""Close a film project: copy every file the film used into its folder, measure the
masters, and write the manifest + checksums that prove what was delivered.

The studio renders from global state (`src/generated`, `public/audio`, `out/`), and a
project has to survive that state being reset for the next film. So the rule is: what
the film used is copied under `projects/<slug>/assets/`, the masters go to
`projects/<slug>/output/`, and `manifest.json` records sizes, hashes and measured
loudness for both.

    python scripts/package_project.py --project projects/studyai-shami
    python scripts/package_project.py --project projects/studyai-shami --stills out/qa/day_210.png
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import qa  # noqa: E402  (probe/loudness are the studio's own measurements)

# Hero masters live in out/masters/ (CRF 10 / png); the legacy studio.py render
# writes out/film_*.mp4, so both locations are accepted.
# A project renders into its own folder; the packager copies + measures from there.
# The legacy studio.py render writes out/masters/, so that is accepted as a fallback.
MASTER_ASPECTS = ("16x9", "9x16", "1x1", "4x5")

# Global state the film consumed, copied into assets/ so the project is self-contained.
ASSETS = {
    "timeline.json": "src/generated/timeline.json",
    "vo.json": "src/generated/vo.json",
    "captions.json": "src/generated/captions.json",
    "style.json": "src/generated/style.json",
    "music.wav": "public/audio/score/music.wav",
    "captions/wide.srt": "out/captions/wide.srt",
    "captions/vertical.srt": "out/captions/vertical.srt",
    "score-report.json": "out/audio/score-report.json",
    "vo-audit.json": "out/qa/vo-asr-check.json",
}


def asr_summary() -> str:
    """Read the measured ASR trail instead of repeating a number from memory."""
    for rel in ("out/qa/vo-asr-check.json", "out/auditions/tg2/audit.json", "out/auditions/tg/audit.json"):
        p = ROOT / rel
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return f"{rel} (unreadable)"
        rows = data if isinstance(data, list) else data.get("final") or data.get("lines") or []
        sims = [
            float(r.get("sim", r.get("similarity", r.get("char_sim", 0))))
            for r in rows
            if isinstance(r, dict)
        ]
        sims = [s for s in sims if s > 0]
        if not sims:
            continue
        ok = sum(1 for s in sims if s >= 0.90)
        return f"{rel} ({ok}/{len(sims)} lines >= 0.90, worst {min(sims):.3f})"
    return "no measured ASR report found"


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def copy(src: pathlib.Path, dest: pathlib.Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return {
        "path": dest.relative_to(ROOT).as_posix(),
        "bytes": dest.stat().st_size,
        "sha256": sha256(dest),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default="projects/studyai-shami")
    ap.add_argument("--stills", nargs="*", default=[], help="QA stills to keep in output/stills")
    args = ap.parse_args()

    proj = (ROOT / args.project).resolve()
    film = json.loads((proj / "film.json").read_text(encoding="utf-8"))
    vo_path = proj / "assets" / "vo.json"
    vo = json.loads((vo_path if vo_path.exists() else ROOT / "src/generated/vo.json").read_text(encoding="utf-8"))
    style = json.loads((ROOT / "src/generated/style.json").read_text(encoding="utf-8"))
    timeline = json.loads((ROOT / "src/generated/timeline.json").read_text(encoding="utf-8"))

    files: list[dict] = []
    # 1. the script itself (already authored in the project)
    for name in ("brief.md", "film.json", "style.json", "vo-script.json", "README.md", "ui-source.json"):
        p = proj / name
        if p.exists():
            files.append({"path": p.relative_to(ROOT).as_posix(), "role": "document",
                          "bytes": p.stat().st_size, "sha256": sha256(p)})

    # 2. VO wavs actually used, then the shared audio/visual state
    for entry in vo:
        name = pathlib.Path(entry["wav"]).name
        own = proj / "assets" / "vo" / name
        src = own if own.exists() else ROOT / "public" / entry["wav"]
        dest = proj / "assets" / "vo" / name
        if src.resolve() == dest.resolve():
            files.append({"role": f"vo:{entry['id']}", "path": dest.relative_to(ROOT).as_posix(),
                          "bytes": dest.stat().st_size, "sha256": sha256(dest)})
        else:
            files.append({"role": f"vo:{entry['id']}", **copy(src, dest)})
    assets = dict(ASSETS)
    if not film.get("captions"):
        for key in ("captions.json", "captions/wide.srt", "captions/vertical.srt"):
            assets.pop(key, None)
    music_rel = (film.get("music") or {}).get("file")
    if music_rel:
        assets["music.wav"] = music_rel if music_rel.startswith("public/") else f"public/{music_rel}"
    for rel, src_rel in assets.items():
        # The project's own copy wins: a project must survive the studio's global
        # state being reset for the next film, and re-packaging must not overwrite
        # the film's own timeline/voice/score with whatever is in `src/generated`.
        dest = proj / "assets" / rel
        src = dest if dest.exists() else ROOT / src_rel
        if not src.exists():
            print(f"  !! missing {src_rel} — skipped")
            continue
        if src.resolve() == dest.resolve():
            files.append({"role": "asset", "path": dest.relative_to(ROOT).as_posix(),
                          "bytes": dest.stat().st_size, "sha256": sha256(dest)})
        else:
            files.append({"role": "asset", **copy(src, dest)})

    # 3. masters, measured, in output/
    slug = film.get("slug", proj.name)
    masters = []
    candidates: list[tuple[str, pathlib.Path, str]] = []
    for aspect in MASTER_ASPECTS:
        own = proj / "output" / "masters" / f"film_{aspect}.mp4"
        legacy = ROOT / "out" / "masters" / f"film_{aspect}.mp4"
        src = own if own.exists() else legacy
        candidates.append((aspect, src, f"{slug}-{aspect}-1080p.mp4"))
    for kind, rel in (("teaser", "output/teasers/film_16x9_crf16.mp4"),):
        own = proj / rel
        legacy = ROOT / "out" / "teasers" / "film_16x9_crf16.mp4"
        src = own if own.exists() else legacy
        candidates.append((kind, src, f"{slug}-16x9-teaser.mp4"))
    for aspect, src, name in candidates:
        if not src.exists():
            print(f"  !! missing {src.relative_to(ROOT).as_posix() if src.is_relative_to(ROOT) else src} — run the render first")
            continue
        dest = proj / "output" / ("teasers" if aspect == "teaser" else "masters") / name
        info = copy(src, dest)
        probe = qa.probe(dest)
        lvl = qa.loudness(dest) or {}
        masters.append({
            "aspect": aspect,
            **info,
            "duration": round(probe["duration"], 3),
            "picture": f"{probe['width']}x{probe['height']}",
            "fps": probe["fps"],
            "vcodec": probe["vcodec"],
            "acodec": probe["acodec"],
            "peak_db": round(lvl.get("peak_db", 0.0), 2),
            "rms_db": round(lvl.get("rms_db", 0.0), 2),
            "clipped": lvl.get("clipped"),
        })

    # 4. QA stills
    stills = []
    for s in args.stills:
        src = (ROOT / s).resolve() if not pathlib.Path(s).is_absolute() else pathlib.Path(s).resolve()
        if not src.exists():
            continue
        dest = (proj / "output" / "stills" / src.name).resolve()
        if src == dest:
            stills.append({"role": "stills", "path": dest.relative_to(ROOT).as_posix(),
                           "bytes": dest.stat().st_size, "sha256": sha256(dest)})
        else:
            stills.append({"role": "stills", **copy(src, dest)})

    manifest = {
        "slug": film.get("slug", proj.name),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "film": {
            "look": (style or {}).get("look") or timeline.get("look") or film.get("look"),
            "style": style,
            "fps": timeline["fps"],
            "frames": timeline["frames"],
            "seconds": round(timeline["frames"] / timeline["fps"], 3),
            "beats": [{"id": b["id"], "kind": b["kind"], "frames": b.get("dur") or b.get("frames"), "screen": b.get("screen")} for b in timeline["beats"]],
        },
        "voice": {
            "engine": "Fish Audio TTS",
            "model": (film.get("voice") or {}).get("model"),
            "reference_id": (film.get("voice") or {}).get("reference_id") or (vo[0].get("voice") if vo else None),
            "label": (film.get("voice") or {}).get("label"),
            "speed": (film.get("voice") or {}).get("speed"),
            "lines": [{"id": e["id"], "seconds": round(e["dur"], 3)} for e in vo],
            "total_seconds": round(sum(e["dur"] for e in vo), 3),
            "asr_report": asr_summary(),
        },
        "disclosure": film.get("disclosure") or {
            "sample_data": "Interface captures use the app's own demo fixture; no real student data is shown.",
            "public_copy": "Every product statement in the cut is limited to behaviour visible on screen.",
            "security": "This cut makes no security claim.",
        },
        "files": files,
        "stills": stills,
        "masters": masters,
    }
    (proj / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 5. checksums for everything in the project (masters included: they exist on disk)
    sums = []
    for p in sorted(proj.rglob("*")):
        if p.is_file() and p.name != "SHA256SUMS":
            sums.append(f"{sha256(p)}  {p.relative_to(proj).as_posix()}")
    (proj / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")

    total = sum(f["bytes"] for f in files)
    print(f"project {manifest['slug']}: {len(files)} asset files ({total / 1e6:.1f} MB), "
          f"{len(masters)} masters, {len(stills)} stills")
    for m in masters:
        print(f"  {m['aspect']:>5s} {m['path'].split('/')[-1]:36s} {m['duration']:6.2f}s {m['picture']:>10s} "
              f"{m['bytes'] / 1e6:6.1f} MB peak {m['peak_db']:6.2f} rms {m['rms_db']:6.2f} clipped {m['clipped']}")
    print(f"manifest -> {args.project}/manifest.json")
    print(f"checksums -> {args.project}/SHA256SUMS")


if __name__ == "__main__":
    main()

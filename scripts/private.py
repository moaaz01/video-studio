#!/usr/bin/env python3
"""Keep client work private: deliverables outside git, private paths never staged.

    python scripts/private.py where                      # the private delivery folder
    python scripts/private.py scan                       # untracked files git could still pick up
    python scripts/private.py add src/scenes/Acme.tsx projects/acme/ public/store/acme/
    python scripts/private.py deliver --name acme-launch [--project projects/acme] [--from out]
    python scripts/private.py guard                      # install the local pre-commit + pre-push guard
    python scripts/private.py check-staged | check-push  # what the hooks run

Nothing here is published:
- the private list lives in `.git/info/exclude` (git's local-only ignore) plus
  `.git/info/private-paths` (what the guard checks), both inside `.git/`;
- the delivery folder is outside the repository: `$STUDIO_PRIVATE_DIR`, else
  `git config studio.privateDir`, else `<repo parent>/video-studio-private/`;
- the hooks live in `.git/hooks/`, shared by every worktree, never pushed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MEDIA = {".mp4", ".mov", ".webm", ".mkv", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".wav", ".mp3", ".m4a", ".srt"}
BLOCKED_BRANCHES = ("backup/", "private/", "client/")
MARK = "# video-studio private paths (local only)"


def git(*args: str) -> str:
    # run in the caller's checkout (a hook runs in the worktree being committed)
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8").stdout.strip()


def toplevel() -> pathlib.Path:
    return pathlib.Path(git("rev-parse", "--show-toplevel") or ROOT)


def common_dir() -> pathlib.Path:
    return pathlib.Path(git("rev-parse", "--path-format=absolute", "--git-common-dir"))


def main_root() -> pathlib.Path:
    return common_dir().parent


def private_root() -> pathlib.Path:
    env = os.environ.get("STUDIO_PRIVATE_DIR")
    cfg = git("config", "--get", "studio.privateDir")
    root = pathlib.Path(env or cfg) if (env or cfg) else main_root().parent / "video-studio-private"
    return root.resolve()


def inside_repo(path: pathlib.Path) -> bool:
    try:
        path.resolve().relative_to(main_root().resolve())
        return True
    except ValueError:
        return False


def private_list() -> list[str]:
    p = common_dir() / "info" / "private-paths"
    return [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")] if p.exists() else []


def private_words() -> list[str]:
    p = common_dir() / "info" / "private-words"
    return [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")] if p.exists() else []


def leaked_words(diff: str) -> list[str]:
    """Client names inside added lines of a public file (e.g. a scene registered in Film.tsx)."""
    words = [w.lower() for w in private_words()]
    hits = []
    for line in diff.splitlines():
        if line.startswith("+") and not line.startswith("+++"):
            low = line.lower()
            hits += [f"{w}: {line[:100]}" for w in words if w in low]
    return hits


def is_private(rel: str, patterns: list[str]) -> bool:
    rel = rel.replace("\\", "/")
    for pat in patterns:
        pat = pat.rstrip("/")
        if rel == pat or rel.startswith(pat + "/") or fnmatch.fnmatch(rel, pat):
            return True
    return False


# ------------------------------------------------------------------ commands

def cmd_where(_: argparse.Namespace) -> int:
    root = private_root()
    print(f"private delivery folder: {root}")
    print("inside the repository: " + ("YES — move it (git config studio.privateDir <path outside>)" if inside_repo(root) else "no (safe)"))
    print(f"private paths listed: {len(private_list())}  ({common_dir() / 'info' / 'private-paths'})")
    hooks = common_dir() / "hooks"
    print("guard installed: " + ("yes" if (hooks / "pre-push").exists() and "private.py" in (hooks / "pre-push").read_text(encoding="utf-8") else "no — run `private guard`"))
    return 1 if inside_repo(root) else 0


def cmd_add(a: argparse.Namespace) -> int:
    info = common_dir() / "info"
    if a.word:
        wf = info / "private-words"
        have_w = set(private_words())
        add_w = [w for w in a.paths if w not in have_w]
        with wf.open("a", encoding="utf-8") as f:
            f.write("".join(w + "\n" for w in add_w))
        print(f"private words: {', '.join(private_words())}")
        return 0
    info.mkdir(parents=True, exist_ok=True)
    exclude, plist = info / "exclude", info / "private-paths"
    ex = exclude.read_text(encoding="utf-8") if exclude.exists() else ""
    have = set(private_list())
    new = [p.replace("\\", "/") for p in a.paths if p.replace("\\", "/") not in have]
    if not new:
        print("already private")
        return 0
    if MARK not in ex:
        ex = ex.rstrip("\n") + f"\n\n{MARK}\n"
    ex = ex.rstrip("\n") + "\n" + "\n".join("/" + p.lstrip("/") for p in new) + "\n"
    exclude.write_text(ex, encoding="utf-8")
    with plist.open("a", encoding="utf-8") as f:
        f.write("\n".join(new) + "\n")
    tracked = [p for p in new if git("ls-files", "--", p)]
    for p in new:
        print(f"  private: {p}")
    if tracked:
        print("already tracked by git (exclude cannot hide these; the guard still blocks committing/pushing changes):")
        for p in tracked:
            print(f"  ! {p}  -> `git rm --cached -r {p}` if it was never published")
    return 0


def cmd_scan(_: argparse.Namespace) -> int:
    """Untracked, not-ignored files: one `git add -A` away from a public commit."""
    out = git("ls-files", "--others", "--exclude-standard")
    files = [l for l in out.splitlines() if l]
    if not files:
        print("nothing untracked: a `git add -A` would publish nothing new")
        return 0
    dirs: dict[str, int] = {}
    for f in files:
        top = "/".join(f.split("/")[:3]) if f.startswith(("public/", "projects/", "src/")) else "/".join(f.split("/")[:2])
        dirs[top] = dirs.get(top, 0) + 1
    print("untracked and NOT ignored (a `git add -A` would stage these):")
    for d, n in sorted(dirs.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {d}")
    print("make them private:  python scripts/studio.py private add <path> ...")
    return 1


def cmd_deliver(a: argparse.Namespace) -> int:
    root = private_root()
    if inside_repo(root):
        print(f"refusing: {root} is inside the repository")
        return 1
    top = toplevel()
    # A film is delivered only if its render passed the craft gate and it carries a review.
    gate = top / a.source / "craft-gate.json"
    if not gate.exists():
        print(f"refusing: no {gate.relative_to(top)} — render with `studio.py render` (it runs the craft gate)")
        return 1
    record = json.loads(gate.read_text(encoding="utf-8"))
    if not record.get("pass"):
        print(f"refusing: the last render failed the craft gate ({len(record.get('p0') or [])} P0) — fix, re-render")
        return 1
    reviews = [p for p in ((top / a.project / "REVIEW.md") if a.project else None, top / "film" / "REVIEW.md") if p and p.exists()]
    if not reviews:
        print("refusing: no REVIEW.md — `studio.py craft check --review film/REVIEW.md`, then fill its creative calls")
        return 1
    stamp = dt.datetime.now().strftime("%Y-%m-%d_%H%M")
    dest = root / a.name / stamp
    sources: list[pathlib.Path] = [gate, reviews[0]]
    out = top / a.source
    for pattern in ("film_*.mp4", "masters/*.mp4", "exports/**/*.mp4", "qa/*.png", "captions/*.srt", "cover*.png"):
        sources += [p for p in out.glob(pattern) if p.is_file()]
    if a.project:
        proj = top / a.project
        sources += [p for p in (proj / "output").rglob("*") if p.is_file()] if (proj / "output").exists() else []
        sources += [p for p in (proj / name for name in ("manifest.json", "SHA256SUMS")) if p.exists()]
    if not sources:
        print(f"nothing to deliver under {out}" + (f" or {a.project}/output" if a.project else ""))
        return 1
    total = 0
    for src in sources:
        rel = src.relative_to(top)
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
        total += src.stat().st_size
    print(f"{len(sources)} files, {total / 1e6:.1f} MB -> {dest}")
    if a.move:
        for src in sources:
            if src.suffix.lower() in MEDIA and not git("ls-files", "--", str(src.relative_to(top))):
                src.unlink()
        print("removed the copied untracked media from the repository folder")
    return 0


def _blocked(paths: list[str]) -> list[str]:
    pats = private_list()
    return [p for p in paths if is_private(p, pats)]


def cmd_check_staged(_: argparse.Namespace) -> int:
    staged = git("diff", "--cached", "--name-only").splitlines()
    bad = _blocked(staged) + leaked_words(git("diff", "--cached", "--unified=0"))
    if bad:
        print("private.py: refusing to commit private paths:\n  " + "\n  ".join(bad))
        print("unstage them: git restore --staged <path>   (list: .git/info/private-paths)")
        return 1
    return 0


def cmd_check_push(_: argparse.Namespace) -> int:
    """stdin: `<local ref> <local sha> <remote ref> <remote sha>` per line (git pre-push)."""
    zero = "0" * 40
    for line in sys.stdin.read().splitlines():
        parts = line.split()
        if len(parts) != 4:
            continue
        local_ref, local_sha, remote_ref, remote_sha = parts
        branch = local_ref.removeprefix("refs/heads/")
        if branch.startswith(BLOCKED_BRANCHES) or remote_ref.removeprefix("refs/heads/").startswith(BLOCKED_BRANCHES):
            print(f"private.py: refusing to push '{branch}' (backup/, private/ and client/ branches stay local)")
            return 1
        if local_sha == zero:
            continue
        rng = local_sha if remote_sha == zero else f"{remote_sha}..{local_sha}"
        base = git("merge-base", local_sha, "origin/main") if remote_sha == zero else ""
        changed = git("diff", "--name-only", f"{base}..{local_sha}" if base else rng).splitlines() if (base or remote_sha != zero) \
            else git("ls-tree", "-r", "--name-only", local_sha).splitlines()
        diff = git("diff", "--unified=0", f"{base}..{local_sha}" if base else rng) if (base or remote_sha != zero) else ""
        bad = _blocked(changed) + leaked_words(diff)
        if bad:
            print(f"private.py: refusing to push '{branch}': it touches private paths or names:\n  " + "\n  ".join(bad[:20]))
            return 1
    return 0


HOOK = """#!/bin/sh
# video-studio private guard (local only; installed by scripts/private.py guard)
script="$(git rev-parse --show-toplevel)/scripts/private.py"
[ -f "$script" ] || script="$(git rev-parse --path-format=absolute --git-common-dir)/../scripts/private.py"
[ -f "$script" ] || script="{installed}"
[ -f "$script" ] || {{ echo "private guard: scripts/private.py not found; skipped" >&2; exit 0; }}
for py in python3 python py; do
  if "$py" -c "" >/dev/null 2>&1; then exec "$py" "$script" {cmd}; fi
done
echo "private guard: no working python; refusing to {verb} unchecked" >&2
exit 1
"""


def cmd_guard(_: argparse.Namespace) -> int:
    hooks = common_dir() / "hooks"
    hooks.mkdir(parents=True, exist_ok=True)
    for name, cmd in (("pre-commit", "check-staged"), ("pre-push", "check-push")):
        h = hooks / name
        if h.exists() and "private.py" not in h.read_text(encoding="utf-8"):
            print(f"  {h} exists and is not ours; left alone — add `scripts/private.py {cmd}` to it yourself")
            continue
        h.write_text(HOOK.format(cmd=cmd, installed=pathlib.Path(__file__).resolve().as_posix(),
                                 verb="commit" if cmd == "check-staged" else "push"),
                     encoding="utf-8", newline="\n")
        h.chmod(0o755)
        print(f"  installed {h}")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="keep client work out of the public repository")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("where")
    sub.add_parser("scan")
    ad = sub.add_parser("add")
    ad.add_argument("paths", nargs="+")
    ad.add_argument("--word", action="store_true", help="the values are client names to block inside public files")
    d = sub.add_parser("deliver")
    d.add_argument("--name", required=True, help="client or film name for the folder")
    d.add_argument("--project", default="", help="also copy projects/<slug>/output + manifest")
    d.add_argument("--source", default="out", help="render folder to collect from")
    d.add_argument("--move", action="store_true", help="delete the untracked media copies from the repo after delivery")
    sub.add_parser("guard")
    sub.add_parser("check-staged")
    sub.add_parser("check-push")
    a = ap.parse_args()
    handlers = {"where": cmd_where, "scan": cmd_scan, "add": cmd_add, "deliver": cmd_deliver, "guard": cmd_guard,
                "check-staged": cmd_check_staged, "check-push": cmd_check_push}
    sys.exit(handlers[a.cmd](a))


if __name__ == "__main__":
    main()

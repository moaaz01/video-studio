#!/usr/bin/env python3
"""Verify that this skill is installed, linked and readable for every agent.

The repo is the skill. Installing means pointing each agent's discovery path at
this folder with a junction/symlink, so an edit here is visible everywhere at
once. That only helps if the links actually resolve, so this script proves it
instead of trusting the installer's own output.

    python scripts/install_check.py           # table + exit code
    python scripts/install_check.py --json    # machine-readable

Exit code 0 only when every discovery path resolves to this repo and the files
an agent needs are readable *through* the link.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Every path an Agent-Skills loader looks at, plus the tool that reads it.
TARGETS = [
    ("DeepSeek Harness", ".dsh/skills/video-studio"),
    ("Claude Code", ".claude/skills/video-studio"),
    ("opencode", ".config/opencode/skills/video-studio"),
    ("OpenClaw / Agent Skills", ".agents/skills/video-studio"),
    ("Hermes Agent", ".hermes/skills/video-studio"),
]

# Read *through* the link, so a stale copy or a broken junction cannot pass.
REQUIRED = [
    "SKILL.md",
    "AGENTS.md",
    "requirements.txt",
    "film/brief.template.md",
    "references/fidelity-pipeline.md",
    "references/prompt-anatomy.md",
    "references/corpus/index.json",
    "scripts/corpus.py",
    "scripts/ui_source.py",
    "scripts/studio.py",
]

FRONTMATTER_KEYS = ("name", "description")


def is_link(path: pathlib.Path) -> bool:
    if os.path.islink(path):
        return True
    isjunction = getattr(os.path, "isjunction", None)
    if isjunction is not None:
        try:
            return bool(isjunction(path))
        except OSError:
            return False
    return False


def frontmatter(skill_md: pathlib.Path) -> dict[str, str]:
    """Minimal YAML frontmatter reader: key: value lines between --- markers."""
    try:
        text = skill_md.read_text(encoding="utf-8-sig")
    except OSError:
        return {}
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    out: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" in line and not line.startswith((" ", "\t")):
            key, _, value = line.partition(":")
            out[key.strip()] = value.strip().strip("\"'")
    return out


def tool_present(agent: str) -> bool:
    """Is the agent itself installed? Only informational - links can precede it."""
    # The harness ships inside its app; managed DSH_* env vars are the signal
    # that it is running here even though `dsh` is not on PATH.
    if agent == "DeepSeek Harness" and any(k.startswith("DSH_") for k in os.environ):
        return True
    bins = {
        "DeepSeek Harness": ["dsh"],
        "Claude Code": ["claude"],
        "opencode": ["opencode"],
        "OpenClaw / Agent Skills": ["openclaw"],
        "Hermes Agent": ["hermes"],
    }[agent]
    return any(shutil_which(b) for b in bins)


def shutil_which(name: str) -> str | None:
    exts = [".exe", ".cmd", ".bat", ""] if os.name == "nt" else [""]
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        for ext in exts:
            candidate = pathlib.Path(directory) / (name + ext)
            if candidate.is_file():
                return str(candidate)
    return None


def check(root: pathlib.Path) -> tuple[bool, list[dict[str, object]]]:
    home = pathlib.Path.home()
    rows: list[dict[str, object]] = []
    for agent, rel in TARGETS:
        path = home / rel
        row: dict[str, object] = {
            "agent": agent,
            "path": str(path),
            "tool": bool(tool_present(agent)),
        }
        if not path.exists():
            row.update(state="missing", detail="not installed")
            rows.append(row)
            continue
        row["link"] = is_link(path)
        try:
            resolved = path.resolve()
        except OSError as exc:
            row.update(state="broken", detail=str(exc))
            rows.append(row)
            continue
        same = resolved == root
        row["resolves_to"] = str(resolved)
        missing = [f for f in REQUIRED if not (path / f).is_file()]
        name = path / "SKILL.md"
        fm = frontmatter(name) if name.is_file() else {}
        ok_fm = all(fm.get(k) for k in FRONTMATTER_KEYS)
        if not row["link"]:
            row.update(state="copied", detail="directory is a real folder, not a link")
        elif not same:
            row.update(state="wrong-target", detail=f"resolves to {resolved}")
        elif not ok_fm:
            row.update(state="bad-skill", detail="SKILL.md frontmatter incomplete")
        elif missing:
            row.update(state="incomplete", detail="missing: " + ", ".join(missing))
        else:
            row.update(state="ok", detail=f"{fm['name']}, {len(REQUIRED)} files visible")
        rows.append(row)
    return all(r["state"] == "ok" for r in rows), rows


def main() -> None:
    ap = argparse.ArgumentParser(description="verify the video-studio install")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    ok, rows = check(ROOT)
    if args.json:
        print(json.dumps({"root": str(ROOT), "ok": ok, "targets": rows}, indent=2))
        sys.exit(0 if ok else 1)

    print(f"video-studio at {ROOT}\n")
    print(f"{'agent':24s} {'link':6s} {'state':13s} detail")
    print("-" * 88)
    for r in rows:
        print(
            f"{r['agent']:24s} {'yes' if r.get('link') else 'no':6s} "
            f"{r['state']:13s} {r['detail']}"
        )
    print()
    tools = [r["agent"] for r in rows if r.get("tool")]
    absent = [r["agent"] for r in rows if not r.get("tool")]
    if tools:
        print("agent on PATH: " + ", ".join(tools))
    if absent:
        print("link wired, agent not on PATH yet: " + ", ".join(absent))
    print("\n" + ("install verified: every agent reads this repo" if ok else "FAIL: fix the rows above"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

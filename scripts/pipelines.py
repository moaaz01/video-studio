#!/usr/bin/env python3
"""Pipelines: a film is a sequence of stages, and a stage is done when its gates pass.

The agent is the orchestrator; this script is its memory and its referee. It keeps
`film/state.json` (which pipeline, which stage, what the user approved, verbatim),
checks gates instead of trusting "I did it", and refuses to skip a stage. A new
session runs `status` and knows exactly where the film stands.

    python scripts/pipelines.py list
    python scripts/pipelines.py start tutorial --film film/howto.json
    python scripts/pipelines.py status
    python scripts/pipelines.py check                   # run the current stage's gates
    python scripts/pipelines.py approve script --quote "تمام، اعتمد النص"
    python scripts/pipelines.py advance                 # check, then move on if green
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFS = ROOT / "references" / "pipelines.json"
STATE = ROOT / "film" / "state.json"
DECISIONS = ROOT / "film" / "decisions.jsonl"


def now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def load_defs(path: pathlib.Path = DEFS) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_state(path: pathlib.Path = STATE) -> dict | None:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def save_state(state: dict, path: pathlib.Path = STATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def expand(value: str, state: dict) -> str:
    return value.replace("{film}", state.get("film", "film/film.json"))


def check_gate(gate: dict, state: dict, root: pathlib.Path = ROOT, run_cmds: bool = True) -> tuple[bool, str]:
    if "file" in gate:
        rel = expand(gate["file"], state)
        return (root / rel).exists(), f"file {rel}"
    if "approval" in gate:
        key = gate["approval"]
        quote = state.get("approvals", {}).get(key, {}).get("quote")
        return bool(quote), f"approval {key}" + (f" «{quote}»" if quote else " (ask the user)")
    if "cmd" in gate:
        args = [expand(v, state) for v in gate["cmd"]]
        label = "studio.py " + " ".join(args)
        if not run_cmds:
            return False, label + " (not run)"
        proc = subprocess.run([sys.executable, str(root / "scripts" / "studio.py"), *args],
                              cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return proc.returncode == 0, label
    return False, f"unknown gate {gate}"


def stage_report(defs: dict, state: dict, stage: str, run_cmds: bool = True) -> tuple[bool, list[str]]:
    spec = defs["stages"][stage]
    lines, ok_all = [], True
    for gate in spec["gates"]:
        ok, label = check_gate(gate, state, run_cmds=run_cmds)
        ok_all &= ok
        lines.append(f"    {'✓' if ok else '✗'} {label}")
    return ok_all, lines


def cmd_list(_a: argparse.Namespace, defs: dict) -> int:
    for name, p in defs["pipelines"].items():
        print(f"  {name:16s} form {p['form']:16s} {' → '.join(p['stages'])}")
    return 0


def cmd_start(a: argparse.Namespace, defs: dict) -> int:
    if a.pipeline not in defs["pipelines"]:
        print(f"unknown pipeline {a.pipeline!r}; see `pipelines list`")
        return 1
    if load_state() and not a.force:
        print("film/state.json exists: finish it, or pass --force to start over")
        return 1
    p = defs["pipelines"][a.pipeline]
    state = {"pipeline": a.pipeline, "form": p["form"], "film": a.film, "stage": p["stages"][0],
             "done": [], "approvals": {}, "started": now()}
    save_state(state)
    print(f"started {a.pipeline} at stage {state['stage']} ({defs['stages'][state['stage']]['skill']})")
    return 0


def require_state() -> dict:
    state = load_state()
    if not state:
        raise SystemExit("no pipeline: `pipelines start <name>` first")
    return state


def cmd_status(_a: argparse.Namespace, defs: dict) -> int:
    state = require_state()
    stages = defs["pipelines"][state["pipeline"]]["stages"]
    print(f"{state['pipeline']} · film {state['film']}")
    for s in stages:
        mark = "✓" if s in state["done"] else ("▶" if s == state["stage"] else " ")
        print(f"  {mark} {s:11s} {defs['stages'][s]['skill']}")
    return 0


def cmd_check(_a: argparse.Namespace, defs: dict) -> int:
    state = require_state()
    if state["stage"] == "complete":
        print("pipeline complete")
        return 0
    ok, lines = stage_report(defs, state, state["stage"])
    print(f"stage {state['stage']}: {'PASS' if ok else 'BLOCKED'}")
    print("\n".join(lines))
    return 0 if ok else 1


def cmd_approve(a: argparse.Namespace, _defs: dict) -> int:
    state = require_state()
    if not a.quote.strip():
        print("an approval needs the user's words: --quote \"...\"")
        return 1
    state.setdefault("approvals", {})[a.key] = {"quote": a.quote.strip(), "at": now()}
    save_state(state)
    with DECISIONS.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"at": now(), "kind": "approval", "key": a.key, "quote": a.quote.strip()},
                           ensure_ascii=False) + "\n")
    print(f"approved {a.key}")
    return 0


def cmd_advance(_a: argparse.Namespace, defs: dict) -> int:
    state = require_state()
    if state["stage"] == "complete":
        print("pipeline complete")
        return 0
    ok, lines = stage_report(defs, state, state["stage"])
    if not ok:
        print(f"stage {state['stage']} is BLOCKED:")
        print("\n".join(lines))
        return 1
    stages = defs["pipelines"][state["pipeline"]]["stages"]
    state["done"].append(state["stage"])
    idx = stages.index(state["stage"])
    state["stage"] = stages[idx + 1] if idx + 1 < len(stages) else "complete"
    save_state(state)
    nxt = state["stage"]
    print(f"→ {nxt}" + (f" ({defs['stages'][nxt]['skill']})" if nxt in defs["stages"] else ""))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="pipeline stages with gates and approvals")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    st = sub.add_parser("start")
    st.add_argument("pipeline")
    st.add_argument("--film", default="film/film.json")
    st.add_argument("--force", action="store_true")
    sub.add_parser("status")
    sub.add_parser("check")
    ap_ = sub.add_parser("approve")
    ap_.add_argument("key")
    ap_.add_argument("--quote", required=True, help="the user's own words, verbatim")
    sub.add_parser("advance")
    a = ap.parse_args(argv)
    handlers = {"list": cmd_list, "start": cmd_start, "status": cmd_status, "check": cmd_check,
                "approve": cmd_approve, "advance": cmd_advance}
    return handlers[a.cmd](a, load_defs())


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Providers: pick the tool for a job by score, spend inside a budget, log why.

The catalogue lives in `references/providers.json`. Every provider is scored on
seven axes (quality, cost, speed, arabic, control, licence, availability) under
a weight profile; the winner, the runner-up and the reason go to
`film/decisions.jsonl`, so a reviewer can see why a voice or a clip came from
where it did. Money goes through one ledger with three modes:

    observe  record spend, never block
    warn     record spend, print a warning past the cap
    cap      refuse any action that would pass the cap

and one rule in every mode: a single action above `approve_over_usd` needs
`--approved` (the user said yes in chat), never the agent's own judgement.

    python scripts/providers.py list [--capability tts]
    python scripts/providers.py pick tts [--profile hero] [--need arabic,offline]
    python scripts/providers.py budget [--mode cap --cap 10 --approve-over 0.5]
    python scripts/providers.py spend kling --units 8 --what "b03 b-roll" [--approved]
    python scripts/providers.py ledger
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import math
import os
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "references" / "providers.json"
BUDGET = ROOT / "film" / "budget.json"
LEDGER = ROOT / "film" / "ledger.jsonl"
DECISIONS = ROOT / "film" / "decisions.jsonl"
AXES = ("quality", "cost", "speed", "arabic", "control", "license", "availability")
BUDGET_DEFAULTS = {"mode": "warn", "cap_usd": 10.0, "approve_over_usd": 0.5}
MODES = ("observe", "warn", "cap")


def load_catalog(path: pathlib.Path = CATALOG) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def env_keys() -> set[str]:
    """Keys from the process plus `.env` (names only; values are never read out)."""
    keys = {k for k, v in os.environ.items() if v}
    dotenv = ROOT / ".env"
    if dotenv.is_file():
        for line in dotenv.read_text(encoding="utf-8", errors="replace").splitlines():
            name, sep, value = line.partition("=")
            if sep and value.strip() and not name.strip().startswith("#"):
                keys.add(name.strip())
    return keys


def is_available(p: dict, keys: set[str]) -> bool:
    if p.get("env"):
        return p["env"] in keys
    probe = p.get("probe")
    if not probe:
        return True
    return importlib.util.find_spec(probe) is not None or shutil.which(probe) is not None


def cost_scores(providers: list[dict]) -> dict[str, float]:
    """Cheapest in the capability = 5, dearest = 1, on a log scale; free is always 5."""
    paid = [p["cost_usd"] for p in providers if p.get("cost_usd", 0) > 0]
    if not paid:
        return {p["id"]: 5.0 for p in providers}
    lo, hi = math.log10(min(paid)), math.log10(max(paid))
    out = {}
    for p in providers:
        c = p.get("cost_usd", 0)
        if c <= 0:
            out[p["id"]] = 5.0
        elif hi == lo:
            out[p["id"]] = 4.0
        else:
            out[p["id"]] = 4.0 - 3.0 * (math.log10(c) - lo) / (hi - lo)
    return out


def rank(catalog: dict, capability: str, profile: str = "default", need: set[str] | None = None,
         keys: set[str] | None = None) -> list[dict]:
    """Score every provider of `capability`; hard needs filter before the score."""
    need = need or set()
    keys = env_keys() if keys is None else keys
    weights = catalog["profiles"].get(profile)
    if weights is None:
        raise SystemExit(f"unknown profile {profile!r}; have {sorted(k for k in catalog['profiles'] if not k.startswith('_'))}")
    pool = [p for p in catalog["providers"] if p["capability"] == capability]
    costs = cost_scores(pool)
    rows = []
    for p in pool:
        avail = is_available(p, keys)
        if "offline" in need and not p.get("local"):
            continue
        if "free" in need and p.get("cost_usd", 0) > 0:
            continue
        if "arabic" in need and p.get("arabic", 0) < 4:
            continue
        axes = {
            "quality": p.get("quality", 3), "cost": costs[p["id"]], "speed": p.get("speed", 3),
            "arabic": p.get("arabic", 3), "control": p.get("control", 3), "license": p.get("license", 3),
            "availability": 5.0 if avail else 0.0,
        }
        total = sum(weights.get(a, 0) * axes[a] for a in AXES) / max(1, sum(weights.get(a, 0) for a in AXES))
        rows.append({"id": p["id"], "score": round(total, 2), "available": avail, "axes": axes,
                     "cost_usd": p.get("cost_usd", 0), "unit": p.get("unit"), "env": p.get("env"),
                     "note": p.get("note", "")})
    return sorted(rows, key=lambda r: (r["available"], r["score"]), reverse=True)


def log_decision(entry: dict, path: pathlib.Path = DECISIONS) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    stamped = {"at": dt.datetime.now().isoformat(timespec="seconds"), **entry}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(stamped, ensure_ascii=False) + "\n")


def load_budget(path: pathlib.Path = BUDGET) -> dict:
    if path.is_file():
        return {**BUDGET_DEFAULTS, **json.loads(path.read_text(encoding="utf-8"))}
    return dict(BUDGET_DEFAULTS)


def spent(path: pathlib.Path = LEDGER) -> float:
    if not path.is_file():
        return 0.0
    total = 0.0
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            total += float(json.loads(line).get("usd", 0))
    return round(total, 4)


def check_spend(usd: float, budget: dict, so_far: float, approved: bool) -> tuple[bool, str]:
    """(allowed, message). Pure, so the gate is testable without a ledger."""
    if usd > budget["approve_over_usd"] and not approved:
        return False, (f"${usd:.2f} is over the ${budget['approve_over_usd']:.2f} single-action line: "
                       "ask the user, then re-run with --approved")
    after = so_far + usd
    if after > budget["cap_usd"]:
        msg = f"${after:.2f} would pass the ${budget['cap_usd']:.2f} cap (spent ${so_far:.2f})"
        if budget["mode"] == "cap":
            return False, msg
        if budget["mode"] == "warn":
            return True, "WARN " + msg
    return True, f"ok: ${usd:.2f} (total ${after:.2f} of ${budget['cap_usd']:.2f})"


def cmd_list(a: argparse.Namespace, catalog: dict) -> int:
    keys = env_keys()
    caps = [a.capability] if a.capability else sorted(k for k in catalog["capabilities"])
    for cap in caps:
        print(f"\n{cap} — {catalog['capabilities'].get(cap, '')}")
        for p in [p for p in catalog["providers"] if p["capability"] == cap]:
            mark = "✓" if is_available(p, keys) else "·"
            how = p.get("env") or ("local" if p.get("local") else "built-in")
            print(f"  {mark} {p['id']:18s} ${p.get('cost_usd', 0):<6} / {p.get('unit', ''):9s} {how}")
    return 0


def cmd_pick(a: argparse.Namespace, catalog: dict) -> int:
    need = {n.strip() for n in (a.need or "").split(",") if n.strip()}
    rows = rank(catalog, a.capability, a.profile, need)
    if a.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        print(f"{a.capability} · profile {a.profile}" + (f" · need {','.join(sorted(need))}" if need else ""))
        for r in rows:
            mark = "✓" if r["available"] else "· (no key)"
            print(f"  {r['score']:5.2f}  {r['id']:18s} {mark}  {r['note']}")
    usable = [r for r in rows if r["available"]]
    if not usable:
        print(f"no available {a.capability} provider: add a key from the list above, or relax --need")
        return 1
    win = usable[0]
    if not a.dry_run:
        log_decision({"kind": "provider", "capability": a.capability, "profile": a.profile,
                      "need": sorted(need), "chose": win["id"], "score": win["score"],
                      "runner_up": usable[1]["id"] if len(usable) > 1 else None,
                      "why": a.why or f"highest {a.profile} score among available providers"})
    print(f"\n→ {win['id']}")
    return 0


def cmd_budget(a: argparse.Namespace, _catalog: dict) -> int:
    b = load_budget()
    changed = False
    for field, value in (("mode", a.mode), ("cap_usd", a.cap), ("approve_over_usd", a.approve_over)):
        if value is not None:
            b[field] = value
            changed = True
    if changed:
        BUDGET.parent.mkdir(parents=True, exist_ok=True)
        BUDGET.write_text(json.dumps(b, indent=2) + "\n", encoding="utf-8")
    print(f"mode {b['mode']} · cap ${b['cap_usd']:.2f} · approve over ${b['approve_over_usd']:.2f} · spent ${spent():.2f}")
    return 0


def cmd_spend(a: argparse.Namespace, catalog: dict) -> int:
    p = next((p for p in catalog["providers"] if p["id"] == a.provider), None)
    if p is None:
        print(f"unknown provider {a.provider!r}")
        return 1
    usd = round(float(p.get("cost_usd", 0)) * a.units, 4)
    ok, msg = check_spend(usd, load_budget(), spent(), a.approved)
    print(msg)
    if not ok:
        return 2
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"at": dt.datetime.now().isoformat(timespec="seconds"), "provider": p["id"],
                            "units": a.units, "unit": p.get("unit"), "usd": usd, "what": a.what,
                            "approved": a.approved}, ensure_ascii=False) + "\n")
    return 0


def cmd_ledger(_a: argparse.Namespace, _catalog: dict) -> int:
    if not LEDGER.is_file():
        print("no spend recorded")
        return 0
    for line in LEDGER.read_text(encoding="utf-8").splitlines():
        e = json.loads(line)
        print(f"  {e['at']}  {e['provider']:16s} {e['units']:>6} {e.get('unit') or '':9s} ${e['usd']:<7} {e.get('what') or ''}")
    print(f"total ${spent():.2f}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="scored provider selection + budget ledger")
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--capability")
    pk = sub.add_parser("pick")
    pk.add_argument("capability")
    pk.add_argument("--profile", default="default")
    pk.add_argument("--need", help="comma list: arabic, offline, free")
    pk.add_argument("--why", help="override reason recorded in decisions.jsonl")
    pk.add_argument("--json", action="store_true")
    pk.add_argument("--dry-run", action="store_true", help="rank only; do not log a decision")
    bd = sub.add_parser("budget")
    bd.add_argument("--mode", choices=MODES)
    bd.add_argument("--cap", type=float)
    bd.add_argument("--approve-over", type=float)
    sp = sub.add_parser("spend")
    sp.add_argument("provider")
    sp.add_argument("--units", type=float, required=True)
    sp.add_argument("--what", default="")
    sp.add_argument("--approved", action="store_true", help="the user approved this action in chat")
    sub.add_parser("ledger")
    a = ap.parse_args(argv)
    handlers = {"list": cmd_list, "pick": cmd_pick, "budget": cmd_budget, "spend": cmd_spend, "ledger": cmd_ledger}
    return handlers[a.cmd](a, load_catalog())


if __name__ == "__main__":
    sys.exit(main())

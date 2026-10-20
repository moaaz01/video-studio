#!/usr/bin/env python3
"""
Reference corpus: turn the sources you were given into a working library.

The studio is only as good as what it looks at. Two kinds of looking:

  corpus.py whatships "<query>"   what shipped, from whatships.com's public index
  corpus.py motion <tag>          what prompt-motion.com has in each category
  corpus.py add --url ...         pin one reference as a card (move + why)
  corpus.py check --min 2         the phase-2 gate: enough cards for this film
  corpus.py list                  the cards pinned so far

A card is not a bookmark. It records **the move** you are borrowing and **what it
buys you**, so the film can be audited later: every borrowed idea has a source and
a reason. Cards live in references/corpus/<slug>.md, indexed by index.json.

Stdlib only. No keys, no scraping beyond the two documented public endpoints.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CORPUS = ROOT / "references" / "corpus"
INDEX = CORPUS / "index.json"
CACHE = CORPUS / ".cache"

WHS_INDEX = "https://whatships.com/search-index.json"
WHS_VIDEO = "https://whatships.com{slug}/"

# Verified on https://prompt-motion.com/ (taxonomy + counts shown on the homepage).
# Tag -> (count, directions in references/visual-direction.md it feeds)
MOTION = {
    "product-ui": (102, ["ui-film", "device"]),
    "kinetic-type": (98, ["kinetic"]),
    "music": (51, ["launch", "atmosphere"]),
    "shapes": (44, ["kinetic", "atmosphere"]),
    "particles": (43, ["atmosphere", "launch"]),
    "charts": (33, ["data", "chart"]),
    "diagrams": (31, ["diagram"]),
    "characters": (27, ["character"]),
    "photos": (23, ["photo", "editorial"]),
    "phone": (22, ["device"]),
    "code": (21, ["code"]),
}


def load_index() -> dict:
    if INDEX.exists():
        return json.loads(INDEX.read_text(encoding="utf-8"))
    return {"version": 1, "cards": []}


def save_index(data: dict) -> None:
    CORPUS.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or "card"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "video-studio/1.1 corpus"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def cmd_motion(args: argparse.Namespace) -> int:
    tag = args.tag.lower()
    if tag and tag not in MOTION:
        print(f"unknown tag '{tag}'. one of: {', '.join(MOTION)}")
        return 2
    rows = [(t, MOTION[t]) for t in ([tag] if tag else list(MOTION))]
    rows.sort(key=lambda r: -r[1][0])
    print(f"{'tag':14s} {'#':>4s}  feeds directions")
    for t, (n, dirs) in rows:
        print(f"{t:14s} {n:4d}  {', '.join(dirs)}")
    print("\nopen https://prompt-motion.com/tags/<tag> for the entries;")
    print("each entry carries the prompt that made it — steal the structure, not the frame.")
    if not tag:
        print("\nbiggest pile: product-ui + kinetic-type. That is the same bet this studio makes.")
    return 0


def cmd_whatships(args: argparse.Namespace) -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / "whatships-index.json"
    if cached.exists() and not args.refresh:
        raw = cached.read_bytes()
    else:
        raw = fetch(WHS_INDEX)
        cached.write_bytes(raw)
    try:
        entries = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        print("could not parse whatships search index")
        return 1

    q = args.query.lower()
    hits = [e for e in entries if q in (e.get("searchText") or "").lower()]
    if args.company:
        hits = [e for e in hits if args.company.lower() in (e.get("meta") or "").lower()]
    print(f"{len(entries)} published entries, {len(hits)} match '{args.query}'")
    for e in hits[: args.limit]:
        print(f"\n  {e.get('name')}")
        print(f"  {e.get('meta') or '-'}   https://whatships.com{e.get('href') or ''}")
        if e.get("poster"):
            print(f"  poster https://whatships.com{e['poster']}")
    if len(hits) > args.limit:
        print(f"\n  ... {len(hits) - args.limit} more (raise --limit)")
    if hits:
        print("\nnext: open one entry, watch the film, then pin what you stole:")
        print(f"  python scripts/corpus.py add --url https://whatships.com{hits[0].get('href')} \\")
        print("      --title \"...\" --move \"...\" --why \"...\" --direction launch")
    return 0


def cmd_add(args: argparse.Namespace) -> int:
    data = load_index()
    card = {
        "title": args.title,
        "url": args.url,
        "source": args.source,
        "direction": args.direction,
        "move": args.move,
        "why": args.why,
        "added": dt.date.today().isoformat(),
    }
    slug = slugify(args.title)
    existing = {c["url"] for c in data["cards"]}
    if args.url in existing and not args.force:
        print(f"already pinned: {args.url} (--force to replace)")
        return 0
    data["cards"] = [c for c in data["cards"] if c["url"] != args.url] + [card]
    save_index(data)

    md = CORPUS / f"{slug}.md"
    md.write_text(
        f"# {args.title}\n\n"
        f"- source: {args.source}\n"
        f"- url: {args.url}\n"
        f"- direction: `{args.direction}`\n"
        f"- pinned: {card['added']}\n\n"
        f"## The move\n\n{args.move}\n\n"
        f"## What it buys this film\n\n{args.why}\n\n"
        f"## What I am NOT taking\n\n{args.not_taking or 'the surface style only — composition and timing are ours.'}\n",
        encoding="utf-8",
    )
    print(f"pinned {slug}.md  ({len(data['cards'])} card(s) in the corpus)")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    data = load_index()
    if not data["cards"]:
        print("no cards yet — pin one with: python scripts/corpus.py add --url ... --title ...")
        return 0
    print(f"{len(data['cards'])} card(s)")
    for c in data["cards"]:
        print(f"\n  {c['title']}  [{c['direction']}]  {c['source']}")
        print(f"  {c['url']}")
        print(f"  move: {c['move']}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    data = load_index()
    n = len(data["cards"])
    if args.direction:
        n = len([c for c in data["cards"] if c["direction"] == args.direction])
        scope = f"for direction '{args.direction}'"
    else:
        scope = "total"
    ok = n >= args.min
    print(f"corpus gate: {n} card(s) {scope}, need {args.min} -> {'PASS' if ok else 'FAIL'}")
    if not ok:
        print("pin the references you actually borrowed from before you build:")
        print("  python scripts/corpus.py whatships \"<product>\"      # what shipped")
        print("  python scripts/corpus.py motion product-ui           # what the corpus has")
    return 0 if ok else 1


def main() -> None:
    ap = argparse.ArgumentParser(description="reference corpus for the video studio")
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("motion", help="prompt-motion taxonomy: tag -> count -> direction")
    m.add_argument("tag", nargs="?", default="")
    m.set_defaults(fn=cmd_motion)

    w = sub.add_parser("whatships", help="query whatships.com's public search index")
    w.add_argument("query")
    w.add_argument("--company", default="")
    w.add_argument("--limit", type=int, default=10)
    w.add_argument("--refresh", action="store_true")
    w.set_defaults(fn=cmd_whatships)

    a = sub.add_parser("add", help="pin one reference as a card")
    a.add_argument("--url", required=True)
    a.add_argument("--title", required=True)
    a.add_argument("--move", required=True, help="the one technique you are borrowing")
    a.add_argument("--why", required=True, help="what it buys this specific film")
    a.add_argument("--direction", default="ui-film")
    a.add_argument("--source", default="other")
    a.add_argument("--not-taking", default="")
    a.add_argument("--force", action="store_true")
    a.set_defaults(fn=cmd_add)

    l = sub.add_parser("list", help="the cards pinned so far")
    l.set_defaults(fn=cmd_list)

    c = sub.add_parser("check", help="phase-2 gate: enough cards for this film")
    c.add_argument("--min", type=int, default=2)
    c.add_argument("--direction", default="")
    c.set_defaults(fn=cmd_check)

    args = ap.parse_args()
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()

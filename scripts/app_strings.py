#!/usr/bin/env python3
"""Pull the Arabic strings a film shows straight out of the real app's resources.

A film only earns the right to show an app screen if the strings on it are the
app's own strings, not a designer's paraphrase. This reads the Android locale
tables (`res/values-ar/strings*.xml`), extracts the requested keys with the file
they came from, and writes `src/generated/studyai-ar.json` for the screen to
import. `--check` proves the JSON still matches the app, and that every key the
screen asks for exists in it.

    python scripts/app_strings.py --dir <android/app> --keys home_greeting_morning
    python scripts/app_strings.py --dir <android/app> --keys ... --out src/generated/studyai-ar.json
    python scripts/app_strings.py --check --screen src/components/StudyAIScreen.tsx
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "src" / "generated" / "studyai-ar.json"
DEFAULT_SCREEN = ROOT / "src" / "components" / "StudyAIScreen.tsx"
STRING_RE = re.compile(r'<string\s+name="([^"]+)"[^>]*>(.*?)</string>', re.DOTALL)
CDATA_RE = re.compile(r"^<!\[CDATA\[(.*)\]\]>$", re.DOTALL)


def locale_dir(app: pathlib.Path) -> pathlib.Path:
    candidates = [
        app / "app" / "src" / "main" / "res" / "values-ar",
        app / "src" / "main" / "res" / "values-ar",
    ]
    for c in candidates:
        if c.is_dir():
            return c
    sys.exit(f"no values-ar under {app} (pass the android/ or android/app folder)")


def read_table(res_dir: pathlib.Path) -> dict[str, tuple[str, str]]:
    table: dict[str, tuple[str, str]] = {}
    for path in sorted(res_dir.glob("strings*.xml")):
        text = path.read_text(encoding="utf-8")
        for key, raw in STRING_RE.findall(text):
            value = CDATA_RE.sub(r"\1", raw.strip())
            value = html.unescape(value).replace("\\'", "'")
            table.setdefault(key, (value, path.name))
    return table


def flatten(src: dict[str, tuple[str, str]]) -> dict[str, dict[str, str]]:
    return {k: {"ar": v[0], "file": v[1]} for k, v in sorted(src.items())}


def want(args) -> list[str]:
    keys = [k.strip() for k in (args.keys or "").split(",") if k.strip()]
    if args.keys_file:
        keys += [
            line.strip()
            for line in pathlib.Path(args.keys_file).read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        ]
    return sorted(dict.fromkeys(keys))


def screen_keys(screen: pathlib.Path) -> list[str]:
    text = screen.read_text(encoding="utf-8")
    return sorted(set(re.findall(r"\bt\('([a-z0-9_]+)'\)", text)))


def check(args) -> int:
    out = pathlib.Path(args.out)
    if not out.exists():
        print(f"MISSING {out} - run without --check first")
        return 1
    stored = json.loads(out.read_text(encoding="utf-8"))
    table = read_table(locale_dir(pathlib.Path(args.dir)))
    stored_keys = stored.get("keys", {})
    screen = pathlib.Path(args.screen) if args.screen else None
    needed = screen_keys(screen) if screen and screen.exists() else sorted(stored_keys)
    problems = 0
    for key in needed:
        if key not in table:
            print(f"MISSING IN APP  {key}")
            problems += 1
        elif key not in stored_keys:
            print(f"MISSING IN JSON {key}")
            problems += 1
        elif stored_keys[key]["ar"] != table[key][0]:
            print(f"DRIFT           {key}: app has {table[key][0]!r}, json has {stored_keys[key]['ar']!r}")
            problems += 1
        else:
            print(f"ok  {key:34s} {table[key][1]:22s} {table[key][0][:40]}")
    print(f"\n{len(needed) - problems}/{len(needed)} strings verified against the app")
    return 0 if problems == 0 else 1


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="android/ or android/app (contains app/src/main/res)")
    ap.add_argument("--keys", default="", help="comma separated resource keys to extract")
    ap.add_argument("--keys-file", default="", help="one key per line")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--screen", default=str(DEFAULT_SCREEN))
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    if args.check:
        sys.exit(check(args))

    table = read_table(locale_dir(pathlib.Path(args.dir)))
    wanted = want(args)
    if not wanted:
        sys.exit("no keys requested: pass --keys or --keys-file")
    missing = [k for k in wanted if k not in table]
    doc = {
        "generated_from": str(locale_dir(pathlib.Path(args.dir))),
        "generated_at": dt.datetime.now().replace(microsecond=0).isoformat(),
        "note": "Arabic UI strings copied from the app's own resources; the film shows these verbatim.",
        "keys": {k: {"ar": table[k][0], "file": table[k][1]} for k in wanted if k in table},
        "missing": missing,
    }
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}  ({len(doc['keys'])} keys, {len(missing)} missing)")
    for key, item in doc["keys"].items():
        print(f"  {key:34s} {item['file']:22s} {item['ar']}")
    if missing:
        print("MISSING:", ", ".join(missing))
        sys.exit(1)


if __name__ == "__main__":
    main()

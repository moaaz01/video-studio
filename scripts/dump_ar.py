# -*- coding: utf-8 -*-
"""Dump every Arabic string literal in the video sources, for proofreading."""
import re, pathlib, sys

AR = re.compile(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]')
# string literals: '...' "..." `...` and JSX text between > and <
LIT = re.compile(r"""(['"])((?:\\.|(?!\1).)*?)\1""", re.S)
JSX = re.compile(r">([^<>{}]*[\u0600-\u06FF][^<>{}]*)<")

root = pathlib.Path("src")
seen = set()
for p in sorted(root.rglob("*.tsx")) + sorted(root.rglob("*.ts")):
    if "generated" in p.parts:
        continue
    txt = p.read_text(encoding="utf-8")
    rows = []
    for m in LIT.finditer(txt):
        s = m.group(2)
        if AR.search(s):
            line = txt[:m.start()].count("\n") + 1
            rows.append((line, s.strip()))
    for m in JSX.finditer(txt):
        s = m.group(1).strip()
        if AR.search(s):
            line = txt[:m.start()].count("\n") + 1
            rows.append((line, s))
    if not rows:
        continue
    print(f"\n=== {p.as_posix()} ===")
    for line, s in rows:
        key = (p.as_posix(), s)
        s1 = re.sub(r"\s+", " ", s)
        print(f"{line:>4}  {s1}")

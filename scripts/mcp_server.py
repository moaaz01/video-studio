#!/usr/bin/env python3
"""A dependency-free MCP server: expose this studio to any agent as tools.

The skill teaches an agent *what* the studio does; MCP lets it *call* the studio,
from Claude Code, opencode, Cursor or anything else that speaks MCP. Transport is
stdio with one JSON-RPC 2.0 message per line - no SDK, no version drift.

    claude mcp add video-studio -- python D:/deepseek-workspace/video-studio/scripts/mcp_server.py

Tools: studio_doctor, app_scan, refs_search, film_advise, storyboard, still,
render, qa, captions, safe, shotlist, grade, evals, master, sound.

Resources: the film, the compiled timeline, the generated grade and captions, the
roadmap and the skill itself - so an agent can read the studio's state without a
render and without guessing a path.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PYTHON = sys.executable
PROTOCOL = "2025-06-18"


def sh(args: list[str], timeout: int = 1800) -> str:
    proc = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    if proc.returncode != 0:
        return f"exit {proc.returncode}\n{out}\n{err}".strip()
    return out or "(no output)"


def tool(name: str, description: str, props: dict, required: list[str], run):
    return {
        "definition": {
            "name": name,
            "description": description,
            "inputSchema": {"type": "object", "properties": props, "required": required},
        },
        "run": run,
    }


def captions_tool(a: dict) -> str:
    """Generate then verify: --check reads the files generation writes, so a
    clean checkout must not be asked to check before it has generated."""
    film = a.get("film", "film/film.json")
    generated = sh([PYTHON, "scripts/captions.py", "--film", film])
    checked = sh([PYTHON, "scripts/captions.py", "--film", film, "--check"])
    return f"{generated}" + chr(10) + chr(10) + f"{checked}"


TOOLS = {
    "studio_doctor": tool(
        "studio_doctor",
        "Check this machine: python deps, node, remotion, fonts, fish key, timeline.",
        {},
        [],
        lambda a: sh([PYTHON, "scripts/studio.py", "doctor"]),
    ),
    "app_scan": tool(
        "app_scan",
        "Scan a real app project into film/ui-source.json: screens, routes, strings, colours, fonts.",
        {"path": {"type": "string", "description": "path to the app folder (android/, src/, ...)"}},
        ["path"],
        lambda a: sh([PYTHON, "scripts/ui_source.py", "--dir", a["path"]]),
    ),
    "refs_search": tool(
        "refs_search",
        "Search launch films that already shipped (whatships) or the prompt taxonomy (motion).",
        {
            "query": {"type": "string", "description": "search text, or a taxonomy tag for motion"},
            "source": {"type": "string", "enum": ["whatships", "motion"], "description": "default whatships"},
        },
        ["query"],
        lambda a: sh(
            [PYTHON, "scripts/corpus.py", "motion", a["query"]]
            if a.get("source") == "motion"
            else [PYTHON, "scripts/corpus.py", "whatships", a["query"]]
        ),
    ),
    "film_advise": tool(
        "film_advise",
        "Measured design review of a film: reading time, contrast, rhythm, cta, look, frame math.",
        {"film": {"type": "string", "description": "default film/film.json"}},
        [],
        lambda a: sh([PYTHON, "scripts/advise.py", a.get("film", "film/film.json")]),
    ),
    "storyboard": tool(
        "storyboard",
        "Render a storyboard sheet (out/storyboard/sheet.png) with real Arabic panels.",
        {"panels": {"type": "boolean", "description": "also render one still per beat"}},
        [],
        lambda a: sh([PYTHON, "scripts/storyboard.py"] + (["--panels"] if a.get("panels") else [])),
    ),
    "still": tool(
        "still",
        "Render one frame at 1:1 for eyeballing Arabic and layout.",
        {"frame": {"type": "integer"}, "vertical": {"type": "boolean"}},
        ["frame"],
        lambda a: sh([PYTHON, "scripts/studio.py", "still", str(a["frame"])] + (["--vertical"] if a.get("vertical") else [])),
    ),
    "render": tool(
        "render",
        "Render the masters. Slow (minutes); call it only after advise and stills are clean.",
        {"aspects": {"type": "array", "items": {"type": "string"}, "description": "16x9, 9x16"}},
        [],
        lambda a: sh([PYTHON, "scripts/studio.py", "render", *(a.get("aspects") or ["16x9", "9x16"])]),
    ),
    "captions": tool(
        "captions",
        "Generate burned-caption cues + wide/vertical SRT from the film, then verify them.",
        {"film": {"type": "string", "description": "default film/film.json"}},
        [],
        lambda a: captions_tool(a),
    ),
    "safe": tool(
        "safe",
        "Measure platform safe areas on a rendered still: reels, shorts, story or feed.",
        {
            "still": {"type": "string", "description": "path to a rendered PNG"},
            "preset": {"type": "string", "enum": ["reels", "shorts", "story", "feed"]},
        },
        ["still"],
        lambda a: sh([PYTHON, "scripts/safe_area.py", a["still"], "--preset", a.get("preset", "reels"), "--strict"]),
    ),
    "shotlist": tool(
        "shotlist",
        "Turn a written brief into a shot list and a plan the engine can compile.",
        {"brief": {"type": "string", "description": "path to a markdown/text brief"}},
        ["brief"],
        lambda a: sh([PYTHON, "scripts/shotlist.py", a["brief"], "--json"]),
    ),
    "grade": tool(
        "grade",
        "Regenerate the palette-derived transfer curves and .cube LUTs, then verify them.",
        {},
        [],
        lambda a: sh([PYTHON, "scripts/lut.py", "--json-only"]),
    ),
    "master": tool(
        "master",
        "One measured audio gain stage over the rendered masters (video stream copied).",
        {"files": {"type": "array", "items": {"type": "string"}, "description": "default every out/film_*.mp4"}},
        [],
        lambda a: sh([PYTHON, "scripts/master_audio.py", *(a.get("files") or [])]),
    ),
    "sound": tool(
        "sound",
        "Compose the music bed from the compiled timeline, then report its measured level.",
        {},
        [],
        lambda a: sh([PYTHON, "scripts/make_bed.py", "--json"]),
    ),
    "evals": tool(
        "evals",
        "Score the golden briefs: schema, timeline compile, and the design-review floor.",
        {"min_score": {"type": "integer", "description": "default 90"}},
        [],
        lambda a: sh([PYTHON, "evals/run_evals.py", "--min-score", str(a.get("min_score", 90))]),
    ),
    "qa": tool(
        "qa",
        "Run the delivery gates on the rendered files: probe, black frames, loudness, Arabic scan.",
        {"stills": {"type": "integer"}},
        [],
        lambda a: sh([PYTHON, "scripts/studio.py", "qa", "--stills", str(a.get("stills", 0))]),
    ),
}


RESOURCES = [
    ("studio://film", "film", "The film plan: beats, bars, copy, voice lines", "film/film.json", "application/json"),
    ("studio://timeline", "timeline", "The compiled timeline the compositions read", "src/generated/timeline.json", "application/json"),
    ("studio://grade", "grade", "Palette-derived transfer curves and saturation", "src/generated/grade.json", "application/json"),
    ("studio://captions", "captions", "Frame-timed caption cues for both aspect families", "src/generated/captions.json", "application/json"),
    ("studio://ui-source", "ui-source", "The real app's screens and strings, the fidelity source", "film/ui-source.json", "application/json"),
    ("studio://roadmap", "roadmap", "What this studio admits, plans and refuses", "docs/ROADMAP-v2.md", "text/markdown"),
    ("studio://skill", "skill", "The operating manual: phases, gates, commands", "SKILL.md", "text/markdown"),
]


def reply(msg_id, result=None, error=None) -> None:
    payload = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        payload["error"] = error
    else:
        payload["result"] = result
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(msg: dict) -> None:
    method = msg.get("method")
    msg_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        reply(
            msg_id,
            {
                "protocolVersion": PROTOCOL,
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"listChanged": False, "subscribe": False},
                },
                "serverInfo": {"name": "video-studio", "version": "2.1.0"},
            },
        )
        return
    if method in ("notifications/initialized", "initialized"):
        return
    if method == "ping":
        reply(msg_id, {})
        return
    if method == "resources/list":
        reply(
            msg_id,
            {
                "resources": [
                    {
                        "uri": uri,
                        "name": name,
                        "title": name,
                        "description": description,
                        "mimeType": mime,
                    }
                    for uri, name, description, _path, mime in RESOURCES
                ]
            },
        )
        return
    if method == "resources/read":
        uri = params.get("uri")
        for candidate, _name, _description, path, mime in RESOURCES:
            if candidate == uri:
                target = ROOT / path
                if not target.is_file():
                    reply(msg_id, error={"code": -32602, "message": f"resource has no source file yet: {path}"})
                    return
                reply(msg_id, {"contents": [{"uri": uri, "mimeType": mime, "text": target.read_text(encoding="utf-8")}]})
                return
        reply(msg_id, error={"code": -32602, "message": f"unknown resource: {uri}"})
        return
    if method == "tools/list":
        reply(msg_id, {"tools": [t["definition"] for t in TOOLS.values()]})
        return
    if method == "tools/call":
        name = params.get("name")
        entry = TOOLS.get(name)
        if entry is None:
            reply(msg_id, error={"code": -32602, "message": f"unknown tool: {name}"})
            return
        try:
            text = entry["run"](params.get("arguments") or {})
            reply(msg_id, {"content": [{"type": "text", "text": text}], "isError": False})
        except Exception as exc:  # the agent should see the failure, not a crash
            reply(msg_id, {"content": [{"type": "text", "text": f"{type(exc).__name__}: {exc}"}], "isError": True})
        return
    reply(msg_id, error={"code": -32601, "message": f"method not found: {method}"})


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(msg, list):  # batch
            for m in msg:
                handle(m)
        else:
            handle(msg)


if __name__ == "__main__":
    main()

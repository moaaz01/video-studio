#!/usr/bin/env python3
"""Prove the MCP server works over its actual wire, not by reading the source.

Spawns `scripts/mcp_server.py` on stdio, speaks newline-delimited JSON-RPC 2.0,
and asserts: the protocol version, the server version, the tools and resources it
advertises, and that two of the new tools really answer (captions generate+check,
sound -> measured bed). Prints a table and exits 1 on the first broken contract.

    python scripts/mcp_selftest.py
    python scripts/mcp_selftest.py --json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVER = ROOT / "scripts" / "mcp_server.py"
PROTOCOL = "2025-06-18"
VERSION = "2.1.0"


class Client:
    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            [sys.executable, str(SERVER)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=str(ROOT), text=True, encoding="utf-8",
        )
        self.next_id = 0

    def call(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        payload = {"jsonrpc": "2.0", "id": self.next_id, "method": method}
        if params is not None:
            payload["params"] = params
        self.proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise SystemExit(f"server closed the pipe on {method}")
        return json.loads(line)

    def close(self) -> None:
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:  # noqa: BLE001 - a stuck cleanup must not hide the result
            self.proc.kill()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    checks: list[dict] = []
    client = Client()
    try:
        init = client.call("initialize", {
            "protocolVersion": PROTOCOL,
            "capabilities": {},
            "clientInfo": {"name": "mcp_selftest", "version": "1.0"},
        })
        info = init.get("result", {}).get("serverInfo", {})
        checks.append({"check": "protocol", "value": init.get("result", {}).get("protocolVersion"),
                       "pass": init.get("result", {}).get("protocolVersion") == PROTOCOL})
        checks.append({"check": "server version", "value": info.get("version"),
                       "pass": info.get("version") == VERSION})

        tools = client.call("tools/list", {}).get("result", {}).get("tools", [])
        names = [t["name"] for t in tools]
        checks.append({"check": "tools listed", "value": len(tools), "pass": len(tools) >= 15})
        for required in ("captions", "master", "sound"):
            checks.append({"check": f"tool {required}", "value": required in names,
                           "pass": required in names})

        resources = client.call("resources/list", {}).get("result", {}).get("resources", [])
        checks.append({"check": "resources listed", "value": len(resources), "pass": len(resources) >= 7})
        film = client.call("resources/read", {"uri": "studio://film"})
        text = film.get("result", {}).get("contents", [{}])[0].get("text", "")
        checks.append({"check": "studio://film chars", "value": len(text), "pass": len(text) > 500})
        missing = client.call("resources/read", {"uri": "studio://nope"})
        checks.append({"check": "unknown resource", "value": missing.get("error", {}).get("code"),
                       "pass": missing.get("error", {}).get("code") == -32602})

        captions = client.call("tools/call", {"name": "captions", "arguments": {}})
        caption_text = captions.get("result", {}).get("content", [{}])[0].get("text", "")
        checks.append({"check": "captions call", "value": "OK" in caption_text,
                       "pass": captions.get("result", {}).get("isError") is False and "OK" in caption_text})

        sound = client.call("tools/call", {"name": "sound", "arguments": {}})
        sound_text = sound.get("result", {}).get("content", [{}])[0].get("text", "")
        checks.append({"check": "sound call", "value": 'rms_dbfs' in sound_text,
                       "pass": sound.get("result", {}).get("isError") is False and "rms_dbfs" in sound_text})
    finally:
        client.close()

    ok = all(c["pass"] for c in checks)
    if args.json:
        print(json.dumps({"pass": ok, "checks": checks}, indent=2))
    else:
        print(f"{'check':24s} {'value':22s} result")
        for c in checks:
            print(f"{c['check']:24s} {str(c['value']):22s} {'PASS' if c['pass'] else 'FAIL'}")
        print(f"\n{sum(c['pass'] for c in checks)}/{len(checks)} checks pass"
              f" -> {'PASS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

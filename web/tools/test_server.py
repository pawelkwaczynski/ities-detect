#!/usr/bin/env python3
"""Mini checks for MIME, /api/versions and precompressed .br."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
from app import app  # noqa: E402


def main() -> int:
    c = app.test_client()
    fails = []

    r = c.get("/api/versions")
    if r.status_code != 200:
        fails.append(f"/api/versions status {r.status_code}")
    else:
        data = r.get_json()
        if not isinstance(data, list) or not any(e.get("default") for e in data):
            fails.append("/api/versions missing default version")
        else:
            print("versions default:", next(e["version"] for e in data if e.get("default")))

    wasm = c.get("/pyodide/pyodide.asm.wasm")
    ctype = wasm.headers.get("Content-Type", "")
    if wasm.status_code != 200:
        fails.append(f"wasm status {wasm.status_code}")
    if "application/wasm" not in ctype:
        fails.append(f"wasm MIME {ctype!r}")
    else:
        print("wasm MIME:", ctype)

    br = c.get("/pyodide/pyodide.asm.wasm", headers={"Accept-Encoding": "br"})
    enc = br.headers.get("Content-Encoding", "")
    if enc != "br":
        fails.append(f"expected Content-Encoding br, got {enc!r}")
    else:
        print("wasm br Content-Encoding:", enc)

    hub = c.get("/")
    if hub.status_code != 200 or b"Analizatory CV" not in hub.data:
        fails.append("hub page")
    ities = c.get("/ities/")
    if ities.status_code != 200 or b"ITIES Detect" not in ities.data:
        fails.append("ities page")
    algo = c.get("/algo/ities_algo_v1.1.py")
    if algo.status_code != 200 or algo.headers.get("Cache-Control") != "no-cache":
        fails.append("algo cache")

    if fails:
        print("FAIL")
        for f in fails:
            print(" -", f)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Mini checks for MIME, the version manifests, precompressed .br and both app routes."""
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

    # Since round 3 the Polish strings live in shared/i18n.js, not in the markup, so the
    # hub is checked on its structure and the dictionary is checked on its keys.
    hub = c.get("/")
    if hub.status_code != 200 or b'data-i18n="hub.title"' not in hub.data:
        fails.append(f"hub page status {hub.status_code}")
    i18n = c.get("/shared/i18n.js")
    if i18n.status_code != 200:
        fails.append(f"/shared/i18n.js status {i18n.status_code}")
    else:
        for key in (b'"hub.title"', b'"hub.ities.desc"', b'"hub.peakwise.desc"'):
            if i18n.data.count(key) != 2:
                fails.append(f"i18n key {key.decode()} not present in both languages")
    ities = c.get("/ities/")
    if ities.status_code != 200 or b"ITIES Detect" not in ities.data:
        fails.append("ities page")
    algo = c.get("/algo/ities_algo_v1.1.py")
    if algo.status_code != 200 or algo.headers.get("Cache-Control") != "no-cache":
        fails.append("algo cache")

    peakwise = c.get("/peakwise/")
    if peakwise.status_code != 200 or b"PeakWise" not in peakwise.data:
        fails.append(f"/peakwise/ status {peakwise.status_code}")
    else:
        print("/peakwise/ served, bytes:", len(peakwise.data))

    # The hub tile links /peakwise/, so a trailing-slash redirect would be a broken tile.
    pw_asset = c.get("/peakwise/app.js")
    if pw_asset.status_code != 200 or pw_asset.headers.get("Cache-Control") != "no-cache":
        fails.append(f"/peakwise/app.js status {pw_asset.status_code} cache {pw_asset.headers.get('Cache-Control')!r}")

    pwv = c.get("/algo/peakwise_versions.json")
    if pwv.status_code != 200:
        fails.append(f"/algo/peakwise_versions.json status {pwv.status_code}")
    elif "application/json" not in pwv.headers.get("Content-Type", ""):
        fails.append(f"peakwise manifest MIME {pwv.headers.get('Content-Type')!r}")
    else:
        data = pwv.get_json()
        defaults = [e for e in data if e.get("default")] if isinstance(data, list) else []
        if len(defaults) != 1:
            fails.append("peakwise manifest needs exactly one default entry")
        else:
            entry = defaults[0]
            print("peakwise default:", entry["version"], entry["file"])
            algo_pw = c.get("/algo/" + entry["file"])
            if algo_pw.status_code != 200:
                fails.append(f"/algo/{entry['file']} status {algo_pw.status_code}")

    # The hub tile must point somewhere that answers, and must not say "soon" any more.
    if b'href="/peakwise/"' not in hub.data:
        fails.append("hub tile does not link /peakwise/")
    if b'hub.soon' in hub.data:
        fails.append("hub still shows the 'soon' badge")

    if fails:
        print("FAIL")
        for f in fails:
            print(" -", f)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

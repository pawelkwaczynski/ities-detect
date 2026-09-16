#!/usr/bin/env python3
"""Generate algo/versions.json from the frozen algorithm files in algo/.

The only fields taken from the files themselves are ALGO_VERSION, ALGO_CELL_SHA256
(both from the module header) and the SHA-256 of the file bytes. Dates, changelog
entries and measured numbers are curated below, per version; they come from the
version register and the 16.09.2026 evaluation and must not be invented here.

Usage:
    python tools/make_versions_json.py            # write algo/versions.json
    python tools/make_versions_json.py --check    # exit 1 if the file is stale
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALGO_DIR = ROOT / "algo"
OUT_PATH = ALGO_DIR / "versions.json"

# Curated, per-version metadata. Keys are ALGO_VERSION strings.
# "measured" numbers: evaluation of 16.09.2026 on lab-labelled files
# (../wyniki_analizy/eval_etykiety_20260916_baseline.csv); v1.1 changes
# diagnostics only, so it shares the measurement with v1.0.
MEASURED_20260916 = {
    "positives_detected": "121/293",
    "false_positives_negatives": "0/147",
    "false_positives_neutrals": "0/45",
    "date": "2026-09-16",
}
CURATED = {
    "1.1": {
        "date": "2026-09-16",
        "default": True,
        "changelog": [
            "LOD/LOQ z aktywnej kalibracji + ostrzeżenie below_lod",
            "diagnostyka wyboru pary (n_par_sanity, second_best_error_mV)",
        ],
        "measured": MEASURED_20260916,
    },
    "1.0": {
        "date": "2026-08-20",
        "default": False,
        "changelog": [
            "stan notebooka z 20.08.2026: Ip dwiema procedurami (maksimum nad linią bazową, przecięcie stycznych)",
        ],
        "measured": MEASURED_20260916,
    },
}

HEADER_RE = {
    "version": re.compile(r'^ALGO_VERSION\s*=\s*"([^"]+)"', re.M),
    "cell_sha256": re.compile(r'^ALGO_CELL_SHA256\s*=\s*"([0-9a-f]{64})"', re.M),
}


def version_key(v: str) -> tuple[int, ...]:
    return tuple(int(p) for p in v.split("."))


def scan_algo_files() -> list[dict]:
    entries = []
    for path in sorted(ALGO_DIR.glob("ities_algo_v*.py")):
        raw = path.read_bytes()
        text = raw.decode("utf-8")
        found = {}
        for key, rx in HEADER_RE.items():
            m = rx.search(text)
            if not m:
                raise SystemExit(f"{path.name}: missing {key} in module header")
            found[key] = m.group(1)
        expected_name = f"ities_algo_v{found['version']}.py"
        if path.name != expected_name:
            raise SystemExit(f"{path.name}: ALGO_VERSION {found['version']} does not match file name")
        meta = CURATED.get(found["version"])
        if meta is None:
            print(f"warning: no curated metadata for version {found['version']}, "
                  f"emitting an entry without changelog/measured", file=sys.stderr)
            meta = {"date": None, "default": False, "changelog": [], "measured": None}
        entries.append({
            "version": found["version"],
            "date": meta["date"],
            "file": path.name,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "size_bytes": len(raw),
            "notebook_cell_sha256": found["cell_sha256"],
            "default": bool(meta["default"]),
            "changelog": list(meta["changelog"]),
            "measured": meta["measured"],
        })
    if not entries:
        raise SystemExit("no algo/ities_algo_v*.py files found")
    entries.sort(key=lambda e: version_key(e["version"]), reverse=True)
    defaults = [e["version"] for e in entries if e["default"]]
    if len(defaults) != 1:
        raise SystemExit(f"exactly one default version required, got {defaults}")
    return entries


def render(entries: list[dict]) -> str:
    return json.dumps(entries, ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str]) -> int:
    entries = scan_algo_files()
    text = render(entries)
    if "--check" in argv:
        current = OUT_PATH.read_text(encoding="utf-8") if OUT_PATH.exists() else ""
        if current != text:
            print(f"{OUT_PATH} is stale; run {Path(__file__).name} to regenerate", file=sys.stderr)
            return 1
        print(f"{OUT_PATH} is up to date")
        return 0
    OUT_PATH.write_text(text, encoding="utf-8")
    for e in entries:
        flag = " (default)" if e["default"] else ""
        print(f"{e['version']}{flag}: {e['file']} sha256={e['sha256']}")
    print(f"wrote {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

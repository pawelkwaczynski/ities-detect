#!/usr/bin/env bash
# Populate static/pyodide/ (runtime + numpy/scipy/pandas wheels, no matplotlib)
# and static/vendor/uplot/ from the local npm install, a wheel cache, or jsDelivr.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/tools"
DEST="$ROOT/static/pyodide"
UPLOT_DEST="$ROOT/static/vendor/uplot"
LOCK="$TOOLS/node_modules/pyodide/pyodide-lock.json"
NPM_PY="$TOOLS/node_modules/pyodide"
NPM_UPLOT="$TOOLS/node_modules/uplot/dist"
PYODIDE_VERSION="314.0.7"
NEED_PKGS=(numpy scipy pandas)
CACHE_CANDIDATES=(
  "${PYODIDE_WHEEL_CACHE:-}"
  "$TOOLS/.pkg_cache"
  "/private/tmp/claude-501/-Users-pawelkwaczynski/1ed5a62a-84e1-48bb-9c2a-40da7de36122/scratchpad/pyodide_test/pkg_cache"
)
CDN_BASES=(
  "https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full"
  "https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}"
)

cd "$ROOT"

if [[ ! -f "$TOOLS/package.json" ]]; then
  echo "missing tools/package.json" >&2
  exit 1
fi

if [[ ! -d "$NPM_PY" ]]; then
  echo "npm install in tools/ (pyodide, uplot)"
  (cd "$TOOLS" && npm install)
fi

if [[ ! -f "$LOCK" ]]; then
  echo "pyodide-lock.json missing after npm install" >&2
  exit 1
fi

mkdir -p "$DEST" "$UPLOT_DEST"

echo "copying pyodide runtime"
for f in pyodide.mjs pyodide.mjs.map pyodide.js pyodide.js.map \
         pyodide.asm.mjs pyodide.asm.wasm python_stdlib.zip \
         pyodide-lock.json pyodide.d.ts ffi.d.ts package.json; do
  if [[ -f "$NPM_PY/$f" ]]; then
    cp -f "$NPM_PY/$f" "$DEST/$f"
  fi
done

python3 - "$LOCK" "$DEST" "${NEED_PKGS[@]}" <<'PY'
import hashlib, json, os, sys, urllib.request
from pathlib import Path

lock_path = Path(sys.argv[1])
dest = Path(sys.argv[2])
need = sys.argv[3:]
lock = json.loads(lock_path.read_text())
pkgs = lock["packages"]
seen = set()

def walk(name):
    if name in seen:
        return
    seen.add(name)
    pkg = pkgs.get(name)
    if pkg is None:
        raise SystemExit(f"package {name} missing from lock")
    for dep in pkg.get("depends") or []:
        walk(dep)

for n in need:
    walk(n)

wanted = []
for name in sorted(seen):
    pkg = pkgs[name]
    wanted.append((name, pkg["file_name"], pkg["sha256"]))

out = dest / "_wanted_wheels.json"
out.write_text(json.dumps(wanted, indent=2) + "\n")
print(f"need {len(wanted)} wheels")
for name, fn, sha in wanted:
    print(f"  {name}: {fn}")
PY

WANTED_JSON="$DEST/_wanted_wheels.json"

copy_or_fetch() {
  local fn="$1" sha="$2"
  local destf="$DEST/$fn"
  if [[ -f "$destf" ]]; then
    local got
    got="$(python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$destf")"
    if [[ "$got" == "$sha" ]]; then
      echo "  have $fn"
      return 0
    fi
    echo "  stale $fn, replacing"
    rm -f "$destf"
  fi
  local cache
  for cache in "${CACHE_CANDIDATES[@]}"; do
    [[ -n "$cache" && -f "$cache/$fn" ]] || continue
    local got
    got="$(python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$cache/$fn")"
    if [[ "$got" == "$sha" ]]; then
      echo "  cache $fn"
      cp -f "$cache/$fn" "$destf"
      return 0
    fi
  done
  local base url
  for base in "${CDN_BASES[@]}"; do
    url="$base/$fn"
    echo "  download $url"
    if curl -fL --retry 3 --retry-delay 2 -o "$destf" "$url"; then
      local got
      got="$(python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$destf")"
      if [[ "$got" == "$sha" ]]; then
        return 0
      fi
      echo "  sha mismatch for $fn from $base (got $got)" >&2
      rm -f "$destf"
    fi
  done
  echo "failed to obtain $fn" >&2
  return 1
}

echo "wheels"
python3 - "$WANTED_JSON" <<'PY' | while IFS=$'\t' read -r fn sha; do
import json, sys
from pathlib import Path
for name, fn, sha in json.loads(Path(sys.argv[1]).read_text()):
    print(f"{fn}\t{sha}")
PY
  copy_or_fetch "$fn" "$sha"
done

rm -f "$WANTED_JSON"

shopt -s nullglob
for leftover in "$DEST"/matplotlib* "$DEST"/contourpy* "$DEST"/cycler* \
                "$DEST"/fonttools* "$DEST"/kiwisolver* "$DEST"/pillow-* \
                "$DEST"/pyparsing*; do
  echo "removing matplotlib leftover $(basename "$leftover")"
  rm -rf "$leftover"
done

echo "copying uPlot"
cp -f "$NPM_UPLOT/uPlot.esm.js" "$UPLOT_DEST/uPlot.esm.js"
cp -f "$NPM_UPLOT/uPlot.min.css" "$UPLOT_DEST/uPlot.min.css"
cp -f "$NPM_UPLOT/uPlot.d.ts" "$UPLOT_DEST/uPlot.d.ts" 2>/dev/null || true
if [[ -f "$TOOLS/node_modules/uplot/LICENSE" ]]; then
  cp -f "$TOOLS/node_modules/uplot/LICENSE" "$UPLOT_DEST/LICENSE"
fi

echo "compressing .wasm .whl .js .mjs .zip (brotli + gzip)"
shopt -s nullglob
to_compress=()
for ext in wasm whl js mjs zip css; do
  for f in "$DEST"/*."$ext" "$UPLOT_DEST"/*."$ext"; do
    [[ -f "$f" ]] || continue
    to_compress+=("$f")
  done
done
for f in "${to_compress[@]}"; do
  if [[ ! -f "$f.br" || "$f" -nt "$f.br" ]]; then
    echo "  brotli $(basename "$f")"
    brotli -f -k -q 5 "$f"
  fi
  if [[ ! -f "$f.gz" || "$f" -nt "$f.gz" ]]; then
    echo "  gzip $(basename "$f")"
    gzip -kf -9 "$f"
  fi
done

echo "wrote $DEST and $UPLOT_DEST"
/bin/ls -lh "$DEST"/*.wasm "$DEST"/*.whl "$UPLOT_DEST"/uPlot.esm.js 2>/dev/null || true

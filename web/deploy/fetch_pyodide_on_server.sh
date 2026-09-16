#!/bin/sh
# Runs ON the Frog server. Pulls the Pyodide runtime into static/pyodide/ and makes the
# gzip copies the app serves to browsers. POSIX sh: Alpine has no bash by default.
#
#   cd /home/frog/analizatory && sh deploy/fetch_pyodide_on_server.sh
#
# Safe to re-run: a file whose SHA-256 already matches is left alone, so an interrupted
# download resumes instead of starting over. Brotli is not required; the server ships
# gzip only and app.py falls back to gzip when no .br is present.
set -eu

DEST="${PYODIDE_DEST:-/home/frog/analizatory/static/pyodide}"
mkdir -p "$DEST"

have_sha=0
if command -v sha256sum >/dev/null 2>&1; then have_sha=1; fi

fetch() {
  name="$1"; url="$2"; want="$3"
  target="$DEST/$name"
  if [ -f "$target" ] && [ "$have_sha" = 1 ]; then
    got=$(sha256sum "$target" | cut -d' ' -f1)
    if [ "$got" = "$want" ]; then
      echo "  have $name"
      return 0
    fi
    echo "  stale $name, refetching"
    rm -f "$target" "$target.gz"
  fi
  echo "  get  $name"
  wget -q -O "$target.part" "$url" || { echo "FAILED $url" >&2; rm -f "$target.part"; return 1; }
  if [ "$have_sha" = 1 ]; then
    got=$(sha256sum "$target.part" | cut -d' ' -f1)
    if [ "$got" != "$want" ]; then
      echo "SHA-256 mismatch for $name (got $got, want $want)" >&2
      rm -f "$target.part"
      return 1
    fi
  fi
  mv "$target.part" "$target"
}

# Rebuild the compressed copy next to the file. The Mac build has .br and .gz; here we
# make .gz only, which every browser accepts. fetch() deletes a stale .gz when it
# replaces the source, so an existing .gz here is always current.
compress() {
  name="$1"
  target="$DEST/$name"
  [ -f "$target" ] || return 0
  [ -f "$target.gz" ] && return 0
  if gzip -9 -k -f "$target" 2>/dev/null && [ -f "$target.gz" ]; then
    return 0
  fi
  rm -f "$target.gz"
  gzip -9 -c "$target" > "$target.gz"
}

echo "pyodide -> $DEST"

# --- generated from static/pyodide on the build machine ---
fetch 'ffi.d.ts' 'https://cdn.jsdelivr.net/npm/pyodide@314.0.7/ffi.d.ts' '1f55e2a59cee5306dd19788368823d2863098aa4eb3e6cf8d7f460482d1e266e'
fetch 'numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl' 'a292c1f5d7d8a2208cd5e94fc467604c131cabcd2fc14fed6eefde121e7fabdf'
fetch 'package.json' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/package.json' '40ca48e43ce4ddc68412d5b7a7ca9e2477cd4f0e672277ae468ac2245717079b'
fetch 'pandas-3.0.2-cp314-cp314-pyemscripten_2026_0_wasm32.whl' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pandas-3.0.2-cp314-cp314-pyemscripten_2026_0_wasm32.whl' '45ff57772cc2f366a8582c7d3097cc4e6676342ecd5a3c08184a43462d5a02ae'
fetch 'pyodide-lock.json' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide-lock.json' '5dc2fc119108bc148c7457dc86e7675b5c87e1cafd420b9c34c1eaef7b36c010'
fetch 'pyodide.asm.mjs' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.asm.mjs' 'f7cdc8ece80678ceb712f8e65ebe6d3a83203a180c399865f49612a051693635'
fetch 'pyodide.asm.wasm' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.asm.wasm' 'cc36e3cab04fdfc9a63ff13eb52eae2b911bf46c025cc7b281f394bd3de1d5e6'
fetch 'pyodide.d.ts' 'https://cdn.jsdelivr.net/npm/pyodide@314.0.7/pyodide.d.ts' '7c3ca5a978f3c5dd5229758b91849a62a5866b23869615a95e2e00082d402ff1'
fetch 'pyodide.js' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.js' '3141b814715a72e59b51b1b18b9ceae5bf19f7c852417e431bb0a34feadf825c'
fetch 'pyodide.js.map' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.js.map' '0f7afa220641c481c78c7d32c63d00ba5cd75b1250c410aad275c1e4d17f077f'
fetch 'pyodide.mjs' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs' '6f1d60f7bf529beb300f0f47983c921d3982363640ba20af0e38efdddbc66109'
fetch 'pyodide.mjs.map' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs.map' '0d97147b5f205398c614021ca450d1d95b87cdf8abd1b9ab4fc86c4169f88c36'
fetch 'python_dateutil-2.9.0.post0-py2.py3-none-any.whl' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/python_dateutil-2.9.0.post0-py2.py3-none-any.whl' '9b13365edf9c188f570baf9c540bbb3029ada2a2dacb9694b3659941693ee9e5'
fetch 'python_stdlib.zip' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/python_stdlib.zip' 'fa1957e5777068fc4f7437f96d860ae2fbe9c19732ba06c84e004ec16dd7dd7a'
fetch 'pytz-2026.1.post1-py2.py3-none-any.whl' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pytz-2026.1.post1-py2.py3-none-any.whl' 'b8249d6450146e0b61e6d710dc02ebb35a904796c4c2f97fe87d4ac5872db36a'
fetch 'scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl' '17ee329a957863516d1bb6a6aaa0c60576fac027e9cd3d43de27f58b5b599b50'
fetch 'six-1.17.0-py2.py3-none-any.whl' 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/six-1.17.0-py2.py3-none-any.whl' '228c50f73aa7addf2c2ccf2979c256802a59ab69cad8152b31b9443cc8140f42'

echo "gzip copies"
compress 'numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl'
compress 'pandas-3.0.2-cp314-cp314-pyemscripten_2026_0_wasm32.whl'
compress 'pyodide.asm.mjs'
compress 'pyodide.asm.wasm'
compress 'pyodide.js'
compress 'pyodide.mjs'
compress 'python_dateutil-2.9.0.post0-py2.py3-none-any.whl'
compress 'python_stdlib.zip'
compress 'pytz-2026.1.post1-py2.py3-none-any.whl'
compress 'scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl'
compress 'six-1.17.0-py2.py3-none-any.whl'

echo "done: $(ls -1 "$DEST" | wc -l) files in $DEST"

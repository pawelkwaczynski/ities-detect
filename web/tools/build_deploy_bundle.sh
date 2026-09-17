#!/usr/bin/env bash
# Build the deployment package for the Frog VPS (Alpine 3.23, Python 3.12, user frog).
#
# Produces, in deploy/:
#   analizatory_bundle.tar.gz   server/, algo/, static/ without static/pyodide/, assets/partners/,
#                               README, both RELEASE_CHECK files (ITIES Detect and PeakWise)
#   fetch_pyodide_on_server.sh  runs ON the server: wget Pyodide, then gzip -k the parts that need it
#   start.sh                    gunicorn watchdog with /home/frog/analizatory paths
#   crontab.txt                 @reboot and */5 entries
#
# The Pyodide payload (87 MB) never travels in the bundle. The server pulls it from
# jsDelivr itself, which is why the target only needs wget and tar.
#
# Usage:
#   tools/build_deploy_bundle.sh              build
#   tools/build_deploy_bundle.sh --check-urls build and HEAD every Pyodide URL first
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/deploy"
PYODIDE_DIR="$ROOT/static/pyodide"
PYODIDE_VERSION="314.0.7"
CDN_FULL="https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full"
CDN_NPM="https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}"
REMOTE_ROOT="/home/frog/analizatory"
BUNDLE="$DEPLOY/analizatory_bundle.tar.gz"
CHECK_URLS=0

[[ "${1:-}" == "--check-urls" ]] && CHECK_URLS=1

if [[ ! -d "$PYODIDE_DIR" ]]; then
  echo "missing $PYODIDE_DIR, run tools/fetch_pyodide.sh first" >&2
  exit 1
fi

mkdir -p "$DEPLOY"

# ---------------------------------------------------------------- Pyodide list
# Every runtime file we hold locally, minus the .br/.gz siblings the server rebuilds
# itself. A file is marked "gz" when a .gz or .br sibling exists here, because that is
# what app.py will look for when a browser asks for a compressed response.
# The two .d.ts files are TypeScript typings; jsDelivr serves them from the npm path
# only (the /pyodide/v*/full/ path answers 403), so they carry their own base URL.
MANIFEST="$DEPLOY/.pyodide_manifest"
: > "$MANIFEST"
while IFS= read -r path; do
  name="$(basename "$path")"
  case "$name" in
    *.d.ts) base="$CDN_NPM" ;;
    *)      base="$CDN_FULL" ;;
  esac
  gz="no"
  if [[ -f "$path.gz" || -f "$path.br" ]]; then gz="yes"; fi
  sha="$(shasum -a 256 "$path" | awk '{print $1}')"
  printf '%s\t%s/%s\t%s\t%s\n' "$name" "$base" "$name" "$sha" "$gz" >> "$MANIFEST"
done < <(find "$PYODIDE_DIR" -type f ! -name '*.br' ! -name '*.gz' ! -name '.gitkeep' | sort)

count="$(wc -l < "$MANIFEST" | tr -d ' ')"
echo "pyodide files to fetch on the server: $count"

if [[ "$CHECK_URLS" == "1" ]]; then
  echo
  echo "URL check (HEAD):"
  fail=0
  while IFS=$'\t' read -r name url sha gz; do
    code="$(curl -sI --max-time 30 -o /dev/null -w '%{http_code}' "$url" || echo 000)"
    printf '  %s  %s\n' "$code" "$url"
    [[ "$code" == "200" ]] || fail=$((fail + 1))
  done < "$MANIFEST"
  echo "  non-200: $fail"
  [[ "$fail" == "0" ]] || { echo "refusing to build with unreachable URLs" >&2; exit 1; }
  echo
fi

# ------------------------------------------------- deploy/fetch_pyodide_on_server.sh
{
  cat <<'HEAD'
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
HEAD

  echo
  echo "# --- generated from static/pyodide on the build machine ---"
  while IFS=$'\t' read -r name url sha gz; do
    printf "fetch '%s' '%s' '%s'\n" "$name" "$url" "$sha"
  done < "$MANIFEST"

  echo
  echo 'echo "gzip copies"'
  while IFS=$'\t' read -r name url sha gz; do
    [[ "$gz" == "yes" ]] || continue
    printf "compress '%s'\n" "$name"
  done < "$MANIFEST"

  cat <<'TAIL'

echo "done: $(ls -1 "$DEST" | wc -l) files in $DEST"
TAIL
} > "$DEPLOY/fetch_pyodide_on_server.sh"
chmod +x "$DEPLOY/fetch_pyodide_on_server.sh"

# ------------------------------------------------------------------ deploy/start.sh
cat > "$DEPLOY/start.sh" <<EOF
#!/bin/sh
# gunicorn watchdog for the Frog server. Same job as server/start.sh, fixed paths.
# Called by cron at boot and every 5 minutes; does nothing when the port is already served.
set -eu

ROOT="$REMOTE_ROOT"
LOG="\${ITIES_LOG:-$REMOTE_ROOT/app.log}"
BIND="\${ITIES_BIND:-0.0.0.0:20412}"
VENV="\$ROOT/.venv"
AUTH_FILE="\${ITIES_AUTH_FILE:-$REMOTE_ROOT/server/auth.local.json}"

if [ ! -f "\$AUTH_FILE" ]; then
  echo "missing authentication configuration: \$AUTH_FILE" >&2
  exit 1
fi
export ITIES_AUTH_FILE="\$AUTH_FILE"

if pgrep -f "gunicorn.*20412" >/dev/null 2>&1; then
  exit 0
fi

if [ ! -x "\$VENV/bin/gunicorn" ]; then
  echo "missing \$VENV/bin/gunicorn, create the venv and install server/requirements.txt" >&2
  exit 1
fi

cd "\$ROOT"
"\$VENV/bin/gunicorn" \\
  --chdir "\$ROOT/server" \\
  --workers 1 \\
  --threads 2 \\
  --max-requests 200 \\
  --bind "\$BIND" \\
  wsgi:app \\
  >>"\$LOG" 2>&1 &
echo "started on \$BIND, log \$LOG"
EOF
chmod +x "$DEPLOY/start.sh"

# --------------------------------------------------------------- deploy/crontab.txt
cat > "$DEPLOY/crontab.txt" <<EOF
# ITIES Detect on Frog. Install with: crontab $REMOTE_ROOT/deploy/crontab.txt
# The watchdog exits immediately when gunicorn already holds port 20412.
@reboot /bin/sh $REMOTE_ROOT/deploy/start.sh >>$REMOTE_ROOT/cron.log 2>&1
*/5 * * * * /bin/sh $REMOTE_ROOT/deploy/start.sh >>$REMOTE_ROOT/cron.log 2>&1
EOF

# -------------------------------------------------------------------- the tarball
# Stage a copy and stamp every first-party .js/.css reference with a content hash.
# The public host sits behind Cloudflare, which caches .js/.css at the edge and makes
# browsers keep them for four hours regardless of our Cache-Control, so a plain deploy
# left users running a cached app.js against the new index.html. Sources stay unstamped.
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/analizatory_stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
tar -cf - \
  -C "$ROOT" \
  --exclude='__pycache__' \
  --exclude='.venv' \
  --exclude='.DS_Store' \
  --exclude='static/pyodide' \
  --exclude='server/auth.local.json' \
  --exclude='deploy/.pyodide_manifest' \
  --exclude='deploy/analizatory_bundle.tar.gz' \
  --exclude='deploy/analizatory_bundle*.tar.gz' \
  server algo static assets/partners README.md RELEASE_CHECK.md RELEASE_CHECK_PEAKWISE.md deploy \
  | tar -xf - -C "$STAGE"
python3 "$ROOT/tools/stamp_versions.py" "$STAGE/static"

rm -f "$BUNDLE"
tar -czf "$BUNDLE" -C "$STAGE" server algo static assets README.md RELEASE_CHECK.md RELEASE_CHECK_PEAKWISE.md deploy

if tar -tzf "$BUNDLE" | grep -qx 'server/auth.local.json'; then
  echo "refusing bundle: server/auth.local.json is present" >&2
  exit 1
fi

rm -f "$MANIFEST"

bytes="$(wc -c < "$BUNDLE" | tr -d ' ')"
mib="$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b / 1048576 }')"
echo
echo "bundle: $BUNDLE"
echo "size:   $bytes bytes ($mib MiB)"
awk -v b="$bytes" 'BEGIN { exit (b < 5 * 1048576) ? 0 : 1 }' \
  && echo "target: under 5 MiB, OK" \
  || echo "target: OVER 5 MiB"
echo
echo "contents (top level):"
tar -tzf "$BUNDLE" | awk -F/ '{print $1"/"$2}' | sort -u | head -30
echo
cat <<EOF
Next, on the server:
  cd $REMOTE_ROOT
  tar -xzf analizatory_bundle.tar.gz
  sh deploy/fetch_pyodide_on_server.sh
  sh deploy/start.sh
  crontab deploy/crontab.txt
  wget -qO- http://127.0.0.1:20412/healthz
EOF

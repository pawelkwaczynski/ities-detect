#!/usr/bin/env bash
# Watchdog: start gunicorn on :20412 if it is not already bound there.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${ITIES_LOG:-$HOME/analizatory/app.log}"
BIND="${ITIES_BIND:-0.0.0.0:20412}"
VENV="$ROOT/.venv"
AUTH_FILE="${ITIES_AUTH_FILE:-$ROOT/server/auth.local.json}"

if [[ ! -f "$AUTH_FILE" ]]; then
  echo "missing authentication configuration: $AUTH_FILE" >&2
  exit 1
fi
export ITIES_AUTH_FILE="$AUTH_FILE"

mkdir -p "$(dirname "$LOG")"

if pgrep -f "gunicorn.*20412" >/dev/null 2>&1; then
  echo "already running on $BIND"
  exit 0
fi

if [[ ! -x "$VENV/bin/gunicorn" ]]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -r "$ROOT/server/requirements.txt"
fi

cd "$ROOT"
"$VENV/bin/gunicorn" \
  --chdir "$ROOT/server" \
  --workers 1 \
  --threads 2 \
  --max-requests 200 \
  --bind "$BIND" \
  wsgi:app \
  >>"$LOG" 2>&1 &
echo "http://127.0.0.1:20412"

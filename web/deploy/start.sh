#!/bin/sh
# gunicorn watchdog for the Frog server. Same job as server/start.sh, fixed paths.
# Called by cron at boot and every 5 minutes; does nothing when the port is already served.
set -eu

ROOT="/home/frog/analizatory"
LOG="${ITIES_LOG:-/home/frog/analizatory/app.log}"
BIND="${ITIES_BIND:-0.0.0.0:20412}"
VENV="$ROOT/.venv"
AUTH_FILE="${ITIES_AUTH_FILE:-/home/frog/analizatory/server/auth.local.json}"

if [ ! -f "$AUTH_FILE" ]; then
  echo "missing authentication configuration: $AUTH_FILE" >&2
  exit 1
fi
export ITIES_AUTH_FILE="$AUTH_FILE"

if pgrep -f "gunicorn.*20412" >/dev/null 2>&1; then
  exit 0
fi

if [ ! -x "$VENV/bin/gunicorn" ]; then
  echo "missing $VENV/bin/gunicorn, create the venv and install server/requirements.txt" >&2
  exit 1
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
echo "started on $BIND, log $LOG"

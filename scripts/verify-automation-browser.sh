#!/usr/bin/env bash
set -euo pipefail

REPORTS=${1:-target/debug/rz-reports}
BROWSER=${2:?Usage: scripts/verify-automation-browser.sh [reports-binary] BROWSER_PATH}
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/rustzen-automation.XXXXXX")
LOG="$ROOT/reports.log"
export RUSTZEN_ENV=development
export RUSTZEN_RUNTIME_ROOT="$ROOT"
export RUSTZEN_INTERNAL_HOST=127.0.0.1
export RUSTZEN_REPORTS_PORT=19804
export RUSTZEN_AUTOMATION_FIXTURE_PORT=19805
export RUSTZEN_IPC_TOKEN=automation-browser-verification-token
export RUSTZEN_REPORTS_CREDENTIAL_KEY=automation-browser-credential-key
export RUSTZEN_REPORTS_BROWSER_PATH="$BROWSER"

cleanup() {
  if [[ -n "${PID:-}" ]]; then kill "$PID" 2>/dev/null || true; fi
  rm -rf "$ROOT"
}
trap cleanup EXIT

"$REPORTS" serve >"$LOG" 2>&1 &
PID=$!
for _ in $(seq 1 100); do
  if curl --silent --fail "http://127.0.0.1:$RUSTZEN_REPORTS_PORT/health" >/dev/null; then break; fi
  sleep 0.05
done
curl --silent --fail "http://127.0.0.1:$RUSTZEN_REPORTS_PORT/health" >/dev/null || { cat "$LOG"; exit 1; }
if ! node scripts/verify-automation-browser.mjs; then
  cat "$LOG"
  exit 1
fi

#!/usr/bin/env sh
set -eu

RZ="${1:-target/debug/rz}"
case "$RZ" in
    /*) ;;
    *) RZ="$(pwd)/$RZ" ;;
esac
if [ ! -x "$RZ" ]; then
    echo "Missing executable rz: $RZ" >&2
    exit 1
fi

ROOT="$(mktemp -d "${TMPDIR:-/tmp}/rz-processes.XXXXXX")"
PIDS=""

cleanup() {
    for pid in $PIDS; do
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
    done
    rm -rf "$ROOT"
}
trap cleanup EXIT INT TERM

export RUSTZEN_RUNTIME_ROOT="$ROOT"
export RUSTZEN_SQLITE_PATH=./data/db/admin.db
export RUSTZEN_MONITOR_SQLITE_PATH=./data/db/monitor.db
export RUSTZEN_INSIGHTS_SQLITE_PATH=./data/db/insights.db
export RUSTZEN_REPORTS_SQLITE_PATH=./data/db/reports.db
export RUSTZEN_APP_HOST=127.0.0.1
export RUSTZEN_APP_PORT=19801
export RUSTZEN_WORKER_HOST=127.0.0.1
export RUSTZEN_MONITOR_PORT=19802
export RUSTZEN_INSIGHTS_PORT=19803
export RUSTZEN_REPORTS_PORT=19804
export RUSTZEN_JWT_SECRET=local-process-verification-jwt-secret
export RUSTZEN_IPC_TOKEN=local-process-verification-ipc-secret
export RUST_LOG=warn

start_process() {
    name="$1"
    shift
    "$RZ" "$@" >"$ROOT/$name.log" 2>&1 &
    pid=$!
    PIDS="$PIDS $pid"
    eval "${name}_pid=$pid"
}

wait_for() {
    url="$1"
    count=0
    until curl --fail --silent --show-error "$url" >/dev/null 2>&1; do
        count=$((count + 1))
        if [ "$count" -ge 80 ]; then
            echo "Health gate failed: $url" >&2
            exit 1
        fi
        sleep 0.1
    done
}

assert_alive() {
    kill -0 "$1" 2>/dev/null
}

verify_database_isolation() {
    target_name="$1"
    current_pid="$2"
    database="$3"
    health_url="$4"
    shift 4

    kill "$current_pid"
    wait "$current_pid" 2>/dev/null || true
    cp "$ROOT/data/db/$database.db" "$ROOT/$database.db.backup"
    rm -f "$ROOT/data/db/$database.db-wal" "$ROOT/data/db/$database.db-shm"
    printf 'not-a-sqlite-database' >"$ROOT/data/db/$database.db"
    start_process "${target_name}_corrupt" "$@"
    eval "corrupt_pid=\${${target_name}_corrupt_pid}"
    sleep 0.5
    if kill -0 "$corrupt_pid" 2>/dev/null; then
        echo "$target_name unexpectedly accepted a corrupt database" >&2
        exit 1
    fi
    for url in \
        http://127.0.0.1:19801/api/summary \
        http://127.0.0.1:19802/health \
        http://127.0.0.1:19803/health \
        http://127.0.0.1:19804/health
    do
        if [ "$url" != "$health_url" ]; then
            wait_for "$url"
        fi
    done
    cp "$ROOT/$database.db.backup" "$ROOT/data/db/$database.db"
    start_process "${target_name}_restored" "$@"
    wait_for "$health_url"
}

start_process monitor monitor controller
start_process insights insights worker
start_process reports reports worker
start_process admin admin serve
start_process monitor_agent monitor agent

wait_for http://127.0.0.1:19802/health
wait_for http://127.0.0.1:19803/health
wait_for http://127.0.0.1:19804/health
wait_for http://127.0.0.1:19801/api/summary

for database in admin monitor insights reports; do
    test -f "$ROOT/data/db/$database.db"
done

bun scripts/verify-worker-contracts.mjs
kill "$monitor_agent_pid"
wait "$monitor_agent_pid" 2>/dev/null || true

kill "$insights_pid"
wait "$insights_pid" 2>/dev/null || true
wait_for http://127.0.0.1:19801/api/summary
wait_for http://127.0.0.1:19802/health
wait_for http://127.0.0.1:19804/health
assert_alive "$admin_pid"
assert_alive "$monitor_pid"
assert_alive "$reports_pid"
status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    -H 'content-type: application/json' \
    -H 'x-rustzen-project-key: invalid' \
    -d '{"eventType":"page_view","visitorId":"verify","path":"/verify"}' \
    http://127.0.0.1:19801/api/insights/track)"
test "$status" = "503"

start_process insights_restarted insights worker
wait_for http://127.0.0.1:19803/health

kill "$monitor_pid"
wait "$monitor_pid" 2>/dev/null || true
wait_for http://127.0.0.1:19801/api/summary
wait_for http://127.0.0.1:19803/health
wait_for http://127.0.0.1:19804/health
assert_alive "$admin_pid"
assert_alive "$insights_restarted_pid"
assert_alive "$reports_pid"

kill "$reports_pid"
wait "$reports_pid" 2>/dev/null || true
wait_for http://127.0.0.1:19801/api/summary
wait_for http://127.0.0.1:19803/health
assert_alive "$admin_pid"
assert_alive "$insights_restarted_pid"

start_process monitor_restarted monitor controller
start_process reports_restarted reports worker
wait_for http://127.0.0.1:19802/health
wait_for http://127.0.0.1:19804/health

verify_database_isolation \
    monitor_db "$monitor_restarted_pid" monitor \
    http://127.0.0.1:19802/health monitor controller
verify_database_isolation \
    insights_db "$insights_restarted_pid" insights \
    http://127.0.0.1:19803/health insights worker
verify_database_isolation \
    reports_db "$reports_restarted_pid" reports \
    http://127.0.0.1:19804/health reports worker
verify_database_isolation \
    admin_db "$admin_pid" admin \
    http://127.0.0.1:19801/api/summary admin serve

echo "Local four-process and four-database isolation verified at $ROOT"

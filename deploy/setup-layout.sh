#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -n "${RUSTZEN_ARTIFACT_DIR:-}" ]; then
    ARTIFACT_DIR="$RUSTZEN_ARTIFACT_DIR"
elif [ -f "$SCRIPT_DIR/config/rz.env" ]; then
    ARTIFACT_DIR="$SCRIPT_DIR"
else
    ARTIFACT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../target/rz" && pwd)"
fi
INSTALL_ROOT="${RUSTZEN_INSTALL_ROOT:-/opt/rz}"
UNITS="rz-monitor.service rz-insights.service rz-reports.service rz-admin.service"

if [ ! -f "$ARTIFACT_DIR/config/rz.env" ]; then
    echo "Missing config file: $ARTIFACT_DIR/config/rz.env" >&2
    exit 1
fi

for unit in $UNITS; do
    if [ ! -f "$ARTIFACT_DIR/systemd/$unit" ]; then
        echo "Missing systemd unit: $ARTIFACT_DIR/systemd/$unit" >&2
        exit 1
    fi
done

RELEASE_FILE=""
for file in "$ARTIFACT_DIR"/rz-*-*; do
    if [ -f "$file" ]; then
        RELEASE_FILE="$file"
        break
    fi
done
if [ -z "$RELEASE_FILE" ]; then
    echo "Missing complete rz release in $ARTIFACT_DIR" >&2
    exit 1
fi

RELEASE_NAME="$(basename "$RELEASE_FILE")"
case "$RELEASE_NAME" in
    rz-*-x86_64|rz-*-aarch64) ;;
    *)
        echo "Invalid release name: $RELEASE_NAME" >&2
        exit 1
        ;;
esac

mkdir -p "$INSTALL_ROOT/bin" "$INSTALL_ROOT/config" "$INSTALL_ROOT/data/db" "$INSTALL_ROOT/data/reports" "$INSTALL_ROOT/data/uploads" "$INSTALL_ROOT/data/avatars" "$INSTALL_ROOT/systemd"
install -m 0755 "$RELEASE_FILE" "$INSTALL_ROOT/bin/$RELEASE_NAME"

if [ -e "$INSTALL_ROOT/bin/rz" ] && [ ! -L "$INSTALL_ROOT/bin/rz" ]; then
    echo "Refusing to replace non-symlink: $INSTALL_ROOT/bin/rz" >&2
    exit 1
fi
ln -sfn "$RELEASE_NAME" "$INSTALL_ROOT/bin/rz"

if [ ! -f "$INSTALL_ROOT/config/rz.env" ]; then
    install -m 0600 "$ARTIFACT_DIR/config/rz.env" "$INSTALL_ROOT/config/rz.env"
fi
for unit in $UNITS; do
    install -m 0644 "$ARTIFACT_DIR/systemd/$unit" "$INSTALL_ROOT/systemd/$unit"
done

echo "Prepared one rz artifact, four services, and four database paths at $INSTALL_ROOT"

if command -v systemctl >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    for unit in $UNITS; do
        install -m 0644 "$INSTALL_ROOT/systemd/$unit" "/etc/systemd/system/$unit"
    done
    systemctl daemon-reload
    systemctl enable $UNITS
    echo "Set RUSTZEN_JWT_SECRET and RUSTZEN_IPC_TOKEN in $INSTALL_ROOT/config/rz.env before starting the services."
else
    echo "Install the four files from $INSTALL_ROOT/systemd with administrator privileges when ready."
fi

# @formatter:off
# prettier-ignore
# justfile - Project unified command entry

# development
dev-server:
    cargo watch -x 'run -p server -- admin serve'

dev-monitor:
    cargo run -p server -- monitor controller

dev-insights:
    cargo run -p server -- insights worker

dev-reports:
    cargo run -p server -- reports worker

dev-web:
    cd apps/web && bun run dev

# check
check:
    cargo check --workspace
    cd apps/web && bun run vp lint

verify-processes:
    cargo build -p server
    scripts/verify-four-processes.sh target/debug/rz

# Reset local sqlite database and let migrations re-run on next startup.
reset-db:
    runtime_root="${RUSTZEN_RUNTIME_ROOT:-.rustzen-admin}"; for db in admin monitor insights reports; do rm -f "${runtime_root}/data/db/${db}.db" "${runtime_root}/data/db/${db}.db-shm" "${runtime_root}/data/db/${db}.db-wal"; done

# Build all (production)
build:
    just build-release
    just build-config

# Build x86_64 Linux musl server deployment binary
build-release:
    just _build-binary server x86_64-unknown-linux-musl linux/amd64
    VERSION=$(awk -F '"' '/^version = / { print $2; exit }' apps/server/Cargo.toml) && bun scripts/deploy-sign.mjs sign-release --file target/rz/rz-$VERSION-x86_64 --version $VERSION --arch x86_64

build-native:
    cd apps/web && bun run vp build
    cargo build --release -p server

# Build web production bundle
build-web:
    cd apps/web && bun run vp build

# Build minimal deployment configuration files
build-config:
    mkdir -p target/rz/config target/rz/systemd
    cp .env.example target/rz/config/rz.env
    VERIFY_KEY=$(bun scripts/deploy-sign.mjs public-key) && perl -pi -e "s#^RUSTZEN_DEPLOY_VERIFY_KEY=.*#RUSTZEN_DEPLOY_VERIFY_KEY=$VERIFY_KEY#" target/rz/config/rz.env
    cp deploy/rz-admin.service deploy/rz-monitor.service deploy/rz-insights.service deploy/rz-reports.service target/rz/systemd/
    cp deploy/setup-layout.sh target/rz/setup-layout.sh
    chmod +x target/rz/setup-layout.sh

_build-binary PACKAGE_NAME TARGET_TRIPLE PLATFORM:
    mkdir -p target/rz
    docker buildx build --platform {{PLATFORM}} --build-arg PACKAGE_NAME={{PACKAGE_NAME}} --build-arg TARGET_TRIPLE={{TARGET_TRIPLE}} --target export --output type=local,dest=target/rz .

# Update project version.
bump-version VERSION:
    @perl -pi -e 's/^version = ".*"/version = "{{VERSION}}"/' apps/server/Cargo.toml
    @perl -pi -e 's/^version = ".*"/version = "{{VERSION}}"/' crates/auth/Cargo.toml
    @perl -pi -e 's/^version = ".*"/version = "{{VERSION}}"/' crates/config/Cargo.toml
    @perl -pi -e 's/^version = ".*"/version = "{{VERSION}}"/' crates/runtime/Cargo.toml
    @perl -pi -e 's/^version = ".*"/version = "{{VERSION}}"/' crates/storage/Cargo.toml
    @perl -pi -e 's/"version": ".*"/"version": "{{VERSION}}"/' apps/web/package.json

# Clean build outputs
clean:
    rm -rf target apps/web/dist apps/server/target .rustzen-admin

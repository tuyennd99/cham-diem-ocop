#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/dev/Desktop/cham-diem-ocop"
COMPOSE_DIR="/srv/apps/cham-diem-ocop"
NODE_BIN="/home/dev/.local/node-v24.7.0-linux-x64/bin"
API_HEALTH_URL="http://127.0.0.1:3030/api/system/health/ready"
WEB_URL="http://127.0.0.1:5173"

echo "[deploy] Installing dependencies, running Prisma migrations, and building API + Web SSR..."
cd "$REPO_DIR"
podman run --rm --userns=keep-id --network=host \
  -e HOME=/home/dev \
  -e PATH="${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  -v /home/dev/.cache:/home/dev/.cache \
  -v /home/dev/.local/node-v24.7.0-linux-x64:/home/dev/.local/node-v24.7.0-linux-x64:ro \
  -v /home/dev/.local/share/pnpm:/home/dev/.local/share/pnpm \
  -v "${REPO_DIR}:${REPO_DIR}" \
  -w "$REPO_DIR" \
  docker.io/library/node:24-bookworm-slim \
  sh -c "pnpm install --frozen-lockfile && pnpm --filter @ocop/api prisma generate && pnpm --filter @ocop/api prisma:migrate:deploy && pnpm build"

echo "[deploy] Recreating ocop-api and ocop-web containers..."
cd "$COMPOSE_DIR"
podman compose down --remove-orphans >/dev/null 2>&1 || true
podman rm -f ocop-api ocop-web >/dev/null 2>&1 || true
COMPOSE_PARALLEL_LIMIT=1 podman compose up -d --force-recreate

echo "[deploy] Waiting for API readiness (${API_HEALTH_URL})..."
api_ready=0
for _ in $(seq 1 30); do
  if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
    api_ready=1
    break
  fi
  sleep 1
done
if [ "$api_ready" -ne 1 ]; then
  echo "[deploy] ERROR: API readiness check failed: ${API_HEALTH_URL}" >&2
  podman logs --tail 50 ocop-api >&2 || true
  exit 1
fi

echo "[deploy] Waiting for Web SSR (${WEB_URL})..."
web_ready=0
for _ in $(seq 1 30); do
  if curl -fsSI "$WEB_URL" >/dev/null 2>&1; then
    web_ready=1
    break
  fi
  sleep 1
done
if [ "$web_ready" -ne 1 ]; then
  echo "[deploy] ERROR: Web SSR check failed: ${WEB_URL}" >&2
  podman logs --tail 50 ocop-web >&2 || true
  exit 1
fi

echo "[deploy] Verified API readiness and Web SSR (production mode)."

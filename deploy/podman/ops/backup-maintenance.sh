#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres-db}"
POSTGRES_ENV_FILE="${POSTGRES_ENV_FILE:-/srv/apps/postgres/.env}"
STAGING_DIR="${STAGING_DIR:-/srv/storage/backups/staging/postgres}"

PENDING_AUTH_DBS=("chamdiemocop_prod" "chamdiemocop_dev")
DUMP_DBS=("chamdiemocop_prod" "chamdiemocop_dev" "kh2959")

log() {
  printf '[%s] %s\n' "$(date -Iseconds)" "$*"
}

resolve_postgres_user() {
  local pg_user=""
  if [[ -r "$POSTGRES_ENV_FILE" ]]; then
    pg_user="$(grep -E '^POSTGRES_USER=' "$POSTGRES_ENV_FILE" | head -n1 | cut -d= -f2- | tr -d "\"'\r" || true)"
  fi
  if [[ -z "$pg_user" ]]; then
    pg_user="$(podman exec "$POSTGRES_CONTAINER" printenv POSTGRES_USER 2>/dev/null || true)"
  fi
  if [[ -z "$pg_user" ]]; then
    pg_user="postgres"
  fi
  printf '%s' "$pg_user"
}

main() {
  if ! podman container exists "$POSTGRES_CONTAINER"; then
    log "ERROR: container '$POSTGRES_CONTAINER' does not exist" >&2
    exit 1
  fi

  local pg_user
  pg_user="$(resolve_postgres_user)"
  log "Using PostgreSQL user '$pg_user' on container '$POSTGRES_CONTAINER'"

  for db in "${PENDING_AUTH_DBS[@]}"; do
    local before after
    before="$(podman exec "$POSTGRES_CONTAINER" psql -U "$pg_user" -d "$db" -v ON_ERROR_STOP=1 -tAc 'SELECT COUNT(*) FROM "pending_auth";')"
    podman exec "$POSTGRES_CONTAINER" psql -U "$pg_user" -d "$db" -v ON_ERROR_STOP=1 -c 'DELETE FROM "pending_auth" WHERE "expiresAt" <= NOW();' >/dev/null
    after="$(podman exec "$POSTGRES_CONTAINER" psql -U "$pg_user" -d "$db" -v ON_ERROR_STOP=1 -tAc 'SELECT COUNT(*) FROM "pending_auth";')"
    log "pending_auth cleanup on '$db': before=${before} after=${after} removed=$((before - after))"
  done

  mkdir -p "$STAGING_DIR"
  chmod 700 "$STAGING_DIR"

  for db in "${DUMP_DBS[@]}"; do
    local target="${STAGING_DIR}/${db}.dump"
    local tmp="${target}.tmp"
    rm -f "$tmp"

    log "Dumping database '$db' -> '$target'"
    podman exec "$POSTGRES_CONTAINER" pg_dump -U "$pg_user" -Fc "$db" > "$tmp"

    if [[ ! -s "$tmp" ]]; then
      rm -f "$tmp"
      log "ERROR: dump file for '$db' is empty" >&2
      exit 1
    fi

    chmod 600 "$tmp"
    mv -f "$tmp" "$target"

    if [[ ! -s "$target" ]]; then
      log "ERROR: final dump file '$target' is missing or empty" >&2
      exit 1
    fi

    local size_bytes
    size_bytes="$(wc -c < "$target" | tr -d ' ')"
    log "Verified dump '$target' (${size_bytes} bytes)"
  done

  log "Backup maintenance completed successfully"
}

main "$@"

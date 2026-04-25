#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
SMOKE_USER="${SMOKE_USER:-admin}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-password}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/nightdevweb2-smoke-cookie.txt}"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python3

json_field() {
  local field="$1"
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); value=data
for part in sys.argv[1].split("."):
    if isinstance(value, dict):
        value=value.get(part)
    else:
        value=None
        break
print("" if value is None else value)' "$field"
}

request() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local response
  if [[ -n "$data" ]]; then
    response=$(curl -sS -w '\n%{http_code}' -X "$method" "$BASE_URL$endpoint" \
      -H 'Content-Type: application/json' \
      -c "$COOKIE_JAR" \
      -b "$COOKIE_JAR" \
      --data "$data")
  else
    response=$(curl -sS -w '\n%{http_code}' -X "$method" "$BASE_URL$endpoint" \
      -H 'Content-Type: application/json' \
      -c "$COOKIE_JAR" \
      -b "$COOKIE_JAR")
  fi

  HTTP_BODY=$(printf '%s' "$response" | sed '$d')
  HTTP_CODE=$(printf '%s' "$response" | tail -n1)
}

endpoint_failure_hint() {
  local label="$1"
  case "$label" in
    "/api/settings")
      echo "Hint: verify runtime config/bootstrap (DATABASE_URL, JWT_SECRET, and app startup health)." >&2
      ;;
    "/api/auth/me before login"|"/api/auth/me after login")
      echo "Hint: verify auth cookie/JWT config and smoke credentials (SMOKE_USER/SMOKE_PASSWORD)." >&2
      ;;
    "/api/admin/observability/metrics")
      echo "Hint: verify admin auth path and observability metrics route permissions/handlers." >&2
      ;;
  esac
}

assert_status() {
  local expected="$1"
  local label="$2"
  if [[ "$HTTP_CODE" != "$expected" ]]; then
    echo "✗ $label expected HTTP $expected, got $HTTP_CODE" >&2
    endpoint_failure_hint "$label"
    echo "Response body: $HTTP_BODY" >&2
    exit 1
  fi
  echo "✓ $label (HTTP $HTTP_CODE)"
}

echo "[smoke] Base URL: $BASE_URL"

echo "[smoke] GET /api/settings"
request GET /api/settings
assert_status 200 "/api/settings"

echo "[smoke] GET /api/auth/me (unauthenticated)"
request GET /api/auth/me
assert_status 401 "/api/auth/me before login"

echo "[smoke] POST /api/auth/login (invalid credentials, expected 401)"
request POST /api/auth/login "{\"username\":\"$SMOKE_USER\",\"password\":\"${SMOKE_PASSWORD}-invalid\"}"
assert_status 401 "/api/auth/login invalid credentials"

echo "[smoke] POST /api/auth/login"
request POST /api/auth/login "{\"username\":\"$SMOKE_USER\",\"password\":\"$SMOKE_PASSWORD\"}"
assert_status 200 "/api/auth/login"

echo "[smoke] GET /api/auth/me (authenticated)"
request GET /api/auth/me
assert_status 200 "/api/auth/me after login"
csrf_token=$(printf '%s' "$HTTP_BODY" | json_field 'csrfToken')
if [[ -z "$csrf_token" ]]; then
  echo "✗ /api/auth/me response missing csrfToken" >&2
  echo "Hint: verify auth/me response shape and CSRF middleware wiring." >&2
  exit 1
fi

echo "[smoke] GET /api/admin/observability/metrics (authenticated flow)"
request GET /api/admin/observability/metrics
assert_status 200 "/api/admin/observability/metrics"

echo "[smoke] completed successfully"

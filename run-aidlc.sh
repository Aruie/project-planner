#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOCAL_ENV_FILE="$ROOT_DIR/.env.local"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

export AIDLC_ADMIN_USERNAME="${AIDLC_ADMIN_USERNAME:-admin}"
export AIDLC_ADMIN_PASSWORD="${AIDLC_ADMIN_PASSWORD:-admin1234}"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - EXIT INT TERM
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! command -v fnm >/dev/null 2>&1; then
  printf 'fnm을 찾을 수 없습니다. Node v22.23.2를 준비하세요.\n' >&2
  exit 1
fi
fnm use v22.23.2 >/dev/null
if [ "$(node --version)" != "v22.23.2" ]; then
  printf 'Node v22.23.2가 필요합니다. 현재: %s\n' "$(node --version)" >&2
  exit 1
fi
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  printf 'frontend dependencies가 없습니다. frontend에서 npm ci를 실행하세요.\n' >&2
  exit 1
fi

"$ROOT_DIR/run-backend.sh" --reload &
BACKEND_PID=$!
(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --host "${AIDLC_FRONTEND_HOST:-0.0.0.0}" --port "${AIDLC_FRONTEND_PORT:-5173}"
) &
FRONTEND_PID=$!

printf 'AIDLC backend: http://%s:%s\n' "${AIDLC_HOST:-127.0.0.1}" "${AIDLC_PORT:-8000}"
printf 'AIDLC frontend: http://%s:%s\n' "${AIDLC_FRONTEND_HOST:-0.0.0.0}" "${AIDLC_FRONTEND_PORT:-5173}"
printf 'Local development: 로그인 화면을 건너뛰고 admin으로 자동 진입합니다.\n'
wait -n "$BACKEND_PID" "$FRONTEND_PID"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if ! command -v uv >/dev/null 2>&1; then
  printf 'uv를 찾을 수 없습니다. uv를 설치한 뒤 다시 실행하세요.\n' >&2
  exit 1
fi

exec uv --directory "$BACKEND_DIR" run uvicorn app.main:app \
  --host "${AIDLC_HOST:-127.0.0.1}" \
  --port "${AIDLC_PORT:-8000}" \
  --access-log \
  --log-level info \
  "$@"

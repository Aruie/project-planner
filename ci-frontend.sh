#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ARTIFACT_DIR="${CI_ARTIFACT_DIR:-$ROOT_DIR/.ci-artifacts}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$ARTIFACT_DIR/frontend-ci-$TIMESTAMP.log"

mkdir -p "$ARTIFACT_DIR"
if ! command -v fnm >/dev/null 2>&1; then
  printf 'fnm을 찾을 수 없습니다. Node 22 LTS 환경을 준비하세요.\n' >&2
  exit 1
fi
fnm use v22.23.2 >/dev/null
if [ "$(node --version)" != "v22.23.2" ]; then
  printf 'Node v22.23.2가 필요합니다. 현재: %s\n' "$(node --version)" >&2
  exit 1
fi

set +e
(
  set -e
  cd "$FRONTEND_DIR"
  npm ci
  npm run format:check
  npm run lint
  npm run typecheck
  npm run test
  npm run build
) 2>&1 | tee "$LOG_FILE"
STATUS=${PIPESTATUS[0]}
set -e
printf 'CI log: %s\n' "$LOG_FILE"
exit "$STATUS"

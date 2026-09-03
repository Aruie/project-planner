#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACT_DIR="${CI_ARTIFACT_DIR:-$ROOT_DIR/.ci-artifacts}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$ARTIFACT_DIR/backend-ci-$TIMESTAMP.log"

mkdir -p "$ARTIFACT_DIR"

set +e
(
  set -e
  cd "$ROOT_DIR/backend"
  uv lock --check
  uv run pytest
  uv run ruff check app tests
  uv run python -m compileall -q app
) 2>&1 | tee "$LOG_FILE"
STATUS=${PIPESTATUS[0]}
set -e

printf 'CI log: %s\n' "$LOG_FILE"
if [ "$STATUS" -ne 0 ]; then
  printf 'CI failed. Hypothesis shrinking and pytest reproduction output are preserved in the log.\n' >&2
fi
exit "$STATUS"

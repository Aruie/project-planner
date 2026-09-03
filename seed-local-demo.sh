#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="$ROOT_DIR/.env.local"

if [ ! -f "$LOCAL_ENV_FILE" ]; then
  printf '.env.local이 없습니다. 먼저 local AWS environment를 준비하세요.\n' >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  printf 'uv를 찾을 수 없습니다. uv를 설치한 뒤 다시 실행하세요.\n' >&2
  exit 1
fi

unset AWS_REGION AIDLC_DYNAMODB_TABLE_PREFIX AIDLC_S3_BUCKET_NAME
unset AIDLC_ADMIN_USERNAME AIDLC_ADMIN_PASSWORD
set -a
# shellcheck disable=SC1090
. "$LOCAL_ENV_FILE"
set +a
exec uv --directory "$ROOT_DIR/backend" run python scripts/seed_local_demo.py

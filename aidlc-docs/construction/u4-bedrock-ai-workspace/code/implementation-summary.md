# U4 Bedrock AI Workspace 구현 요약

## 구현 범위
U4는 프로젝트 범위 temporary AI session, Bedrock Converse preview, 24시간 TTL, explicit reviewed Draft save backend를 구현했다. React workspace는 U5 소유로 유지한다.

## 구현 파일
- U1 session state/persistence: `backend/app/domain/entities.py`, `backend/app/domain/errors.py`, `backend/app/persistence/dynamodb.py`
- U4 application: `backend/app/features/ai_workspace/{models,ports,errors,services,bedrock,dependencies,routes}.py`
- API composition: `backend/app/main.py`
- tests: `backend/tests/unit/u4/`, `backend/tests/property/u4/`, `backend/tests/contract/u4/`, `backend/tests/support/{u4_fakes.py,strategies/u4.py}`

## API
- `POST /projects/{project_id}/ai-sessions`: temporary session start/reuse
- `GET /projects/{project_id}/ai-sessions/{session_id}`: scoped active-state read
- `POST /projects/{project_id}/ai-sessions/{session_id}/messages`: one Converse call and successful state refresh
- `POST /projects/{project_id}/ai-sessions/{session_id}/reviewed-saves`: explicit U2 Draft creation

## Ownership and failure boundary
- `DynamoDbAiSessionRepository` saves immutable U1 `AiWorkspaceSession` snapshots with `expires_at_epoch` DynamoDB TTL and no in-process cache.
- `BedrockConverseAdapter` alone calls boto3 Bedrock Runtime Converse with `global.anthropic.claude-haiku-4-5-20251001-v1:0`.
- `AiWorkspaceService` validates project/session scope, read-time expiry, 20 KiB prompt, last 20 successful messages, and 300 KiB preview before persisting a full successful snapshot.
- Bedrock failure performs no session update or failed-prompt write, exposes only `BEDROCK_INVOCATION_FAILED`, and has no automatic retry.
- `save_reviewed` validates non-empty preview and calls injected U2 `LifecycleService.create` only. It never writes an Artifact/VersionSnapshot directly or confirms a version.

## PBT and verification mapping
- PBT-02: U4 DTO and error serialization round trips.
- PBT-03: success-only TTL, failure preservation, scope mismatch, expiry, explicit reviewed save/no auto-save.
- PBT-07: bounded prompt/history/preview/session/project strategies.
- PBT-08/09: existing pytest discovery and pinned Hypothesis execute through `ci-backend.sh`/systemd timer.
- Bedrock is verified with botocore Stubber; no tests invoke a live model.

## Validation evidence
- Targeted U4 lint and unit/property/contract validation: **16 passed**.
- Full backend validation: Ruff format/check, compileall, `uv lock --check`, and **71 passed**.
- Existing `./ci-backend.sh`: **71 passed**, latest CI log `.ci-artifacts/backend-ci-20260903T014701Z.log`.
- EC2 `aidlc-backend-ci.service`: `Result=success`, `ExecMainStatus=0`; 15-minute `aidlc-backend-ci.timer`: `enabled`, `active`.

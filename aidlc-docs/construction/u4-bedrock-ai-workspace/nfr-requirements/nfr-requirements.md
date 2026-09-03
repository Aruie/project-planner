# U4 비기능 요구사항

## 적용 범위
- **단위**: U4 — Bedrock AI conversation, temporary preview, 24-hour TTL session, explicit reviewed Draft save
- **운영 전제**: single-admin EC2 MVP, Python 3.12/uv, existing boto3 and EC2 systemd CI
- **제외**: auto retry, auto document/version save, queue/cache, conversation recovery after expiry, U5 UI

## NFR-U4-001: Bedrock invocation and bounded context
- U4 uses Bedrock Converse API with `global.anthropic.claude-haiku-4-5-20251001-v1:0`.
- Each message request invokes Bedrock once synchronously; no automatic retry, queue, or response cache exists.
- New prompt is at most 20 KiB, context includes at most 20 successful messages, and preview is at most 300 KiB through ContentRef policy.
- Exceeding any bound returns `AI_INPUT_TOO_LARGE` before Bedrock invocation.

## NFR-U4-002: TTL and consistency
- Session/preview expires 24 hours after the latest successful message/preview update.
- U4 has no in-process session cache; U1 AiSessionRepository is the source of truth.
- Expired session/preview is not restored and returns `AI_SESSION_EXPIRED`; a new session starts a new conversation.
- Successful update persists the full new session snapshot with refreshed expiry; U4 does not expose a partial new preview.

## NFR-U4-003: failure preservation
- Bedrock failure preserves last successful stored messages and preview, and failed prompt is not persisted.
- Safe response exposes Korean message, stable code, retryable only; it excludes prompts, model response, model configuration, AWS error detail, and stack trace.
- U4 does not automatically retry a failure. User submits an explicit corrected prompt.
- U2 reviewed save failure leaves U4 preview/session unchanged and returns U2 safe error.

## NFR-U4-004: scope and reviewed save
- Every session, message, preview, and reviewed-save request verifies `project_id` against session ownership.
- Preview becomes official only after explicit reviewed save through U2 lifecycle create contract.
- U4 cannot create VersionSnapshot, mutate an existing Draft, or bypass U2 project/artifact scope.

## NFR-U4-005: maintainability, PBT, CI
- Bedrock adapter is behind a typed port; U4 service/routes never invoke boto3 directly.
- PBT-02: session/preview/message DTO serialization round trip.
- PBT-03: 24-hour refresh only after success, failure preservation, scope consistency, explicit save/no auto-save, expiry normal error.
- PBT-07: bounded prompt, message list, preview ContentRef, project/session scope, reviewed-save strategies.
- PBT-08: U4 property tests execute under existing `ci-backend.sh` and 15-minute systemd timer.
- PBT-09: U1 pinned Hypothesis dependency is reused.

## Extension compliance
| Extension | Status | Application |
|---|---|---|
| Security Baseline | Disabled | scope and safe error exposure remain U4 functional/NFR rules |
| Resiliency Baseline | Disabled | backup/failover/circuit breaker remain out of scope |
| Property-Based Testing | Partial | PBT-02/03/07/08/09 are mandatory in U4 Code Generation |

# U4 NFR 설계 패턴

## 확정 패턴
| 영역 | 설계 |
|---|---|
| Bedrock adapter | BedrockConversationPort가 Converse API를 감추고 `global.anthropic.claude-haiku-4-5-20251001-v1:0`만 호출한다. U4 service는 boto3를 알지 않는다. |
| bounded context | ContextWindowBuilder가 새 prompt 20 KiB, 성공 message 20개, preview 300 KiB를 검증하고 초과 시 invoke 전 `AI_INPUT_TOO_LARGE`를 반환한다. |
| session source of truth | U1 AiSessionRepository/DynamoDB TTL만 사용하고 memory cache를 두지 않는다. |
| success snapshot | 성공 invoke 후 message/preview/expires_at을 가진 full immutable session snapshot을 저장하고 TTL을 24시간 refresh한다. |
| failure preservation | invoke 실패 시 session write를 하지 않아 last-success message/preview가 유지된다. automatic retry/failed prompt persistence 없음. |
| expiry | read-time expiry check가 만료 session을 `AI_SESSION_EXPIRED`로 거부한다. recovery/new preview migration 없음. |
| reviewed save | non-empty preview와 project/session scope를 검증한 뒤 U2 LifecycleService create contract를 한 번 호출한다. U4는 version/Draft mutation을 하지 않는다. |
| CI/PBT | PBT-02/03/07 property suite를 existing `ci-backend.sh`/systemd timer로 실행한다. |

## Send message 흐름
1. SessionScopeGuard가 project/session ownership과 read-time expiry를 확인한다.
2. ContextWindowBuilder가 prompt/history/preview bounds를 확인한다.
3. BedrockConversationAdapter가 Converse를 한 번 호출한다.
4. 성공이면 preview Markdown을 normalize하고 SessionStateService가 refreshed TTL snapshot을 저장한다.
5. 실패면 저장 없이 `BEDROCK_INVOCATION_FAILED` safe error를 반환한다.
6. response는 current saved preview 또는 new success preview만 반환하며 partial state를 반환하지 않는다.

## Reviewed save 흐름
1. ReviewedPreviewSaveService가 non-empty preview와 scope/expiry를 확인한다.
2. U2 create command에 requirements-definition metadata와 preview Markdown을 전달한다.
3. U2 성공 response만 official Draft result로 반환한다.
4. U2 실패 시 U4 session/preview는 변경하지 않는다.

## PBT 인계
- PBT-02: AiWorkspaceState, AiMessage, PreviewModel, AiApiError serialization round trip.
- PBT-03: only-success TTL refresh, failure preservation, scope consistency, expiry normal error, explicit reviewed save/no auto-save.
- PBT-07: bounded prompt/message/preview/session/project/reviewed-save strategies.
- PBT-08: U4 property test가 EC2 CI log에 포함되는 success evidence.
- PBT-09: U1 pinned Hypothesis 재사용.

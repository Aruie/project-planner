# U4 NFR 논리 컴포넌트

## 구성 요소
| 컴포넌트 | 책임 | 의존성 |
|---|---|---|
| SessionScopeGuard | project/session ownership, read-time expiry 확인 | U1 AiSessionRepository, U2 project scope read |
| SessionStateService | start/get/full success snapshot save, 24-hour TTL refresh | U1 AiSessionRepository, ContentRef |
| ContextWindowBuilder | 20 KiB prompt, 20 successful messages, 300 KiB preview validation | U4 DTO, U1 ContentRef policy |
| BedrockConversationPort | model-agnostic typed conversation contract | U4 service |
| BedrockConverseAdapter | global Claude Haiku 4.5 Converse invocation, safe provider error mapping | boto3 Bedrock Runtime at composition boundary |
| PreviewNormalizer | Bedrock response to requirements Markdown preview | U4 DTO |
| ReviewedPreviewSaveService | explicit preview validation and U2 normal create invocation | U2 LifecycleService interface |
| U4ErrorMapper | Korean stable code/message/retryable conversion | U1/U2/U4 error types |
| U4 Property Test Support | bounded session/preview/context strategies | Hypothesis, U1/U2 test support |

## 호출 경계
1. U4 FastAPI routes perform temporary admin auth and receive project/session command.
2. SessionScopeGuard/ContextWindowBuilder run before Bedrock invocation.
3. BedrockConversationPort is injected; no domain/application service imports boto3.
4. SessionStateService uses only U1 AiSessionRepository/ContentRef contracts.
5. ReviewedPreviewSaveService calls U2 only for explicit reviewed create, never U2 repository/DynamoDB directly.
6. Route converts success state or U4ErrorMapper output to explicit API schema.

## 의도적으로 없는 컴포넌트
| Component | Decision | Reason |
|---|---|---|
| retry middleware | 없음 | explicit user retry and last-success preservation |
| queue/worker | 없음 | synchronous single-admin conversation |
| session/response cache | 없음 | DynamoDB TTL source of truth and stale preview avoidance |
| circuit breaker/rate limiter | 없음 | personal EC2 MVP and disabled resiliency baseline |
| auto-save/auto-version worker | 없음 | explicit reviewed save boundary |

## EC2 CI 연결
- U4 unit/property/contract tests are placed in `backend/tests/`.
- Existing `ci-backend.sh` and active `aidlc-backend-ci.timer` execute uv lock, tests, Ruff, compileall.
- Before U4 completion, latest CI log must show U4 property tests and systemd service success.

# U4 Bedrock AI Workspace Code Generation 계획

## 상태와 단일 실행 원칙
- **단위**: U4 — Bedrock AI conversation, temporary preview, 24-hour TTL session, explicit reviewed Draft save
- **계획 상태**: 구현 승인 대기. 승인 전에는 아래 application code를 변경하지 않는다.
- **단일 소스**: 이 문서는 U4 Code Generation의 순서·파일 경계·검증을 고정한다. 구현 중 각 완료 항목은 즉시 `[x]`로 갱신한다.
- **이야기 매핑**: U4-BR-001~011, NFR-U4-001~005, PBT-02/03/07/08/09.

## 전제와 의존성
- U1은 `AiSessionId`, `AiWorkspaceSession`, `AiSessionRepository`, ContentRef, DynamoDB/S3 adapter boundary를 제공한다. U4는 temporary state를 이 boundary로만 저장한다.
- U2 `LifecycleService.create(project_id, ArtifactMetadata, content)`는 reviewed preview의 유일한 official Draft 생성 interface다. U4는 ArtifactRepository/VersionRepository를 직접 호출하거나 VersionSnapshot을 만들지 않는다.
- U3는 영향받지 않는다. U5 React workspace는 명시적으로 제외하며 U4는 backend API handoff만 제공한다.
- boto3 `1.38.46`, Python `3.12`, uv, existing temporary admin auth, `ci-backend.sh`, `aidlc-backend-ci.timer`를 재사용한다. 신규 dependency는 없다.

## 생성/수정 파일 경계
| 영역 | 생성 또는 수정 경로 | 책임 |
|---|---|---|
| U1 session persistence | `backend/app/domain/entities.py`, `backend/app/persistence/dynamodb.py`, `backend/app/features/artifacts/dependencies.py` | U4 history를 포함하는 immutable temporary snapshot, DynamoDB TTL serialization/read, composition-safe repository creation |
| U4 application | `backend/app/features/ai_workspace/{__init__,models,ports,errors,scope,services,bedrock,dependencies,routes}.py` | typed Converse boundary, bounded context, scope/expiry, success-only update, reviewed save, API |
| application composition | `backend/app/main.py` | U4 router and safe error handler inclusion |
| unit/API tests | `backend/tests/unit/u4/{__init__,test_services,test_routes,test_bedrock}.py`, `backend/tests/support/u4_fakes.py` | application behavior, API auth/schema, no direct SDK service invocation |
| property tests | `backend/tests/property/u4/{__init__,test_ai_workspace_properties}.py`, `backend/tests/support/strategies/u4.py` | PBT-02/03/07 strategies and invariants |
| AWS contract tests | `backend/tests/contract/u4/{__init__,test_bedrock_adapter_contract}.py` | botocore Stubber Converse request/response, no live model call |
| documentation | `aidlc-docs/construction/u4-bedrock-ai-workspace/code/implementation-summary.md` | changed files, API, boundary, test/CI evidence |

## API contract to generate
- `POST /projects/{project_id}/ai-sessions`: start a new temporary session or return an in-scope active session.
- `GET /projects/{project_id}/ai-sessions/{session_id}`: return the active scoped state; expired session returns `AI_SESSION_EXPIRED`.
- `POST /projects/{project_id}/ai-sessions/{session_id}/messages`: validate 20 KiB prompt/context, invoke exactly one typed port call, and return a refreshed state only after success.
- `POST /projects/{project_id}/ai-sessions/{session_id}/reviewed-saves`: validate non-empty preview and call injected U2 create interface. Return U2 ArtifactResponse without creating a version.
- All routes require existing temporary admin auth and declare success/error response schemas. Errors expose Korean message, stable code, retryable only.

## 실행 체크리스트
### Step 1 — U1 temporary session snapshot and DynamoDB persistence
- [x] Extend `AiWorkspaceSession` compatibly with U4 successful-message history required to reconstruct a bounded conversation; preserve project ID, preview ContentRef, and expiry as immutable state.
- [x] Implement `DynamoDbAiSessionRepository` in `backend/app/persistence/dynamodb.py` using the configured `ai_workspace_sessions` table, serialized ContentRef/history, session ID key, project ID ownership attribute, and DynamoDB numeric TTL attribute.
- [x] Map absent/expired repository state to typed domain errors; never implement in-process cache or recovery/migration of expired preview.
- [x] Wire the repository through a composition helper without exposing boto3 to U4 services.
- [x] Add U1 adapter unit coverage for serialization, scope key, TTL value, absent session, and ContentRef round trip where altered.

### Step 2 — U4 models, typed ports, safe errors, and bounded scope
- [x] Create U4 DTOs/models: successful `AiMessage`, `AiWorkspaceState`, start/send/reviewed-save commands, preview/result responses, and explicit `AiApiError` schema.
- [x] Define `BedrockConversationPort` and an explicit U2 reviewed-create protocol so U4 depends only on typed interfaces.
- [x] Create `AiWorkspaceProblem`/mapper with `AI_SESSION_EXPIRED`, `AI_SESSION_SCOPE_MISMATCH`, `AI_INPUT_TOO_LARGE`, `AI_PREVIEW_REQUIRED`, and `BEDROCK_INVOCATION_FAILED`; exclude prompt, model text/configuration, AWS detail, and stack trace.
- [x] Implement session scope/read-time-expiry guard and ContextWindowBuilder enforcing UTF-8 20 KiB prompt, last 20 successful messages, and 300 KiB preview ContentRef selection before Bedrock invocation.

### Step 3 — U4 application services and U2 reviewed-save seam
- [x] Implement start/get session services using U1 repository as source of truth with an initial 24-hour expiry.
- [x] Implement send-message orchestration: guard and bounds first, one port invocation, Markdown preview normalization, then a full immutable snapshot save with success-refreshed 24-hour expiry.
- [x] Guarantee failure preservation: Bedrock failure produces a retryable safe error and performs no session save or failed-prompt append; no automatic retry.
- [x] Implement explicit reviewed-preview save: revalidate scope/expiry/non-empty preview, invoke only injected U2 lifecycle create contract with requirements-definition Markdown metadata, and retain session state on U2 failure/success.
- [x] Do not add queues, response/session caches, retry middleware, circuit breaker, auto-save, Draft update, or Version confirmation logic.

### Step 4 — Bedrock Converse adapter and production dependencies
- [x] Implement `BedrockConverseAdapter` in `backend/app/features/ai_workspace/bedrock.py` with exactly `global.anthropic.claude-haiku-4-5-20251001-v1:0`, static product system guidance, bounded message mapping, and one synchronous `converse` call.
- [x] Normalize successful content to the typed `BedrockConversationResult`; map botocore/provider failures to typed safe failure without leaking SDK exception content.
- [x] Construct Bedrock Runtime client only in U4 dependency/composition code; inject U1 repository, U2 LifecycleService adapter, object storage if required for ContentRef resolution, and typed Bedrock port into U4 services.
- [x] Reuse settings AWS region and existing pinned boto3. Add no dependency.

### Step 5 — FastAPI routes and application composition
- [x] Create U4 router with the four scoped APIs, request parsing via `ProjectId`/`AiSessionId`, temporary admin authentication, and explicit success/error schemas.
- [x] Add U4 error handler and router to `backend/app/main.py`; preserve current artifact/rendering handlers and routes.
- [x] Verify reviewed-save returns only U2-created Draft metadata, while temporary preview is never represented as an artifact/version result.

### Step 6 — Unit, route, and Bedrock contract tests
- [x] Add deterministic U4 fakes for session repository, clock, typed Bedrock conversation port, and U2 create interface.
- [x] Test start/get, ownership mismatch, expiry, prompt/context/preview bounds, exactly-once invoke, success-only TTL refresh, failure preservation, no failed prompt persistence, no automatic retry, and reviewed-save U2-only behavior.
- [x] Test routes for temporary admin auth, response schemas, Korean safe errors, scoped session handling, and no route-triggered auto-save/version creation.
- [x] Use botocore `Stubber` contract tests to assert Converse model ID/request mapping/success parsing/provider failure mapping, without AWS credentials or live Bedrock invocation.

### Step 7 — Required PBT implementation
- [x] Add PBT-02 serialization round-trip properties for U4 DTOs/session/preview/error payloads.
- [x] Add PBT-03 state-transition properties: TTL refresh only after success, failure preservation, scope consistency, expiry as normal error, and explicit save/no auto-save.
- [x] Add PBT-07 bounded strategies for UTF-8 prompt size, message counts, preview ContentRef threshold, project/session pairs, and reviewed-save inputs.
- [x] Reuse the U1 pinned Hypothesis dependency (PBT-09) and ensure new property modules run from existing test discovery (PBT-08).

### Step 8 — Documentation and complete verification
- [x] Create U4 implementation summary with API paths, model/port boundary, U1/U2 ownership, test files, and PBT traceability.
- [x] Run `uv run ruff format app tests`, `uv run ruff check app tests`, `uv run pytest`, `uv run python -m compileall -q app`, and `uv lock --check` from `backend/`; correct all failures before completion.
- [x] Run root `./ci-backend.sh`, start/check `aidlc-backend-ci.service`, and confirm active/enabled 15-minute `aidlc-backend-ci.timer`; retain latest CI log evidence.
- [x] Mark every above checkbox completed only after its artifact/validation exists, then request U4 Code Generation review.

## 승인 기준
- Exact model, bounded inputs, 24-hour success-only TTL, failure preservation, scope guard, explicit U2 save, and no-retry/cache/queue are each represented by code and tests.
- U4 service/routes have no direct boto3 call; only adapter/composition owns SDK use.
- Full backend lint/test/compile/lock/CI and systemd timer evidence succeeds.
- No frontend code, no unpinned/new dependencies, no direct U4 Artifact/Version persistence bypass is introduced.

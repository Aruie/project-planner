# U2 Code Generation 계획

## 상태와 단일 실행 기준
- **단위**: U2 — Document, Version, Diff, Traceability Services
- **상태**: 구현 완료, 검토 승인 대기
- **코드 위치**: `backend/` (애플리케이션), `aidlc-docs/construction/u2-document-version-trace/code/` (구현 요약만)
- **실행 원칙**: 이 파일의 완료되지 않은 순서대로만 구현하며, 각 Step 완료 즉시 `[x]`로 갱신한다.
- **추가 의존성**: 없음. 기존 고정 FastAPI/Pydantic/pytest/Hypothesis/boto3/ruff와 Python 3.12/uv만 사용한다.

## 단위 맥락과 스토리 추적성
| 스토리 | U2 구현 범위 | 주요 결과 |
|---|---|---|
| US-002 | Artifact 생성과 빈 Draft | immutable type, metadata, public document ID, revision 1 |
| US-003 | Markdown Draft 편집 API | optimistic revision 및 ContentRef |
| US-007 | current Draft lifecycle | scoped read/update, conflict 재조회 정보 |
| US-008 | immutable version 확정/history | artifact별 conditional version number/append |
| US-009 | Draft/Version diff | metadata + normalized line hunk |
| US-010 | TraceLink/gap | complete link, paged list, normal empty gap |

## 의존성·경계
- U1을 소비한다: typed entity/identifier/ContentRef, repository/ObjectStorage port, DynamoDB/S3 adapter foundation, 공통 오류와 error logger.
- U1 소유 경계에서만 확장한다: U2가 필요한 scoped read/list, metadata 영속화, transaction/condition 기반 Artifact/Draft create·version append·trace read/write 계약과 adapter 구현을 `app/domain/` 및 `app/persistence/`에 추가한다.
- U2가 소유한다: metadata/DTO, pagination, ProjectScopeGuard, lifecycle/version/diff/trace services, Korean API error mapper와 REST routes.
- U3/U4/U5는 변경하지 않는다. cache, queue, external diff dependency, memory lock, 새 CI/deployment component도 추가하지 않는다.

## 구현 Steps

### Step 1 — U1 공유 계약을 U2 lifecycle 요구에 맞게 최소 확장
- [x] `backend/app/domain/entities.py`에 U2가 보존해야 하는 Artifact/Draft/VersionSnapshot metadata와 attachment reference의 불변 필드를 추가하고 기존 생성 경로를 호환되게 갱신한다.
- [x] `backend/app/domain/ports.py`에 프로젝트 scoped Artifact/Draft/Version/TraceLink get/list/create/update와 conditional version allocation/append 계약을 추가한다. DynamoDB SDK type은 노출하지 않는다.
- [x] `backend/app/domain/errors.py`에 U2가 안정적으로 매핑할 not-found, version conflict, scope/validation 관련 domain 오류를 추가한다.
- [x] 기존 U1 도메인 단위 테스트와 port contract 테스트를 확장하여 shared-contract 호환성, snapshot metadata 보존, version condition을 고정한다.

### Step 2 — U1 DynamoDB adapter를 조건부·scoped persistence로 완성
- [x] `backend/app/persistence/dynamodb.py`에서 Artifact+initial Draft의 원자 create, metadata를 포함한 Draft read/conditional replace, project scoped Artifact 목록, Version get/list/conditional append, TraceLink save/get/list를 구현한다.
- [x] version number 중복을 막는 DynamoDB condition/transaction을 구현한다. 메모리 lock 또는 last-write-wins를 사용하지 않는다.
- [x] 모든 adapter read/write가 project scope를 키/condition으로 확인하고 AWS 세부를 `DomainError`로 변환하게 한다.
- [x] `backend/tests/unit/u1/`과 `backend/tests/contract/u1/`에 Mock/Stubber 기반 adapter 조건·request-shape·오류 매핑 테스트를 추가한다.

### Step 3 — U2 artifact application model, 오류 및 pagination 구현
- [x] `backend/app/features/artifacts/__init__.py`, `models.py`, `errors.py`, `pagination.py`를 생성한다.
- [x] Pydantic request/response DTO로 ArtifactMetadata, lifecycle commands, VersionSummary, DiffSource/DiffResult, TraceLink/TraceGapResult, paged result, ApiError를 명시한다.
- [x] metadata title/description/tags 정규화, immutable ArtifactType, complete TraceLink 검증을 구현한다.
- [x] URL-safe base64 JSON PaginationCodec을 구현한다. 기본 50/최대 100, resource kind/project ID/cursor encode/decode, invalid/token-scope mismatch 오류를 적용한다.
- [x] U1 errors를 Korean message, stable code, retryable, 선택적 current_revision으로 안전하게 변환하고 본문·bucket·object key·stack trace는 노출하지 않는다.
- [x] `backend/tests/unit/u2/`에 DTO/validation, error mapper, token/page-size 단위 테스트를 추가한다.

### Step 4 — ProjectScopeGuard와 Artifact/Draft lifecycle service 구현
- [x] `scope.py`에 ProjectScopeGuard를 구현해 모든 artifact/draft/version/diff source가 요청 project와 일치하는지 저장 전 검증한다.
- [x] `services.py`의 LifecycleService로 project 조회, Artifact 생성, empty revision-1 Draft, Artifact/Draft detail read, expected_revision 기반 update를 구현한다.
- [x] inline/S3 ContentRef 선택은 U1 정책을 재사용하고, 새 S3 object가 Draft conflict로 참조되지 않으면 best-effort cleanup을 수행한다.
- [x] Draft 충돌은 기존 Draft를 보존하고 최신 current_revision을 가진 `DRAFT_REVISION_CONFLICT`로 변환한다. outcome unknown은 자동 재시도하지 않고 재조회 가능한 오류로 반환한다.
- [x] `backend/tests/unit/u2/test_lifecycle.py`와 fake U1 ports를 추가해 lifecycle, type immutability, scope, conflict, content cleanup을 검증한다.

### Step 5 — Version confirmation/history service 구현
- [x] `VersionConfirmationService`를 구현해 scoped current Draft를 snapshot으로 복사하고 artifact별 다음 양의 version number를 repository conditional append로 확정한다.
- [x] explicit confirmation은 동일 내용에도 새 immutable snapshot을 추가하며, current Draft/revision은 변경하지 않게 한다.
- [x] append 충돌/미확정 결과는 기존 history를 변경하지 않고 각각 재조회 가능한 stable API 오류로 변환한다.
- [x] Version history의 paged read를 PaginationCodec과 연결한다.
- [x] `backend/tests/unit/u2/test_versions.py`와 adapter contract 테스트로 version 순번, immutable payload, conflict, empty/paged history를 검증한다.

### Step 6 — Diff와 Traceability service 구현
- [x] `DiffService`에서 scoped Draft/Version source를 resolve하고 inline 또는 U1 ObjectStoragePort로 읽은 source를 각각 한 번만 normalized line sequence로 변환한다.
- [x] `difflib.SequenceMatcher` opcode를 added/removed/unchanged LineHunk로 변환하며 replace는 removed와 added hunk로 분리한다. metadata before/after와 summary count, empty-normal result를 구현한다.
- [x] `TraceabilityService`로 complete TraceLink create/get/list와 story/requirement/test-case 기준 목록의 gap 계산을 구현한다.
- [x] Artifact/Version/Trace 목록 paging을 resource-specific scope token으로 제공한다.
- [x] `backend/tests/unit/u2/test_diff.py` 및 `test_traceability.py`에서 S3 source, scope mismatch, read failure no-partial-result, hunk semantics, complete link, empty gap/list를 검증한다.

### Step 7 — FastAPI composition과 U2 REST/OpenAPI boundary 구현
- [x] `dependencies.py`와 `routes.py`를 생성하고 settings/AWS clients/U1 adapters/U2 services의 production composition 및 test dependency override seam을 제공한다.
- [x] `backend/app/main.py`에 U2 router와 Korean ApiError exception handler를 연결한다. U1 temporary admin dependency를 각 route 경계에 적용한다.
- [x] 프로젝트, artifact/Draft, version/history, diff, TraceLink/gap REST resources를 명시 response model과 page token으로 구현한다.
- [x] `backend/tests/unit/u2/test_routes.py`에서 route authorization, validation/error response, scope mismatch, pagination, OpenAPI response schema를 fake ports로 검증한다.

### Step 8 — U2 PBT 전략과 property tests 구현
- [x] `backend/tests/support/strategies/u2.py`에 metadata, project/artifact scope, version, cursor, line hunk, complete TraceLink 전략을 추가한다.
- [x] `backend/tests/property/u2/test_artifact_properties.py`에 PBT-02 DTO/DiffResult/token serialization round-trip을 구현한다.
- [x] 동일 property suite에 PBT-03 revision +1, conflict immutability, unique/increasing version, project scope consistency, complete TraceLink, empty diff/trace normal result를 구현한다.
- [x] 전략 제약, fixed Hypothesis dependency와 shrinking 재현성이 PBT-07/PBT-09를 만족하는지 문서화한다.

### Step 9 — 통합 검증, EC2 CI 증거와 구현 요약
- [x] `uv lock --check`, `uv run pytest`, `uv run ruff check app tests`, `uv run python -m compileall -q app`을 `backend/`에서 실행하고 실패를 수정한다.
- [x] `./ci-backend.sh`를 실행해 U2 tests 포함 로그를 `.ci-artifacts/`에 남긴다.
- [x] `aidlc-backend-ci.service`를 실행하고 `aidlc-backend-ci.timer` enabled/active 및 service success와 최신 log의 U2 property test 실행을 확인한다. 기존 systemd unit은 삭제·비활성화하지 않는다.
- [x] `aidlc-docs/construction/u2-document-version-trace/code/implementation-summary.md`에 생성/수정 파일, endpoint, 검증 결과, U3/U4/U5 handoff를 기록한다.
- [x] 모든 Step와 스토리 매핑을 완료로 갱신하고 U2 Code Generation 완료 검토를 요청한다.

## 검증 기준
- Artifact type은 생성 후 변경할 수 없고 Draft update 성공은 revision을 정확히 1 증가시킨다.
- VersionSnapshot은 artifact별 양의 고유 순번이며 append 성공 때만 history에 노출되고 Draft를 수정하지 않는다.
- diff와 trace의 빈 결과는 오류가 아니며, 실패 diff는 partial result를 반환하지 않는다.
- 모든 resource/token/compare source는 project scope를 벗어날 수 없다.
- U2는 AWS SDK를 직접 호출하지 않고 U1 typed port만 사용한다.
- U2 PBT-02/03/07/08/09와 uv/Python 3.12/기존 EC2 CI 정책을 충족한다.

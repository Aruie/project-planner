# U2 기술 스택 결정

## 결정 요약
| 영역 | 선택 | 근거 |
|---|---|---|
| 서비스/HTTP | 기존 Python 3.12 + FastAPI + Pydantic | U1 backend foundation과 동일한 typed REST/OpenAPI 경계 |
| 도메인 기반 | U1 entity, repository port, ObjectStoragePort | U2가 AWS SDK와 저장소 세부를 직접 알지 않음 |
| 목록 pagination | DynamoDB continuation key를 감싼 opaque token | 수백 건 목록을 page 단위로 제공하고 Project 범위 혼합 방지 |
| 본문 diff | Python `difflib.SequenceMatcher` | line hunk 생성에 충분하며 새 dependency 불필요 |
| version concurrency | Artifact별 조건부 allocation/append | 메모리 lock/last-write-wins 없이 version number 중복 방지 |
| 오류 응답 | Pydantic response model의 Korean message + stable code | U5 UI의 안정적 오류 처리와 사용자 언어 정책 준수 |
| PBT | 기존 Hypothesis + pytest | U1에서 고정 dependency·EC2 CI·shrinking/seed 보존 기반 마련 |
| CI | 기존 `ci-backend.sh` + `aidlc-backend-ci.timer` | `backend/tests/` 전체 실행 및 `.ci-artifacts/` 로그 보존 |

## pagination token 계약
- token은 DynamoDB의 원시 `LastEvaluatedKey`를 API에 노출하지 않는다.
- U2는 resource kind와 `project_id`를 포함한 내부 cursor를 직렬화해 opaque token으로 반환한다.
- token의 project/resource kind가 현재 요청과 다르면 `PAGINATION_TOKEN_SCOPE_MISMATCH`로 거부한다.
- 첫 page는 token 없이 요청하며, 마지막 page의 next token은 null이다.

## diff 구현 선택
- `difflib.SequenceMatcher`는 normalized line sequence를 입력으로 사용한다.
- U2는 opcode를 `added`, `removed`, `unchanged` LineHunk로 변환한다.
- replace opcode는 removed hunk와 added hunk로 명시해 UI가 before/after를 독립적으로 표시할 수 있게 한다.
- S3 source는 U1 ObjectStoragePort를 통해 읽는다. read/error 결과는 U2 structure error로 변환한다.

## 버전 확정 저장 전략
1. 현재 Draft와 Artifact version history를 프로젝트 범위로 읽는다.
2. 다음 version number와 새 VersionId를 만든다.
3. immutable VersionSnapshot을 append-only port로 저장한다.
4. 저장 결과가 미확정이면 자동 재시도하지 않고 history 재조회를 요구한다.
5. concurrent conflict는 재조회 가능한 `VERSION_CONFIRMATION_CONFLICT`로 반환한다.

## U2 Code Generation 의존성 정책
- U2는 새 Python package를 추가하지 않는다.
- U1 `pyproject.toml`의 FastAPI, Pydantic, boto3, pytest, Hypothesis, ruff 고정 버전을 그대로 사용한다.
- U2 code/test 추가 후 `uv lock --check`, `uv run pytest`, `uv run ruff check app tests`를 EC2 CI와 로컬에서 실행한다.

## 도입 보류 기술
| 기술 | 상태 | 사유 |
|---|---|---|
| 비동기 diff queue/worker | 보류 | 단일 관리자 MVP, 시간 SLO 없음 |
| Redis/cache | 보류 | 수백 건 pagination과 DynamoDB page 조회로 충분 |
| 외부 diff package | 보류 | 표준 `difflib`가 요구사항 충족 |
| version memory lock | 금지 | EC2 process 단위 lock은 저장소 동시성 보장 불가 |
| U2 전용 CI | 보류 | 기존 EC2 CI가 backend 전체 테스트를 실행 |

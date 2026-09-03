# U2 NFR 설계 패턴

## 확정 패턴
| 영역 | 설계 |
|---|---|
| 실패 복구 | 자동 재시도·부분 결과 없이 구조화 오류 반환. 결과 미확정 저장은 최신 Draft/version history 재조회. |
| pagination | 기본 50, 최대 100. resource kind/project ID/cursor의 URL-safe base64 token을 매 요청 scope와 대조. |
| 대형 diff | 두 source를 한 번씩 읽어 normalized line sequence와 `difflib.SequenceMatcher`로 처리. cache/queue 없음. |
| version 동시성 | Artifact별 조건부 version allocation/append. 충돌은 history 재조회 오류. |
| scope | 모든 lifecycle/diff/trace service 시작 시 ProjectScopeGuard가 project/artifact/source 관계 검증. |
| 런타임 구성 | LifecycleService, DiffService, TraceabilityService, PaginationCodec, ProjectScopeGuard, U1 ports만 사용. |

## 실패 보존 흐름
1. LifecycleService는 저장 전 project scope와 command를 검증한다.
2. Draft 조건부 저장/Version append 실패 시 U1 오류를 안전한 U2 ApiError로 변환한다.
3. 알려진 저장 실패는 `retryable`을 표시하지만 U2가 자동 재시도하지 않는다.
4. 결과 미확정 저장은 `PERSISTENCE_OUTCOME_UNKNOWN`과 재조회 지시를 반환한다.
5. DiffService는 두 source를 모두 정상 읽은 뒤에만 DiffResult를 반환한다. 하나라도 실패하면 partial hunk를 반환하지 않는다.
6. S3 write 후 Draft conflict면 U1의 best-effort orphan cleanup을 사용하며 기존 Draft/ContentRef는 보존한다.

## PaginationCodec
- 입력: `resource_kind`, `project_id`, DynamoDB cursor.
- 출력: URL-safe base64 JSON opaque token.
- decode 후 현재 요청의 resource kind/project ID와 다르면 `PAGINATION_TOKEN_SCOPE_MISMATCH`를 반환한다.
- 형식 오류/변조는 `PAGINATION_TOKEN_INVALID`를 반환한다.
- page size는 누락 시 50, 1 미만이면 validation 오류, 100 초과면 100으로 제한한다.
- raw DynamoDB LastEvaluatedKey를 API 응답에 직접 노출하지 않는다.

## DiffService
- Draft/Version source를 동일 project·artifact 범위에서 resolve한다.
- ContentRef가 inline이면 본문을 사용하고 S3이면 U1 ObjectStoragePort로 한 번 읽는다.
- line split 후 `SequenceMatcher` opcode를 `added`, `removed`, `unchanged` hunk로 변환한다.
- replace opcode는 removed hunk와 added hunk로 분리한다.
- metadata diff는 title/description/artifact_type/tags의 before/after만 포함한다.
- 빈 변경은 empty hunk와 0 count의 정상 DiffResult다.

## version 확정 패턴
- VersionConfirmationService는 current Draft를 읽고 next version number를 계산한다.
- VersionRepository 조건부 append가 성공할 때만 history에 새 snapshot이 나타난다.
- concurrent conflict는 기존 snapshot을 덮어쓰지 않으며 `VERSION_CONFIRMATION_CONFLICT`로 history 재조회를 요구한다.
- current Draft는 확정 흐름에서 변경하지 않는다.

## PBT/CI 설계
| 규칙 | 설계 |
|---|---|
| PBT-02 | Pagination token, DiffResult, ApiError DTO round-trip 테스트 |
| PBT-03 | page size bound, token scope, revision/snapshot/version 불변성, 빈 diff/trace 결과 |
| PBT-07 | project/artifact source, cursor, hunk, complete TraceLink 전략 |
| PBT-08 | U2 test가 `backend/tests/`에 추가되면 `ci-backend.sh`와 15분 systemd timer가 shrinking/failure 로그를 `.ci-artifacts/`에 보존 |
| PBT-09 | U1의 고정 Hypothesis dependency를 재사용 |

# U2 NFR 논리 컴포넌트

## 구성 요소
| 컴포넌트 | 책임 | 의존성 |
|---|---|---|
| ProjectScopeGuard | 모든 요청의 project/artifact/version/diff source 범위를 검증 | U1 Project/Artifact/Version port |
| LifecycleService | Artifact 생성, Draft 조건부 수정, snapshot 확정 | U1 repository/object storage port |
| VersionConfirmationService | next version number, immutable append, concurrent conflict 변환 | U1 Artifact/Version port |
| DiffService | metadata 및 line hunk diff | U1 ContentRef/ObjectStoragePort, `difflib` |
| TraceabilityService | complete TraceLink 저장 및 gap 계산 | U1 TraceLink port |
| PaginationCodec | page size 검증, opaque token encode/decode/scope 대조 | 표준 `base64`, `json` |
| U2ErrorMapper | U1/domain 오류를 한국어 ApiError로 변환 | U1 error type |
| U2 Property Test Support | U2 Hypothesis 전략과 property test | U1 test strategies, Hypothesis |

## 호출 경계
1. FastAPI route(U2 Code Generation)에서 인증된 `project_id`와 command를 받는다.
2. ProjectScopeGuard가 모든 resource ID와 비교 source의 project scope를 확인한다.
3. Lifecycle/Diff/Traceability service가 U1 typed port만 호출한다.
4. 성공 응답은 Pydantic response model로 변환한다.
5. 실패는 U2ErrorMapper가 한국어 message, code, retryable, optional current revision을 가진 ApiError로 변환한다.
6. 오류 로그는 U1 Structured Error Logger의 허용 필드만 사용한다.

## 의도적으로 없는 컴포넌트
| 구성 요소 | 결정 | 이유 |
|---|---|---|
| cache | 없음 | 단일 관리자·SLO 없음·결과 저장 요구 없음 |
| queue/worker | 없음 | diff/version 비동기 요구 없음 |
| circuit breaker | 없음 | 개인 네트워크 MVP, 자동 재시도 미사용 |
| rate limiter | 없음 | 단일 관리자 범위 |
| 외부 diff library | 없음 | 표준 `difflib`로 요구 충족 |

## EC2 CI 연결
- `ci-backend.sh`는 `backend/tests/` 전체를 uv로 실행한다.
- U2 unit/property/contract test가 추가되면 기존 `aidlc-backend-ci.timer`가 15분 주기로 실행한다.
- CI 로그는 `.ci-artifacts/`에 남고 Hypothesis 실패 shrinking/재현 출력도 동일 로그에 보존된다.
- U2 Code Generation 완료 전 새 U2 property test가 포함된 EC2 CI 성공 로그를 확인한다.

## U3/U4/U5 인계
- U3는 U2 Artifact/Draft/Version read model을 소비하고 lifecycle을 변경하지 않는다.
- U4는 명시적 reviewed preview save에서 LifecycleService의 정상 Draft 생성 계약만 사용한다.
- U5는 U2 REST API만 호출하며 pagination token, DiffResult, TraceGapResult, ApiError를 UI 상태로 변환한다.

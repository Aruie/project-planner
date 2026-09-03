# U2 비기능 요구사항

## 적용 범위
- **단위**: U2 — 문서, Draft, 버전, diff, 추적성 서비스
- **운영 전제**: 개인 네트워크/EC2의 단일 관리자 MVP, 한국어 제품 UI
- **기반**: U1 domain/repository/object-storage port, EC2 systemd 자체 CI, Hypothesis
- **제외**: U3 렌더링/내보내기, U4 Bedrock, U5 UI 구현, 백업·복구 자동화, 배포 인프라

## NFR-U2-001: 목록 확장성
- 프로젝트당 수백 건의 Artifact, VersionSnapshot, TraceLink를 지원한다.
- Artifact/Version/TraceLink 목록 REST API는 항상 pagination을 제공한다.
- 응답은 현재 page 항목과 opaque continuation token 또는 null을 포함한다.
- pagination token은 동일 Project와 리소스 종류의 다음 page만 나타내며, 다른 Project에 재사용할 수 없다.

## NFR-U2-002: diff 처리
- current Draft와 immutable VersionSnapshot의 inline/S3 본문 모두 line diff 대상이다.
- U2는 두 source 본문을 서버 메모리에서 읽어 `difflib.SequenceMatcher`로 비교한다.
- 정량 응답 시간 SLO는 현재 설정하지 않는다.
- 본문 read/diff 실패는 부분 DiffResult를 만들지 않고 안정적 구조화 오류를 반환한다.

## NFR-U2-003: VersionSnapshot 원자성과 보존
- 새 VersionSnapshot은 append가 완전히 성공한 경우에만 version history에 나타난다.
- 확정 실패는 current Draft와 기존 version history를 변경하지 않는다.
- 결과가 미확정인 저장 오류는 자동 재시도하지 않으며, 호출자는 최신 version history를 재조회한다.
- VersionSnapshot metadata, ContentRef, attachment reference, source Draft revision은 저장 후 변경할 수 없다.

## NFR-U2-004: version 번호 동시성
- version number는 Artifact 범위에서 양의 정수이며 중복될 수 없다.
- 거의 동시에 확정이 요청되어도 조건부 allocation/append로 중복 번호를 방지한다.
- 충돌한 확정 요청은 기존 snapshot을 덮어쓰지 않고 최신 version history 재조회 오류를 반환한다.
- U2는 애플리케이션 메모리 lock이나 마지막 저장 우선으로 version 번호를 보호하지 않는다.

## NFR-U2-005: 프로젝트 범위와 오류 노출
- 모든 Artifact, Draft, Version, diff, TraceLink read/write 요청은 `project_id` 범위를 검증한다.
- scope 불일치/미존재 리소스는 저장소 table, bucket, object key, stack trace, 본문을 노출하지 않는다.
- 오류 응답은 한국어 `message`, 안정적 `code`, `retryable`, 필요한 경우 `current_revision`을 포함한다.
- 빈 목록, 빈 diff change, 빈 trace gap은 오류가 아니라 빈 배열과 0 count를 가진 정상 결과다.

## NFR-U2-006: 유지보수성과 기술 선택
- 본문 diff는 Python 표준 라이브러리 `difflib.SequenceMatcher`를 사용한다.
- 외부 diff dependency, queue, cache, circuit breaker, rate limiter를 U2 MVP에 추가하지 않는다.
- U2는 U1 port를 통해서만 persistence/object storage에 접근하고 AWS SDK를 직접 사용하지 않는다.
- U2 API/DTO 모델은 U5가 안정적으로 소비할 수 있도록 explicit response schema를 제공한다.

## NFR-U2-007: PBT와 EC2 자체 CI
- U2는 PBT-02, PBT-03, PBT-07을 적용한다.
- U2 PBT-02: DiffResult와 U2 DTO 직렬화 round-trip.
- U2 PBT-03: Draft revision +1/충돌 불변성, version 순번 중복 없음, scope 일치, complete TraceLink, 빈 diff/trace 정상 결과.
- U2 PBT-07: Project/Artifact 범위, metadata, line hunk, version, complete TraceLink generator를 U1 전략 위에 추가한다.
- U1의 `ci-backend.sh`와 `aidlc-backend-ci.timer`는 `backend/tests/` 전체를 실행하므로 U2 테스트가 추가되면 동일 CI 로그에 shrinking/failure 재현 출력이 보존된다.
- U2 Code Generation 종료 전 U2 property test가 EC2 CI 성공 로그에 포함돼야 한다.

## 확장 준수 요약
| 확장 | 상태 | 판정 |
|---|---|---|
| Security Baseline | 미적용 | 사용자가 미적용 선택. 다만 project scope 검증, 민감 저장소 세부 비노출은 U2 기능/NFR로 적용한다. |
| Resiliency Baseline | 미적용 | 사용자가 미적용 선택. backup/failover/circuit breaker는 범위 밖이다. |
| Property-Based Testing | Partial 적용 | PBT-02/03/07은 U2 코드 생성에서 강제. PBT-08은 기존 EC2 CI가 U2 전체 테스트를 실행하도록 확장해 준수한다. PBT-09는 U1의 Hypothesis 고정 의존성으로 이미 충족한다. |

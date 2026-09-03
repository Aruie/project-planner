# U1 비기능 요구사항

## 범위와 적용 환경
- **단위**: U1 — 공유 도메인 및 저장소 기반
- **운영 단계**: 로컬/EC2 기반 MVP
- **사용자 규모**: 임시 자동 로그인 관리자 1명
- **접근 범위**: EC2 내부 또는 개인 네트워크 한정. 인터넷 공개와 다중 사용자 인증/권한은 후속 범위.
- **제외 범위**: 배포 인프라 자동화, VPC/IAM 상세 설계, 중앙 모니터링, 자동 백업/복구 구성

## NFR-U1-001: 프로젝트 범위와 동시성
- MVP는 관리자 1명의 일반 사용을 지원한다.
- 같은 Draft에 대한 중복/경합 요청은 `expected_revision` 기반 조건부 저장으로 처리한다.
- 충돌 시 마지막 저장 우선 또는 자동 병합을 하지 않으며, 최신 Draft 재조회가 필요하다는 오류를 반환한다.
- 다중 사용자 10명 이상, 실시간 공동 편집, 자동 병합은 MVP 범위 밖이다.

## NFR-U1-002: 성능
- MVP에는 일반 프로젝트/산출물/Draft 저장소 API의 정량 응답 시간 SLO를 설정하지 않는다.
- 성능 측정은 코드 생성과 Build and Test에서 기준선을 수집할 수 있으나, 통과/실패 기준은 현재 정하지 않는다.
- S3 대용량 전송과 Bedrock 응답 시간은 U1 성능 범위에서 제외한다.

## NFR-U1-003: 데이터 무결성과 보존
- 확정 버전 생성은 부분 VersionSnapshot을 남기지 않아야 한다.
- 저장 오류·충돌 시 기존 Draft와 기존 VersionSnapshot을 보존해야 한다.
- VersionSnapshot은 생성 뒤 변경할 수 없다.
- MVP에서는 DynamoDB 시점 복구, S3 버전 관리, 애플리케이션 백업 파일 자동 생성은 구성하지 않는다. 해당 보존/복구 자동화는 Infrastructure Design이 재도입될 때 결정한다.

## NFR-U1-004: 접근과 임시 인증
- MVP는 개인 네트워크 또는 EC2 내부에서만 접근한다.
- 임시 로그인은 사용자명 `admin`과 비밀번호 `admin1234`를 사용한다.
- 임시 자격 증명은 소스 코드에 하드코딩하지 않고 개발 환경 설정으로만 주입한다.
- 이 임시 로그인은 인터넷 공개, 다중 사용자, 프로덕션 배포에 사용할 수 없다.
- 인증/권한 모델은 후속 기능으로 대체한다.

## NFR-U1-005: 저장 경계와 첨부
- 정규화된 본문이 300 KiB 이하이면 DynamoDB 인라인 ContentRef를 사용한다.
- 300 KiB 초과 본문은 S3 ContentRef를 사용하며 DynamoDB에는 참조·크기·체크섬만 보관한다.
- 이미지는 PNG/JPEG만 허용하고 단일 파일은 5 MiB 이하로 제한한다.
- S3 쓰기/참조 실패는 기존 ContentRef 또는 Draft를 덮어쓰지 않는다.

## NFR-U1-006: 로그와 오류 추적
- 애플리케이션은 구조화된 콘솔 또는 파일 로그를 남긴다.
- 로그에는 요청 ID, 프로젝트 ID, 산출물 ID, 오류 코드, 오류 분류를 기록한다.
- 로그에 본문 전체, 이미지 바이너리, 임시 비밀번호, 인증 토큰을 기록하지 않는다.
- CloudWatch Logs, 대시보드, 경보는 현재 MVP 범위에서 제외한다.

## NFR-U1-007: 유지보수성과 테스트
- U1은 도메인, repository, object-storage port를 분리해 U2–U5가 AWS SDK 구현에 직접 의존하지 않게 한다.
- 예제 기반 테스트는 식별자 발급, 충돌, 임계값, 첨부 경계의 알려진 사례를 고정한다.
- 속성 기반 테스트는 일반 불변조건과 round-trip을 다룬다.
- U1 테스트 전략과 공통 도메인 생성기는 후속 단위에서 재사용할 수 있어야 한다.

## NFR-U1-008: 언어와 사용성 핸드오프
- 제품 UI 기본 언어는 한국어다.
- 내부 오류 코드, 개발자 로그, 라이브러리/프로토콜 식별자는 영어를 허용한다.
- 실제 UI 문구와 접근성 구현은 U5의 기능/NFR 설계에서 확정한다.

## PBT Partial 준수
| 규칙 | U1 NFR 단계 상태 | 이행 내용 |
|---|---|---|
| PBT-02 Round-trip | 이후 코드 생성 단계 적용 | ContentRef 직렬화/역직렬화, PublicDocumentId format/parse에 Hypothesis 테스트를 작성한다. |
| PBT-03 Invariant | 이후 코드 생성 단계 적용 | revision 증가, 충돌 불변성, 300 KiB 분기, 첨부 허용 범위에 Hypothesis 테스트를 작성한다. |
| PBT-07 Generator Quality | 이후 코드 생성 단계 적용 | UUID, 접두어/순번, ContentRef, revision, 첨부용 제약 생성기를 공통 테스트 유틸리티로 만든다. |
| PBT-08 Shrinking/Reproducibility | 구현 전 차단 게이트 | Hypothesis shrinking과 seed 재현을 사용한다. 사용자는 CI를 현재 제외했으므로, Code Generation/Build and Test 전에 CI seed 기록을 구성하지 않으면 PBT-08을 충족할 수 없다. |
| PBT-09 Framework Selection | 준수 | Python Hypothesis를 선택했으며, U1 Code Generation에서 고정 버전 의존성으로 등록해야 한다. |

## 확장 준수 요약
| 확장 | 상태 | 판정 |
|---|---|---|
| Security Baseline | 미적용 | 사용자가 미적용 선택. 다만 개인 네트워크 제한, 환경 변수 기반 임시 자격 증명, 민감 로그 금지는 MVP 요구사항으로 유지한다. |
| Resiliency Baseline | 미적용 | 사용자가 미적용 선택. 자동 백업/복구와 중앙 관측성은 후속 범위다. |
| Property-Based Testing | Partial 적용 | PBT-09는 설계 결정으로 준수. PBT-02/03/07/08은 이후 코드/테스트 단계에서 강제된다. PBT-08 CI는 아직 미충족인 향후 차단 게이트다. |

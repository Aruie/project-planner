# U1 NFR 설계 패턴

## 설계 결정
| 설계 영역 | 확정 패턴 | 근거 |
|---|---|---|
| 저장소 실패 | 자동 재시도 없는 명시적 오류 반환 | 단일 관리자 MVP에서 조건부 쓰기 중복·상태 불확실성을 피하고 호출자가 재시도 시점을 통제 |
| 확장성 | 캐시·메시지 큐 미도입 | 현재 부하는 단일 관리자이며 DynamoDB/S3 포트 경계가 후속 확장을 허용 |
| 성능 관측 | 오류 로그만 기록 | 정량 SLO·정상 요청 타이밍·경보를 MVP에서 요구하지 않음 |
| 인증 경계 | FastAPI 애플리케이션 경계에서 임시 관리자 검증 | U1 도메인/repository를 인증 세부 구현에서 분리 |
| 보호 컴포넌트 | 서킷 브레이커·rate limiter 미도입 | 개인 네트워크 단일 관리자 MVP에 불필요한 런타임 상태와 운영 복잡도를 추가하지 않음 |

## 실패 불변성 패턴
### Draft 저장
1. 호출자는 `project_id`, `artifact_id`, `expected_revision`, 정규화된 본문을 U1에 전달한다.
2. U1은 식별자, 프로젝트 범위, 본문, 첨부 메타데이터를 검증한다. 검증 실패는 저장소 접근 전에 종료한다.
3. U1은 본문 크기로 InlineContentRef 또는 S3ContentRef를 선택한다.
4. S3ContentRef가 필요하면 새 시도에만 귀속되는 객체 키에 본문을 쓴다. 기존 ContentRef는 이 시점에 변경하지 않는다.
5. ArtifactRepository는 `expected_revision`을 조건으로 Draft와 ContentRef를 한 번의 조건부 갱신으로 저장한다.
6. 조건부 갱신 성공 시 revision은 정확히 1 증가하고, 새 ContentRef만 현재 Draft가 참조한다.
7. revision 불일치 시 `DraftRevisionConflict`를 반환한다. 새 S3 객체가 생성되었으면 최선 노력으로 미참조 객체를 정리하고, 기존 Draft/ContentRef는 보존한다.
8. S3 쓰기 실패 또는 DynamoDB가 변경되지 않았음이 확인된 실패는 기존 Draft/ContentRef를 보존하고 구조화 오류를 반환한다.
9. DynamoDB 요청 타임아웃처럼 갱신 완료 여부를 판별할 수 없는 경우 `PersistenceOutcomeUnknown`을 반환한다. 자동 재시도를 하지 않으며 호출자는 최신 Draft를 다시 읽어 상태를 확인한다.

### 버전과 첨부
- VersionSnapshot은 생성 후 update 경로를 제공하지 않는다. 변경 시도는 `ImmutableSnapshotMutation`으로 거부한다.
- 첨부는 MIME/크기 검증을 통과한 뒤에만 S3 대상과 메타데이터를 만든다.
- 실패한 첨부 업로드는 사용 가능한 Attachment 참조를 만들지 않는다.
- 이 설계는 아티팩트 archive/물리 삭제를 추가하지 않는다. 미참조 S3 임시 객체의 최선 노력 정리는 도메인 아티팩트 삭제가 아니다.

## 오류 분류와 호출자 책임
| 오류 분류 | 예시 | U1 동작 | 호출자 동작 |
|---|---|---|---|
| 검증 오류 | InvalidIdentifier, AttachmentTooLarge | 저장 전 거부, 재시도 불가 | 입력 수정 |
| 도메인 충돌 | DraftRevisionConflict | 현재 Draft 보존, 자동 재시도 금지 | 최신 Draft 재조회 |
| 알려진 저장 실패 | ContentStorageFailure | 이전 ContentRef 보존, retryable 정보 반환 | 사용자가 명시적으로 재시도 |
| 결과 미확정 | PersistenceOutcomeUnknown | 자동 재시도 금지 | 최신 Draft/Version을 읽어 결과 확인 |
| 불변성 위반 | ImmutableSnapshotMutation | 저장 전 거부 | 새 VersionSnapshot 생성 흐름 사용 |

## 관측 패턴
- 정상 요청의 처리 시간, 성공 로그, 성능 기준선은 기록하지 않는다.
- 오류가 발생할 때만 구조화 로그를 콘솔 또는 파일에 남긴다.
- 오류 로그 필드: `request_id`, `project_id`, `artifact_id`(있는 경우), `operation`, `error_code`, `error_class`, `retryable`.
- 로그에는 본문, 이미지 바이너리, S3 객체 내용, 임시 비밀번호, 인증 토큰을 넣지 않는다.
- 중앙 수집·알림·경보와 성능 대시보드는 현재 설계에서 제외한다.

## 인증 경계 패턴
- FastAPI 애플리케이션 경계는 환경 설정에서 임시 관리자 자격 증명을 읽고 요청을 검증한다.
- 검증 성공 후에만 U2/U1 호출 흐름에 요청을 전달한다.
- U1 도메인 모델, 정책, repository port, DynamoDB/S3 adapter는 비밀번호 비교·세션 발급·권한 판정을 구현하지 않는다.
- 임시 자격 증명은 소스 코드와 로그에 기록하지 않으며, 개인 네트워크/EC2 내부 접근에만 한정한다.

## PBT Partial 이행 패턴
| 규칙 | 코드 생성 설계 |
|---|---|
| PBT-02 | ContentRef와 PublicDocumentId의 round-trip 속성을 Hypothesis 전략으로 검증한다. |
| PBT-03 | revision 조건부 갱신, 300 KiB 저장 분기, 5 MiB·MIME 첨부 검증의 불변조건을 검증한다. |
| PBT-07 | UUID, 프로젝트 접두어/순번, ContentRef, revision, 첨부 메타데이터의 제약 전략을 `backend/tests/support/strategies/`에 둔다. |
| PBT-08 | shrinking을 유지하고 재현 seed를 보존한다. CI는 현재 미구성이므로 Code Generation/Build and Test 전에 GitHub Actions 또는 EC2 CI 중 하나를 구성해야 한다. |
| PBT-09 | `hypothesis`를 정확히 고정된 버전으로 `pyproject.toml` 개발/테스트 의존성에 등록한다. |

## 제외된 패턴과 재도입 조건
| 제외 패턴 | 현재 제외 이유 | 재도입 조건 |
|---|---|---|
| 자동 재시도 | 조건부 쓰기·결과 미확정 상태에서 중복 위험 | 명시적 idempotency 설계와 다중 사용자 부하가 확정될 때 |
| 캐시 | 단일 관리자·SLO 없음 | 반복 읽기 부하 또는 정량 지연 요구가 확인될 때 |
| 메시지 큐 | 비동기 저장 요구 없음 | 비동기 작업·지속 재시도가 요구될 때 |
| 서킷 브레이커/rate limiter | 개인 네트워크 단일 관리자 | 외부 공개·다중 사용자·의존성 장애 격리가 요구될 때 |
| 중앙 관측성 | 인프라 범위 제외 | 운영/인프라 단계가 재개될 때 |

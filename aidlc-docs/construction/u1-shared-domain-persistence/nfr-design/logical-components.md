# U1 NFR 논리 컴포넌트

## 컴포넌트 목록
| 컴포넌트 | 책임 | 의존성 | NFR 기여 |
|---|---|---|---|
| FastAPI Authentication Boundary | 환경 설정의 임시 관리자 자격 증명을 검증하고 인증된 요청만 서비스 흐름에 전달 | 환경 설정, FastAPI | 인증 관심사를 U1 도메인/저장소에서 분리 |
| Identifier and Scope Policy | UUID, 프로젝트 범위, 프로젝트 내부 문서 ID 형식을 검증 | 순수 도메인 값 객체 | 잘못된 요청이 저장소나 순번을 변경하지 않게 보장 |
| Content Storage Selection Policy | 정규화 본문 크기로 InlineContentRef/S3ContentRef를 선택 | 300 KiB 상수, ObjectStoragePort | 저장 경계 일관성 유지 |
| Draft Concurrency Policy | `expected_revision` 조건과 revision +1 규칙을 적용 | ArtifactRepositoryPort | 마지막 저장 우선 방지 |
| ArtifactRepositoryPort | 프로젝트 범위 저장, public ID 할당, Draft 조건부 갱신 계약 정의 | 도메인 모델 | DynamoDB 구현 교체 가능, 조건부 쓰기 경계 고정 |
| DynamoDB Artifact Repository Adapter | port의 조건부 갱신과 저장 결과를 DynamoDB로 구현 | DynamoDB SDK | 충돌/저장 실패를 도메인 오류로 분류 |
| ObjectStoragePort | 대형 본문·이미지 객체 쓰기/읽기/미참조 임시 객체 정리 계약 정의 | 도메인 ContentRef | S3 구현 세부와 소비자 분리 |
| S3 Object Storage Adapter | S3 객체 저장·참조 확인·최선 노력 정리 구현 | S3 SDK | 기존 ContentRef 보호, 오류 분류 |
| Structured Error Logger | 오류 발생 시 최소 식별자와 오류 분류를 구조화하여 기록 | Python logging | 개인정보/본문 없이 장애 원인 추적 |
| Property Test Support | Hypothesis 전략, seed 재현, shrinking 지원 | pytest, Hypothesis | PBT Partial 필수 속성 검증 |

## 호출 경계
### 정상 Draft 업데이트
1. FastAPI 경계가 임시 관리자 요청을 인증한다.
2. 상위 서비스(U2)가 인증된 요청의 프로젝트/산출물/본문/expected revision을 U1에 전달한다.
3. Identifier and Scope Policy와 Content Storage Selection Policy가 입력과 저장 방식을 결정한다.
4. S3 대상 본문이면 ObjectStoragePort가 새 시도용 객체를 쓴다.
5. Draft Concurrency Policy가 ArtifactRepositoryPort의 조건부 갱신을 호출한다.
6. 성공 시 새 Draft와 증가한 revision을 반환한다.

### 오류 Draft 업데이트
1. 검증 오류는 어떤 저장소 port도 호출하지 않고 반환한다.
2. revision 충돌은 `DraftRevisionConflict`로 반환하며 현재 Draft를 덮어쓰지 않는다.
3. S3/DynamoDB 오류는 오류 분류와 retryable 정보를 포함해 반환한다.
4. 결과 미확정 오류는 호출자가 재조회해야 하며, U1은 자동 재시도하지 않는다.
5. 오류가 발생하면 Structured Error Logger가 안전한 식별자와 오류 코드만 기록한다.

## 구성 값과 소유자
| 구성 값 | 소유 계층 | 사용 위치 | 보관 제약 |
|---|---|---|---|
| `INLINE_CONTENT_MAX_BYTES` = 307200 | U1 도메인 설정 | Content Storage Selection Policy | 코드 상수 또는 안전한 애플리케이션 설정 |
| `ATTACHMENT_MAX_BYTES` = 5242880 | U1 도메인 설정 | 첨부 검증 | 코드 상수 또는 안전한 애플리케이션 설정 |
| 허용 MIME | U1 도메인 설정 | 첨부 검증 | `image/png`, `image/jpeg`로 제한 |
| 임시 관리자 사용자명/비밀번호 | FastAPI 애플리케이션 설정 | Authentication Boundary | 환경 변수/비밀 설정만 사용, 로그 금지 |
| DynamoDB/S3 연결 설정 | adapter 설정 | DynamoDB/S3 adapter | 환경/배포 설정, 도메인 모델에 노출 금지 |

## 의도적으로 없는 컴포넌트
| 컴포넌트 | 결정 | 이유 |
|---|---|---|
| 캐시 | 없음 | 단일 관리자 MVP, 성능 SLO 없음 |
| 메시지 큐/worker | 없음 | 비동기 저장·재시도 요구 없음 |
| 서킷 브레이커 | 없음 | 외부 공개·고부하·다중 의존성 격리 요구 없음 |
| rate limiter | 없음 | 개인 네트워크의 단일 관리자 범위 |
| 중앙 로그 수집/경보 | 없음 | 운영 인프라 범위 제외 |

## PBT와 CI 구성요소
- `backend/tests/property/u1/`은 U1 속성 테스트만 포함한다.
- `backend/tests/support/strategies/`는 공통 Hypothesis 전략을 제공한다.
- pytest/Hypothesis 실패 출력은 shrinking 결과와 재현 정보를 보존해야 한다.
- CI runner는 아직 논리 컴포넌트로 배치하지 않았다. 이는 현재 사용자의 CI 보류 결정에 따른다.
- **차단 게이트**: U1 Code Generation 종료 및 Build and Test 진입 전 GitHub Actions 또는 EC2 CI runner 중 하나를 추가하고 seed/실패 출력 보존을 검증해야 한다.

## 책임 분리 검증
- U1은 인증을 수행하지 않으며, 인증된 호출만 수신한다.
- U1 소비자는 inline/S3 분기를 직접 다루지 않고 ContentRef만 사용한다.
- 각 repository는 자신이 소유한 목적별 저장소 계약만 사용한다.
- 정상 요청은 로그 타이밍을 기록하지 않고, 오류만 안전한 구조화 로그로 남긴다.
- 캐시·큐·서킷 브레이커가 없어도 조건부 저장과 실패 불변성은 U1의 필수 계약으로 유지된다.

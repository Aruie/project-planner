# U1 기술 스택 결정

## 결정 요약
| 영역 | 선택 | 근거 |
|---|---|---|
| 백엔드 언어 | Python | FastAPI와 기존 md-publisher Python 라이브러리에 정합 |
| 웹 프레임워크 | FastAPI | REST/JSON, OpenAPI, Pydantic 계약 제공 |
| 도메인/검증 모델 | Pydantic 기반 typed model + 순수 도메인 값 객체 | UUID, ContentRef, revision, 첨부 제약을 명확히 표현 |
| 데이터 저장 | 목적별 DynamoDB 테이블 | 프로젝트, 산출물/Draft, 버전, 첨부, 추적성, AI 세션의 책임 경계 분리 |
| 대형 본문/이미지 | Amazon S3 | DynamoDB 400KB 제한 회피 및 이진 데이터 분리 |
| DynamoDB 오버플로 기준 | 300 KiB | 메타데이터와 직렬화 여유 확보 |
| 내부 식별자 | UUID | 불변 내부 참조와 프로젝트 경계 보장 |
| 사용자 문서 ID | 프로젝트 접두어 + 순번 | `CKA-001` 같은 프로젝트 종속 표시 ID |
| PBT 프레임워크 | Hypothesis | Python 전략, shrinking, seed 재현성, pytest 통합 지원 |
| 예제 기반 테스트 | pytest | 명시적 회귀/경계 시나리오를 고정 |
| 로그 | Python structured logging | 콘솔/파일에서 요청/프로젝트/산출물/오류 코드 추적 |
| 제품 UI 언어 | 한국어 | 사용자 선택 |

## Python 테스트 의존성 결정
- U1 Code Generation에서 `pytest`와 `hypothesis`를 Python 개발/테스트 의존성으로 추가한다.
- 의존성은 열린 버전 범위가 아닌 **정확히 고정된 버전**으로 `pyproject.toml`에 등록한다.
- 정확한 고정 버전은 Code Generation 시작 시 호환되는 Python/FastAPI/pytest 조합을 확인한 뒤 선택한다.
- `hypothesis`는 다음 기능을 제공해야 한다.
  - U1 도메인 객체용 사용자 정의 전략
  - 실패 입력 shrinking
  - 재현 가능한 seed 정보
  - pytest 통합

## PBT 실행 정책
### 현재 결정
- 개발자는 로컬에서 pytest/Hypothesis 테스트를 실행할 수 있다.
- CI는 현재 MVP 초기에 구성하지 않는다.
- Hypothesis shrinking은 비활성화하지 않는다.

### 필수 후속 게이트
PBT Partial의 PBT-08은 CI에서 seed 기록 또는 고정 seed 실행을 요구한다. 따라서 다음 중 하나가 Code Generation 종료 전 구성되어야 한다.

1. GitHub Actions에서 pytest/Hypothesis를 실행하고 실패 로그를 보존한다.
2. EC2의 자체 CI에서 pytest/Hypothesis를 실행하고 seed/실패 출력을 보존한다.

이 게이트가 충족되지 않으면 PBT-08은 미준수이며 Build and Test 단계에서 차단 사항이 된다.

## 저장소와 테스트 구조
| 경로 | 책임 |
|---|---|
| `backend/app/domain/` | 순수 엔터티, 값 객체, ContentRef, revision 규칙 |
| `backend/app/persistence/` | DynamoDB/S3 포트 및 repository 구현 |
| `backend/tests/unit/u1/` | 예제 기반 U1 도메인/계약 테스트 |
| `backend/tests/property/u1/` | Hypothesis 기반 round-trip, invariant, generator 테스트 |
| `backend/tests/support/strategies/` | 재사용 가능한 UUID, 문서 ID, ContentRef, revision, 첨부 전략 |

## 도입 보류 기술
| 기술 | 상태 | 사유 |
|---|---|---|
| CI 서비스 | 보류 | 사용자 결정. PBT-08 충족을 위해 Code Generation 종료 전 재검토 필요 |
| CloudWatch Logs/경보 | 보류 | 인프라/운영 범위 후속 |
| DynamoDB 시점 복구/S3 버전 관리 | 보류 | 운영 데이터 보존 자동화는 후속 인프라 단계 |
| 다중 사용자 인증/권한 | 보류 | MVP는 개인 네트워크와 임시 admin 로그인 사용 |

## 기술 결정의 PBT-09 판정
- **선택됨**: Hypothesis
- **지원 능력**: 사용자 정의 전략, shrinking, seed 재현, pytest 통합
- **의존성 등록**: U1 Code Generation에서 `pyproject.toml`에 정확한 버전으로 등록 예정
- **현재 NFR 판정**: 프레임워크 선택과 의존성 요구가 문서화되었으므로 설계 결정은 준수. 실제 의존성 등록은 코드 생성 산출물 검증 항목이다.

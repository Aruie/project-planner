# U2 Functional Design 계획

## 계획 상태
- **단위**: U2 — 문서, Draft, 버전, diff, 추적성 서비스
- **상태**: 생성된 기능 설계 산출물 승인 대기
- **입력**: U1 승인 코드의 domain type, repository/object storage port, PBT/CI 기반
- **주 담당 스토리**: US-002, US-003, US-007, US-008, US-009, US-010
- **제외 범위**: 이미지 렌더링·XLSX/DOCX(U3), Bedrock(U4), React UI(U5)

## 범주별 적용성
| 범주 | 적용성 | 설계 확인 사항 |
|---|---|---|
| Business Logic | 적용 | Draft 생성·수정·확정, 버전, diff, trace gap 흐름 |
| Domain Model | 적용 | Artifact metadata, version number, trace link 상태 |
| Business Rules | 적용 | 생성 후 유형 불변성, revision 충돌, immutable snapshot, trace 유효성 |
| Data Flow | 적용 | U1 port를 통한 ContentRef, version source, diff 입력/출력 |
| Integration | 적용 | U1 repository port 소비, U3/U4/U5 계약 인계 |
| Error Handling | 적용 | scope/ID 오류, revision conflict, version 불변성, diff/trace validation |
| Business Scenarios | 적용 | 빈 변경 확정, concurrent Draft, trace gap, deleted artifact 미지원 |
| Frontend Components | N/A | U2는 백엔드 lifecycle/API 단위이며 실제 UI 구성은 U5에서 설계 |

## U2 기능 설계 확인 질문
각 `[Answer]:` 뒤에 선택지 알파벳을 입력해주세요. `X` 선택 시 설명을 덧붙여주세요. 모든 답변을 작성한 뒤 “완료”라고 알려주세요.

## Question 1: Artifact 생성 시 유형과 기본 Draft
새 Artifact 생성 시 어떤 정책을 적용할까요?

A) MarkdownDocument 또는 ExcelDocument 유형을 생성 시 필수로 선택하고, 빈 초기 Draft(revision 1)를 함께 만든다. Artifact 유형은 이후 변경하지 않는다. (제안)

B) 초기는 MarkdownDocument만 만들고 ExcelDocument는 U3 이후에 허용한다.

C) Artifact 유형을 Draft 수정 과정에서 변경할 수 있게 한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: U2 공통 Artifact metadata
U2가 생성·수정·diff해야 하는 공통 metadata는 어디까지일까요?

A) `title`, `description`, `artifact_type`, `tags`만 U2 공통 metadata로 관리한다. 유형별 세부 필드는 U3 handler가 관리한다. (제안)

B) `title`만 U2 공통 metadata로 관리한다.

C) 요구사항/설계/테스트 등 문서 분류와 담당자·상태·우선순위도 U2에 포함한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3: immutable VersionSnapshot 번호 정책
Draft를 확정할 때 VersionSnapshot 번호를 어떤 방식으로 부여할까요?

A) Artifact별 양의 정수 순번(1, 2, 3...)을 사용한다. 확정 요청은 현재 Draft revision을 provenance로 기록하며, 내용 변경이 없어도 관리자가 명시적으로 확정하면 새 버전을 만든다. (제안)

B) semantic version(`1.0.0`, `1.1.0`)을 관리자가 지정한다.

C) Draft revision 값을 VersionSnapshot 번호로 재사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4: Draft/Version diff 결과 형식
U2의 diff API는 어떤 결과를 기본으로 반환할까요?

A) 공통 metadata field별 before/after와 본문 line 기반 added/removed/unchanged hunk를 구조화 JSON으로 반환한다. (제안)

B) unified diff 텍스트만 반환한다.

C) 변경 여부와 요약 수치만 반환한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5: TraceLink 유효성 및 gap 기준
사용자 스토리·요구사항·테스트케이스 추적성에서 어떤 규칙을 적용할까요?

A) 각 TraceLink는 story ID, requirement ID, test case ID를 모두 필수로 한다. gap은 세 ID 중 하나라도 어떤 link에도 연결되지 않은 경우로 계산한다. (제안)

B) story→requirement, requirement→test case의 두 단계 link를 별도 레코드로 허용한다.

C) test case 없이 story→requirement link만 허용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6: U2 오류 API 계약
U2 서비스가 scope/validation/conflict 오류를 API 계층에 전달하는 기본 형식은 무엇일까요?

A) 안정적인 `code`, 한국어 사용자 메시지, 재시도 가능 여부, 필요한 경우 `current_revision`을 가진 구조화 오류를 반환한다. (제안)

B) HTTP 상태 코드와 영어 메시지만 반환한다.

C) 오류마다 서로 다른 비정형 JSON을 반환한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
### 분석과 확인
- [x] U2 스토리, U1 계약, 단위 의존성을 분석했다.
- [x] Business Logic, Domain Model, Business Rules, Data Flow, Integration, Error Handling, Business Scenarios, Frontend 적용성을 평가했다.
- [x] U2는 UI 구현 단위가 아니므로 Frontend Components는 U5로 핸드오프함을 명시했다.
- [x] U2 기능 설계 답변을 검증하고 모호성을 해소한다.

### 설계 산출물
- [x] `construction/u2-document-version-trace/functional-design/business-logic-model.md`를 생성한다.
- [x] `construction/u2-document-version-trace/functional-design/business-rules.md`를 생성한다.
- [x] `construction/u2-document-version-trace/functional-design/domain-entities.md`를 생성한다.
- [x] `construction/u2-document-version-trace/functional-design/frontend-components.md`에 U5 핸드오프/N/A를 기록한다.
- [x] U2 PBT-02/03/07 및 U1 계약 일관성을 검증하고 승인을 요청한다.

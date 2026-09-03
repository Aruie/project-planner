# Unit of Work Plan

## Plan Status
- **Status**: Approved
- **Source Design**: `aidlc-docs/inception/application-design/`
- **Goal**: Create independent implementation units with explicit dependencies and story ownership. These are logical modules for a single product, not independently deployed microservices.

## Candidate Decomposition
The approved application design suggests five candidate units:
1. Shared domain and persistence foundation.
2. Document, Draft, version, diff, and traceability application services.
3. Markdown, Excel, DOCX, attachment, and export rendering.
4. Project-scoped Bedrock AI workspace.
5. React feature modules and API integration.

These candidates are not final until the questions below are answered and this plan is approved.

## Decomposition Questions
Enter an option letter after every `[Answer]:`. If `X` is chosen, add a description after the tag. Notify the AI when every answer is complete.

### Question 1: 스토리 그룹화와 단위 수
MVP를 어떤 크기의 작업 단위로 나눌까요?

A) 제안한 5개 단위 — 기반 모델/저장소, 문서·버전·추적성, 렌더링·출력, AI 작업공간, React UI로 나눈다. 각 단위는 별도 구현·테스트 계획을 갖는다. (제안)

B) 2개 단위 — FastAPI 백엔드 전체와 React 프론트엔드 전체로 나눈다.

C) 1개 단위 — 단일 풀스택 모놀리스로 모두 함께 구현한다.

D) 6개 이상 세부 단위 — 문서/버전, 추적성, 렌더링, AI, UI 등을 더 작게 분리한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: 단위 간 구현 의존성
어떤 순서와 병렬화 전략을 사용할까요?

A) 기반 단위를 먼저 완료한 뒤 문서·버전과 렌더링을 병렬 진행하고, AI는 문서 단위 뒤에, React UI는 API 계약이 안정된 뒤 통합한다. (제안)

B) 백엔드 단위를 모두 순차 완료한 뒤 React UI를 구현한다.

C) React UI를 mock API로 먼저 만들고 백엔드 단위를 나중에 연결한다.

D) 모든 단위를 동시에 시작하고 발견되는 의존성은 구현 중 조정한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: 팀 정렬과 소유권
MVP 구현에 적용할 팀/작업 방식은 무엇인가요?

A) 한 명 또는 한 팀이 순차적으로 소유한다. 단위는 구현 순서와 테스트 경계를 위한 논리적 구분이다. (제안)

B) 백엔드·렌더링·프론트엔드 담당자가 병렬로 작업하며 API 계약과 공유 모델을 조정한다.

C) AI 작업공간은 별도 담당자가 소유하고 나머지는 다른 팀이 구현한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: 그린필드 코드 조직과 배포 모델
소스 코드와 배포 단위를 어떻게 구성할까요?

A) 하나의 모노레포 — `frontend/`에 React, `backend/`에 FastAPI를 두고, 백엔드는 기능/도메인 모듈로 나눈다. MVP는 하나의 웹 애플리케이션으로 실행한다. (제안)

B) 프론트엔드와 백엔드를 별도 저장소로 분리한다.

C) 각 작업 단위를 별도 배포 서비스와 별도 저장소로 분리한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5: AI 작업공간의 작업 단위 경계
Bedrock AI 작업공간을 어떻게 묶을까요?

A) 별도 단위로 둔다 — TTL 세션, 대화/미리보기, Bedrock 어댑터, 검토 후 Draft 저장을 하나의 AI 워크스페이스 단위로 구현한다. (제안)

B) 문서·버전 단위에 포함한다 — Artifact/Version Service와 함께 구현한다.

C) React UI 단위에 포함한다 — UI 구현과 함께 API를 만든다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6: 문서 출력의 작업 단위 경계
Markdown/Excel/DOCX/이미지 출력 기능을 어떻게 묶을까요?

A) 별도 렌더링·출력 단위로 둔다 — handler, renderer registry, openpyxl, 내장 md-publisher, S3 attachment resolution을 함께 구현한다. (제안)

B) 문서·버전 단위에 포함한다 — Artifact Service 구현과 함께 렌더링도 만든다.

C) React UI 단위에 포함한다 — UI에서 출력 형식과 파일 생성을 모두 담당한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Clarification Required

Question 2 selected a dependency plan with parallel backend work, while Question 3 selected one person or one team owning work sequentially. Choose the actual execution rule below before unit artifacts are generated.

### Clarification Question 1: 단일 팀의 실제 구현 순서
한 명 또는 한 팀이 구현할 때 문서·버전 단위와 렌더링·출력 단위를 어떻게 진행할까요?

A) 완전 순차 — U1 기반 → U2 문서·버전·추적성 → U3 렌더링·출력 → U4 AI 작업공간 → U5 React UI 순서로 진행한다. (제안)

B) 한 팀이 U2와 U3을 번갈아 진행해 일부 병렬처럼 추진한다. API/모델 계약은 U1 완료 뒤 먼저 고정한다.

C) 팀은 하나지만 동시에 작업 가능한 인력이 있어 U2와 U3을 실제로 병렬 구현한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Agreed Decomposition Decisions
| Area | Decision |
|---|---|
| Unit count | Five logical units: U1 foundation, U2 document/version/traceability, U3 rendering/export, U4 AI workspace, U5 React UI. |
| Implementation sequence | One person or one team implements fully sequentially: U1 → U2 → U3 → U4 → U5. The earlier parallel option is not used. |
| Ownership | One team owns all units; units are logical implementation and test boundaries. |
| Code organization | One monorepo with `frontend/` for React and `backend/` for FastAPI; backend is divided by domain/feature modules. |
| Deployment | One MVP web application, not separately deployed microservices. |
| AI boundary | U4 contains TTL session, conversation/preview, Bedrock adapter, and explicit reviewed Draft save. |
| Output boundary | U3 contains artifact handlers, renderer registry, openpyxl, embedded md-publisher, and S3 attachment resolution. |

## Execution Checklist
### Part 1 — Planning
- [x] Load approved requirements, stories, execution plan, and application design.
- [x] Identify candidate units and their probable dependencies.
- [x] Create questions for story grouping, dependencies, team alignment, code organization, AI boundary, and rendering boundary.
- [x] Validate all decomposition answers and resolve ambiguity.
- [x] Request explicit approval of this unit-of-work plan.
- [x] Record explicit approval response for this unit-of-work plan.

### Part 2 — Generation
- [x] Read this approved plan and locate the first unfinished generation step.
- [x] Generate `application-design/unit-of-work.md` with unit definitions, responsibilities, code organization, and ownership.
- [x] Generate `application-design/unit-of-work-dependency.md` with dependency matrix and communication constraints.
- [x] Generate `application-design/unit-of-work-story-map.md` mapping every user story to one primary unit.
- [x] Validate unit boundaries, dependencies, and complete story assignment.
- [x] Mark generation steps complete and update AIDLC state.
- [x] Request explicit approval of generated unit artifacts.

## Mandatory Unit Artifacts
- `aidlc-docs/inception/application-design/unit-of-work.md`
- `aidlc-docs/inception/application-design/unit-of-work-dependency.md`
- `aidlc-docs/inception/application-design/unit-of-work-story-map.md`

## Constraints
- Unit boundaries are implementation modules, not microservice boundaries. Deployment remains one MVP web application.
- Exact business rules remain deferred to per-unit Functional Design.
- Infrastructure Design is skipped for this MVP.
- PBT Partial requirements apply later to relevant functional/NFR/code stages, not to this decomposition plan.

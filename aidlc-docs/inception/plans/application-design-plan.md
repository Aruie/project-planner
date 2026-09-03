# Application Design Plan

## Plan Status
- **Status**: Generated artifacts awaiting explicit approval
- **Scope**: React frontend, FastAPI backend, DynamoDB/S3 persistence, document generation, Bedrock AI workspace
- **Source Artifacts**: Approved requirements, user stories, personas, and execution plan

## Candidate Design Direction
The design will use a project-scoped web application with React feature modules, FastAPI route adapters and application services, domain interfaces for artifacts and versioning, DynamoDB repositories, S3 attachment storage, document renderer adapters, and a project-scoped Bedrock AI workspace. The final component boundaries and storage contracts depend on the answers below.

## Design Questions
Please enter one option letter after every `[Answer]:`. If `X` is chosen, add your explanation after the tag. When you finish all answers, notify the AI.

### Question 1: 프론트엔드 컴포넌트 조직 방식
React UI를 어떤 단위로 나눌까요?

A) 기능별 모듈 구조 — 프로젝트, 산출물 편집, 버전/diff, 추적성, AI 작업공간을 각각의 feature 모듈로 나눈다. 공통 UI와 API 클라이언트는 shared에 둔다. (제안)

B) 기술 계층 구조 — pages, components, hooks, services 등 기술 종류별 폴더로 나눈다.

C) 단일 화면 중심 구조 — MVP의 모든 화면과 상태를 하나의 큰 앱 모듈로 구현한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: FastAPI 외부 API 스타일
React과 FastAPI 사이의 공개 API 계약을 어떤 방식으로 설계할까요?

A) REST/JSON API + OpenAPI — 자원 중심 URL, HTTP 상태 코드, Pydantic 요청/응답 모델을 사용한다. (제안)

B) GraphQL API — 하나의 GraphQL 엔드포인트와 스키마를 사용한다.

C) RPC 스타일 API — 기능 이름 중심 엔드포인트를 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: DynamoDB 데이터 모델 경계
MVP의 주요 영속 모델을 어떤 방식으로 구성할까요?

A) 단일 테이블 — 프로젝트, 문서, Draft, 버전, 첨부 메타데이터, 추적 링크를 하나의 테이블에서 PK/SK 패턴으로 관리한다. 프로젝트별 조회와 트랜잭션에 유리하지만 설계 복잡도가 높다.

B) 목적별 테이블 — 프로젝트/문서, 버전, 추적성 등 주요 모델을 별도 테이블로 나눈다. MVP에서 모델과 쿼리를 이해하기 쉽다. (제안)

C) 혼합 — 프로젝트·문서·Draft만 단일 테이블, 버전·추적성은 별도 테이블로 둔다.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 4: AI 작업공간 대화 상태
문서/버전으로 정식 저장되기 전의 프로젝트 내부 Bedrock 대화와 미리보기 상태를 어떻게 유지할까요?

A) DynamoDB TTL 기반 임시 세션 — 프로젝트별 대화와 미리보기를 만료 가능한 임시 레코드로 저장한다. 정식 문서/버전은 아니며, 서버 재시작 뒤에도 대화를 이어갈 수 있다. (제안)

B) 브라우저 메모리만 사용 — 새로고침/브라우저 종료 시 대화와 미리보기가 사라진다. 서버에는 저장하지 않는다.

C) 즉시 Draft 저장 — 각 AI 응답을 문서의 일반 Draft에 자동 반영한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5: 대형 문서 본문 저장 정책
DynamoDB 400KB 아이템 제한을 넘을 수 있는 Markdown 또는 구조화된 Excel 본문은 어떻게 처리할까요?

A) 임계값까지 DynamoDB 본문 저장, 초과 시 S3에 원본 저장하고 DynamoDB에는 S3 참조와 메타데이터만 저장한다. (제안)

B) 모든 문서 본문을 S3에 저장하고 DynamoDB에는 색인·상태·버전 메타데이터만 저장한다.

C) DynamoDB 400KB 이내의 문서만 지원하고, 초과 입력은 오류로 거부한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6: 산출물 서비스 경계
MarkdownDocument와 ExcelDocument를 어떤 서비스 구조로 처리할까요?

A) 공통 Artifact Service + 유형별 전략/어댑터 — 공통 메타데이터, Draft, 버전, diff는 하나의 공통 서비스가 담당하고 Markdown/Excel/DOCX 렌더링은 유형별 어댑터가 담당한다. (제안)

B) Markdown, Excel, DOCX를 각각 독립적인 서비스로 구현하고 공통 흐름은 각 서비스에서 반복한다.

C) 하나의 거대한 Document Service에서 저장·버전·diff·렌더링·AI 생성까지 모두 처리한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Execution Checklist
### Planning
- [x] Load approved requirements, stories, personas, and execution plan.
- [x] Identify candidate presentation, application, domain, persistence, rendering, and AI components.
- [x] Create context-specific questions for component boundaries, API contracts, storage, and AI state.
- [x] Validate every design-question answer and create follow-up questions for any ambiguity.

### Design Artifact Generation
- [x] Generate `application-design/components.md` with component definitions, responsibilities, and interfaces.
- [x] Generate `application-design/component-methods.md` with high-level method signatures and input/output types.
- [x] Generate `application-design/services.md` with orchestration responsibilities and service interactions.
- [x] Generate `application-design/component-dependency.md` with dependency matrix, communication patterns, and validated data-flow visualization.
- [x] Generate `application-design/application-design.md` consolidating the design and traceability.
- [x] Validate completeness, requirement/story coverage, Mermaid syntax, and extension compliance.
- [x] Request explicit approval of the generated application design.

## Design Constraints
- Detailed business rules, data schemas, and state-transition algorithms are deferred to Functional Design.
- Infrastructure-as-code and deployment topology are deferred; Infrastructure Design is skipped for this MVP.
- Security and Resiliency extensions are disabled.
- Property-Based Testing is Partial; PBT-02, PBT-03, PBT-07, PBT-08, and PBT-09 will be enforced in applicable later design/code stages.

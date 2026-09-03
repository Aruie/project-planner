# U1 Functional Design Plan

## Plan Status
- **Unit**: U1 — Shared Domain and Persistence Foundation
- **Status**: Approved
- **Scope**: Technology-agnostic domain entities, repository/storage contracts, identity, Draft/snapshot primitives, and validation boundaries.
- **Out of Scope**: REST routes, React components, renderer details, Bedrock prompt logic, and U2 lifecycle orchestration.

## Context Assessment
- **Primary story**: US-001 project context.
- **Supporting responsibilities**: common contracts for all artifacts, Drafts, versions, attachments, trace links, AI sessions, DynamoDB/S3 ports, revision primitives.
- **Integration points**: U2/U3/U4/U5 consume U1 typed contracts. U1 does not own their business workflows.
- **Frontend components**: N/A — U1 exposes no React UI. UI hierarchy and interaction rules belong to U5.
- **External system business integration**: N/A — U1 defines abstract object-storage and persistence ports only. Concrete AWS adapter behavior belongs to NFR/Code Generation.

## Functional Design Questions
Enter a letter after every `[Answer]:`. If `X` is selected, describe the preference after the tag. Notify the AI once all answers are complete.

### Question 1: 내부 ID와 사용자 표시 문서 ID
프로젝트와 산출물의 ID를 어떻게 구분할까요?

A) 내부 참조는 불변 UUID를 사용하고, 사용자에게 보이는 문서 ID는 시스템이 프로젝트 안에서 고유하게 자동 생성한다. (제안)

B) 내부 참조와 사용자 표시 문서 ID를 모두 사용자가 직접 입력한다.

C) 내부 참조와 사용자 표시 문서 ID를 모두 같은 UUID로 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A 프로젝트 생성시 앞에 붙을 접두어? 설정하게하면 좋겟어 예를들면 CKA 라고하면 CKA-001 a머 이런식으로번호가붙겟지? 
접두어는 고유하진않아도 상관없어 어짜피 르프로젝트 종속이니 
내부참조는 그냥 불변 UUID 쓰자

### Question 2: 산출물 삭제/보존 정책
MVP에서 생성한 산출물을 사용자가 더 이상 쓰지 않을 때 어떻게 처리할까요?

A) 물리 삭제는 지원하지 않고 활성 상태만 유지한다. 필요하면 후속 버전에서 archive를 추가한다. (제안)

B) archive 상태로 전환해 기본 목록에서 숨기되, 버전과 첨부는 보존한다.

C) 즉시 물리 삭제하며 Draft, 버전, 첨부, 추적 링크도 함께 제거한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: 동시에 수정된 Draft 충돌 처리
같은 Draft의 서로 다른 revision이 저장될 때 어떤 정책을 적용할까요?

A) expected revision이 다르면 저장을 거부하고 최신 Draft를 다시 읽도록 한다. 마지막 저장이 기존 변경을 덮어쓰지 않는다. (제안)

B) 마지막 저장을 항상 허용해 이전 변경을 덮어쓴다.

C) 서버가 자동 병합을 시도하고 병합 불가 부분만 사용자에게 보여준다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: DynamoDB 인라인 본문 임계값
본문을 DynamoDB에 직접 저장하다 S3 참조로 넘기는 임계값은 무엇으로 할까요?

A) 300 KiB — DynamoDB 400KB 제한보다 충분한 메타데이터·직렬화 여유를 남긴다. (제안)

B) 350 KiB — 더 큰 본문을 인라인으로 허용한다.

C) 모든 본문을 처음부터 S3에 저장한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5: 이미지 첨부 허용 범위
MVP에서 허용할 이미지 유형과 단일 파일 크기는 무엇인가요?

A) PNG, JPEG, GIF, WebP를 허용하고 단일 파일은 10 MiB 이하로 제한한다. (제안)

B) PNG와 JPEG만 허용하고 단일 파일은 5 MiB 이하로 제한한다.

C) MIME 유형과 파일 크기를 제한하지 않는다.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Execution Checklist
### Planning
- [x] Load U1 scope, dependency rules, requirements, story mapping, and application design.
- [x] Identify domain model, business-rule, data-flow, error-handling, integration, and UI applicability.
- [x] Create context-specific questions for identifiers, artifact lifecycle, concurrency, overflow, and attachments.
- [x] Validate all answers and resolve ambiguity.

### Functional Design Artifact Generation
- [x] Generate `construction/u1-shared-domain-persistence/functional-design/business-logic-model.md`.
- [x] Generate `construction/u1-shared-domain-persistence/functional-design/business-rules.md`.
- [x] Generate `construction/u1-shared-domain-persistence/functional-design/domain-entities.md`.
- [x] Record `frontend-components.md` as N/A with rationale.
- [x] Identify PBT-02, PBT-03, PBT-07, PBT-08 applicability and handoff to NFR/Code Generation.
- [x] Validate functional-design consistency and request explicit approval.

## PBT Scope
PBT Partial is enabled. PBT-01 is advisory in Partial mode. The detailed design must nevertheless identify data round trips and invariants so PBT-02, PBT-03, PBT-07, and PBT-08 can be enforced in later stages. PBT-09 framework selection is handled in U1 NFR Requirements.

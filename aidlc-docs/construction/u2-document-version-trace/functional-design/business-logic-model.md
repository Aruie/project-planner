# U2 비즈니스 로직 모델

## 범위
U2는 프로젝트 범위 안에서 Artifact 생성, 현재 Draft 수정, immutable VersionSnapshot 확정, Draft/Version diff, TraceLink 및 gap 계산을 오케스트레이션한다. U1의 typed entity/repository/object-storage port를 소비하며 DynamoDB/S3 SDK를 직접 사용하지 않는다.

## 공통 흐름
### Artifact 생성과 초기 Draft
1. 요청은 `project_id`, 필수 `artifact_type`(MarkdownDocument 또는 ExcelDocument), 공통 metadata를 포함한다.
2. U2는 ProjectRepository로 프로젝트를 확인하고 U1의 원자 public document ID 할당을 요청한다.
3. U2는 새 ArtifactId/DraftId를 만들고, Artifact 유형은 생성 시점에 고정한다.
4. 빈 본문과 revision 1의 Draft를 만들고, U1 ContentRef 정책으로 inline/S3 저장 형태를 선택한다.
5. ArtifactRepository는 Artifact와 단 하나의 current Draft를 함께 저장한다.
6. 반환값에는 UUID 내부 ID, 프로젝트 내부 public document ID, metadata, Draft revision 1을 포함한다.

### 현재 Draft 조회와 수정
1. U2는 `project_id`와 `artifact_id`로 Artifact 및 current Draft를 읽는다.
2. 수정 요청은 `expected_revision`, metadata 변경, 본문 변경을 포함한다.
3. U2는 유형 변경을 거부하고, metadata와 본문을 정규화한다.
4. 본문은 U1 300 KiB ContentRef 정책을 통해 저장한다. 새 S3 객체가 필요하면 U1 object storage port를 사용한다.
5. U2는 ArtifactRepository의 조건부 Draft 교체를 호출한다.
6. 성공 시 revision은 정확히 하나 증가한다. 충돌 시 현재 Draft는 보존되고 구조화 오류에 `current_revision`을 담아 반환한다.

### VersionSnapshot 확정
1. 관리자가 현재 Draft 확정을 명시적으로 요청한다.
2. U2는 current Draft를 읽고 Artifact별 다음 양의 정수 version number를 계산한다.
3. Draft의 metadata, ContentRef, attachment reference, source Draft revision을 복사해 VersionSnapshot을 만든다.
4. VersionRepository는 append-only로 저장한다. 저장된 snapshot은 수정·삭제하지 않는다.
5. 내용 변경이 없어도 별도 명시 확정 요청이면 새 VersionSnapshot을 만든다.
6. Draft는 확정 후에도 current Draft로 남으며 revision을 변경하지 않는다.

### Draft/Version diff
1. U2는 비교 기준 두 개를 읽는다. 각 기준은 current Draft 또는 immutable VersionSnapshot이다.
2. 공통 metadata의 `title`, `description`, `artifact_type`, `tags`를 field별 before/after로 비교한다.
3. 본문은 줄 단위 sequence comparison으로 added/removed/unchanged hunk를 생성한다.
4. 응답은 구조화 JSON이며 source identity, metadata changes, body hunks, 요약 수치를 포함한다.
5. 비교 기준은 같은 Artifact와 같은 Project 범위에 있어야 한다. 서로 다른 Artifact/Project 비교는 거부한다.

### TraceLink와 gap 계산
1. TraceLink 생성/수정 요청은 story ID, requirement ID, test case ID를 모두 가져야 한다.
2. 세 ID를 모두 가진 하나의 link만 유효하다. 부분 chain link는 만들지 않는다.
3. U2는 프로젝트 안의 link를 읽고 story/requirement/test-case ID별 연결 집합을 만든다.
4. 입력된 기준 ID 목록 중 어떤 유효 link에도 나타나지 않는 ID를 gap으로 반환한다.
5. TraceLink 상태 변경은 link의 세 ID와 프로젝트 범위를 보존한다.

## 오류 흐름
| 상황 | U2 처리 | 구조화 오류 |
|---|---|---|
| 알 수 없는 Project/Artifact/Version | 읽기·저장 전 중단 | `PROJECT_NOT_FOUND` 또는 `ARTIFACT_NOT_FOUND` |
| Artifact 유형 변경 | Draft 저장 전 거부 | `ARTIFACT_TYPE_IMMUTABLE` |
| revision mismatch | U1 conflict을 전달, 저장하지 않음 | `DRAFT_REVISION_CONFLICT`, `current_revision` |
| snapshot 수정/중복 | append-only 계약 위반 거부 | `IMMUTABLE_SNAPSHOT_MUTATION` |
| 다른 Artifact/Project diff | 비교 전 거부 | `DIFF_SOURCE_SCOPE_MISMATCH` |
| TraceLink ID 누락 | link 저장 전 거부 | `TRACE_LINK_FIELDS_REQUIRED` |

## U1 및 후속 단위 경계
- U1: UUID, ContentRef, DraftRevision, entities, storage port, 조건부 저장/불변 snapshot 기반.
- U2: lifecycle orchestration, metadata, version numbering, diff, trace gap policy.
- U3: Artifact 유형별 renderer/export와 attachment 소비. U2는 유형별 렌더링을 수행하지 않는다.
- U4: reviewed AI preview를 U2의 정상 Artifact/Draft 생성 흐름에 명시적으로 전달한다.
- U5: U2 REST API를 호출하고 한국어 UI 상태/문구를 구현한다.

## PBT 핸드오프
| 규칙 | U2 대상 속성 |
|---|---|
| PBT-02 | DiffResult 및 U2 DTO의 직렬화/역직렬화가 identity를 보존한다. |
| PBT-03 | 성공 Draft update는 revision +1, 충돌은 Draft 불변, snapshot은 변경 불가, version number는 artifact별 양수 순증가다. |
| PBT-07 | 프로젝트 범위 Artifact, Draft revision, metadata, line hunk, 완전 TraceLink의 제약 전략을 U1 전략 위에 확장한다. |

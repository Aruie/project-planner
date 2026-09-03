# U2 도메인 엔터티

## U1 타입 사용
U2는 U1의 `ProjectId`, `ArtifactId`, `DraftId`, `VersionId`, `TraceLinkId`, `PublicDocumentId`, `DraftRevision`, `ContentRef`, `Artifact`, `Draft`, `VersionSnapshot`, `TraceLink`를 재정의하지 않는다.

## U2 값 객체와 명령
| 타입 | 필드 | 책임 |
|---|---|---|
| ArtifactType | MarkdownDocument 또는 ExcelDocument | 생성 시 필수·immutable 유형 |
| ArtifactMetadata | title, description, artifact_type, tags | U2 공통 metadata 정규화/검증 |
| CreateArtifactCommand | project_id, metadata, initial content | Artifact와 빈 initial Draft 생성 입력 |
| UpdateDraftCommand | project_id, artifact_id, expected_revision, metadata patch, content | 조건부 current Draft 교체 입력 |
| ConfirmVersionCommand | project_id, artifact_id | 현재 Draft 명시 확정 입력 |
| DiffSource | project_id, artifact_id, source kind, draft/version ID | current Draft 또는 VersionSnapshot 비교 기준 |
| DiffRequest | left source, right source | 동일 Artifact/Project 비교 입력 |
| TraceLinkCommand | project_id, story_id, requirement_id, test_case_id, status | 완전 trace relationship 입력 |

## 조회/응답 모델
| 타입 | 주요 필드 | 불변성 |
|---|---|---|
| ArtifactDetail | Artifact, ArtifactMetadata, current Draft summary | 조회 snapshot |
| VersionSummary | version_id, version_number, source_draft_revision, created_at | append 후 immutable |
| MetadataChange | field, before, after | diff 실행 결과 |
| LineHunk | kind(added/removed/unchanged), before lines, after lines | diff 실행 결과 |
| DiffResult | left source, right source, metadata changes, line hunks, counts | deterministic 비교 결과 |
| TraceGapResult | unlinked story IDs, requirement IDs, test case IDs | 기준 목록과 TraceLink 집합의 비교 결과 |
| ApiError | code, Korean message, retryable, current_revision optional | API 계층 오류 전달 |

## 관계
- Project 1 : N Artifact
- Artifact 1 : 1 current Draft
- Artifact 1 : N immutable VersionSnapshot
- Artifact 1 : N DiffSource(candidate: current Draft + versions)
- Project 1 : N TraceLink
- TraceLink 1 : 1 story ID + 1 requirement ID + 1 test case ID

## version number 계산
1. U2는 Artifact의 VersionSnapshot 목록에서 가장 큰 version number를 읽는다.
2. 목록이 비어 있으면 next version number는 1이다.
3. 목록이 있으면 max + 1이다.
4. 저장 시 VersionRepository append 조건을 사용해 같은 version ID의 변경을 막는다.
5. concurrent confirmation의 version number 충돌 처리는 U2 Code Generation에서 repository 조건/재조회 계약 테스트로 고정한다.

## DiffResult 직렬화 예시
```json
{
  "metadata_changes": [{"field": "title", "before": "초안", "after": "확정안"}],
  "body_hunks": [{"kind": "removed", "before": ["old line"], "after": []}],
  "summary": {"added": 1, "removed": 1, "unchanged": 4}
}
```

## U5 핸드오프
U5는 ArtifactDetail, VersionSummary, DiffResult, TraceGapResult, ApiError를 REST/OpenAPI 모델로 소비한다. U5는 U2 도메인 객체나 U1 repository를 직접 참조하지 않는다.

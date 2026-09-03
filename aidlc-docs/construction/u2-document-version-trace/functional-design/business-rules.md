# U2 비즈니스 규칙

| ID | 규칙 |
|---|---|
| U2-BR-001 | Artifact 생성은 MarkdownDocument 또는 ExcelDocument 유형을 필수로 받고 빈 current Draft(revision 1)를 함께 만든다. |
| U2-BR-002 | Artifact 유형은 생성 후 변경할 수 없다. 유형별 세부 schema/renderer는 U3가 소유한다. |
| U2-BR-003 | U2 공통 metadata는 `title`, `description`, `artifact_type`, `tags`다. `artifact_type`은 immutable이며 tags는 중복 없는 정규화 문자열 집합이다. |
| U2-BR-004 | public document ID는 U1 ProjectRepository가 프로젝트 범위에서 원자적으로 할당한다. U2는 이미 할당된 ID를 변경하지 않는다. |
| U2-BR-005 | 각 Artifact에는 정확히 하나의 current Draft가 있다. U2는 archive 또는 physical delete를 제공하지 않는다. |
| U2-BR-006 | Draft 수정은 반드시 양의 `expected_revision`을 포함한다. 성공 저장은 revision을 정확히 하나 증가시킨다. |
| U2-BR-007 | revision 불일치 시 마지막 저장 우선·자동 병합을 하지 않으며 최신 Draft 재조회를 요구한다. |
| U2-BR-008 | U2는 본문 저장 시 U1 ContentRef만 사용한다. 300 KiB 이하 inline, 초과 S3 분기는 U1 정책이다. |
| U2-BR-009 | VersionSnapshot version number는 Artifact별 1부터 시작하는 양의 정수 순번이다. |
| U2-BR-010 | VersionSnapshot은 확정 시점 Draft의 metadata, ContentRef, attachment reference, source Draft revision을 불변 값으로 보존한다. |
| U2-BR-011 | 명시적 확정 요청은 Draft 내용이 이전 snapshot과 같아도 새 VersionSnapshot을 만들 수 있다. |
| U2-BR-012 | 확정은 current Draft를 수정하지 않는다. Draft와 VersionSnapshot은 별개다. |
| U2-BR-013 | diff 비교 기준은 동일 Project의 동일 Artifact에 속한 Draft 또는 VersionSnapshot이어야 한다. |
| U2-BR-014 | diff는 공통 metadata field별 before/after 및 본문 line hunk를 구조화 JSON으로 반환한다. |
| U2-BR-015 | TraceLink는 story ID, requirement ID, test case ID를 모두 필수로 가진다. 부분 관계 레코드는 허용하지 않는다. |
| U2-BR-016 | trace gap은 제공된 기준 ID 목록에서 유효한 TraceLink에 한 번도 연결되지 않은 story/requirement/test-case ID다. |
| U2-BR-017 | U2 오류 응답은 안정적인 `code`, 한국어 `message`, `retryable`, 선택적 `current_revision`을 가진다. |
| U2-BR-018 | 저장소/객체 저장 오류는 U1 error를 노출하되 AWS SDK 세부 사항이나 본문·자격 증명을 API 응답/로그에 포함하지 않는다. |

## Metadata 검증
- `title`: trim 후 비어 있지 않아야 한다.
- `description`: 선택값이며 trim/정규화한다.
- `tags`: 공백만인 값은 제거하고, 대소문자 정규화 정책은 U2 Code Generation에서 명시 테스트로 고정한다.
- `artifact_type`: `MarkdownDocument` 또는 `ExcelDocument`만 허용한다.

## API 오류 형태
```json
{
  "code": "DRAFT_REVISION_CONFLICT",
  "message": "최신 Draft를 다시 조회한 뒤 수정해주세요.",
  "retryable": false,
  "current_revision": 4
}
```

이 JSON은 API contract 예시이며, 실제 FastAPI response model은 U2 Code Generation에서 구현한다.

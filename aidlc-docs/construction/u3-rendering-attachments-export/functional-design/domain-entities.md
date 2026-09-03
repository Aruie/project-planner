# U3 도메인 엔터티

## U1/U2 재사용 타입
U3는 `ProjectId`, `ArtifactId`, `AttachmentId`, `VersionId`, `Artifact`, `Draft`, `VersionSnapshot`, `Attachment`, `ContentRef`, `AttachmentObjectRef`, `VersionSummary`, `TraceGapResult`를 재정의하지 않는다.

## U3 값 객체와 조회 모델
| 타입 | 주요 필드 | 책임 |
|---|---|---|
| RenderSource | project_id, artifact_id, kind, draft/version identity | U2 read source 지정 |
| RenderModel | cover, change_history, body_blocks, attachment_refs | preview/export의 공통 normalized 입력 |
| CoverModel | project name, public document ID, title, description, artifact type | Markdown/Excel/DOCX 표지 |
| ChangeHistoryEntry | version number, source draft revision, confirmed_at | U2 immutable version history 표시 |
| BodyBlock | kind(paragraph/table/image/code), content/rows | normalized Markdown 본문 |
| ResolvedAttachment | attachment ID, media type, checksum, bytes | preview/export-safe image 입력 |
| ExportRequest | source, output kind, template kind optional | XLSX/DOCX 생성 명령 |
| ExportResult | filename, content type, bytes, source identity | 다운로드 응답 |
| TemplateDefinition | template kind, cover/change sheet names, body columns | fixed XLSX registry 항목 |

## Template registry
| Template kind | Body sheet | Required columns |
|---|---|---|
| RequirementsDefinition | Requirements | requirement_id, title, description, priority, source |
| TraceMatrix | Traceability | story_id, requirement_id, test_case_id, status, gap |
| TestScenarioResult | TestResults | test_case_id, scenario, precondition, result, status |
| GenericExcel | Data | row_id, category, title, description, note |

모든 definition은 `Cover`, `ChangeHistory`, body sheet를 포함한다. TemplateDefinition은 U3 code/config에서 immutable로 관리한다.

## 컴포넌트 관계
- `RendererRegistry` → Markdown/Excel handler를 선택한다.
- `RenderModelFactory` → U2 source와 attachment resolution을 결합한다.
- `AttachmentService` → U1 ObjectStoragePort, AttachmentRepository를 사용한다.
- `XlsxExportService` → TemplateRegistry와 RenderModel을 사용한다.
- `DocxExportService` → MdPublisherAdapter와 normalized Markdown을 사용한다.
- 모든 component는 U2 read interface를 통해서만 source/trace history를 받는다.

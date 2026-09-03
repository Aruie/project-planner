# U3 비즈니스 규칙

| ID | 규칙 |
|---|---|
| U3-BR-001 | 모든 preview, attachment, export 요청은 U2 source의 project/artifact scope를 확인한 후 처리한다. |
| U3-BR-002 | U3는 U2 Draft/version/trace lifecycle을 변경하지 않으며 읽기 전용 source snapshot만 사용한다. |
| U3-BR-003 | attachment는 PNG 또는 JPEG만 허용하며 bytes는 최대 5 MiB다. |
| U3-BR-004 | attachment bytes는 U1 ObjectStoragePort/S3에만 저장하고 DynamoDB에는 metadata/reference만 저장한다. |
| U3-BR-005 | attachment resolve는 project ID와 artifact ID 모두 일치해야 한다. |
| U3-BR-006 | Markdown preview는 cover, change history, normalized body block, attachment placeholder를 가진 RenderModel을 반환한다. |
| U3-BR-007 | ExcelDocument export는 cover, change-history, body sheet를 반드시 포함한다. |
| U3-BR-008 | TemplateRegistry는 RequirementsDefinition, TraceMatrix, TestScenarioResult, GenericExcel의 기본 column을 제공한다. |
| U3-BR-009 | 템플릿 상세 column 변경은 MVP에서 code/config 변경으로 관리하며 runtime custom template upload는 제공하지 않는다. |
| U3-BR-010 | DOCX export는 MarkdownDocument만 지원하고 MdPublisherAdapter만 사용한다. fallback DOCX generator는 제공하지 않는다. |
| U3-BR-011 | U3 오류는 stable code, Korean message, retryable만 포함하며 source body, S3 object key, library stack trace를 노출하지 않는다. |
| U3-BR-012 | 빈 attachment, 빈 version history, 빈 trace matrix는 정상 결과다. |

## Fixed template 기본 column
| Template | Body columns |
|---|---|
| RequirementsDefinition | requirement_id, title, description, priority, source |
| TraceMatrix | story_id, requirement_id, test_case_id, status, gap |
| TestScenarioResult | test_case_id, scenario, precondition, result, status |
| GenericExcel | row_id, category, title, description, note |

## 오류 규칙
- unsupported source/output 조합: `RENDERER_NOT_SUPPORTED`
- attachment type/size: U1 `ATTACHMENT_TYPE_NOT_ALLOWED` 또는 `ATTACHMENT_TOO_LARGE`
- attachment scope: `ATTACHMENT_SCOPE_MISMATCH`
- source scope: `RENDER_SOURCE_SCOPE_MISMATCH`
- md-publisher import/conversion: `DOCX_EXPORT_FAILED`
- workbook generation: `XLSX_EXPORT_FAILED`

`retryable`은 U1 storage error를 그대로 반영하고, validation/scope/template 오류는 false다.

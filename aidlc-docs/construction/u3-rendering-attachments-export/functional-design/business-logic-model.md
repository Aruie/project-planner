# U3 비즈니스 로직 모델

## 범위와 소유권
U3는 U2의 scoped Artifact/Draft/Version read model을 입력으로 받아 preview, attachment, XLSX, DOCX를 생성한다. U3는 Draft 수정, version 확정, diff, trace lifecycle을 생성하거나 변경하지 않는다.

## Renderer Registry
1. 요청은 `project_id`, `artifact_id`, source(Draft 또는 Version), output kind를 가진다.
2. U3는 U2 read boundary로 source의 project/artifact 범위를 확인하고 immutable source snapshot을 얻는다.
3. RendererRegistry가 Artifact type/output kind에 맞는 handler를 선택한다.
4. handler는 공통 `RenderModel`을 먼저 만들고 preview 또는 export adapter에 전달한다.
5. renderer/export 오류는 본문·S3 key·library stack trace 없이 Korean stable error로 반환한다.

## Markdown preview 흐름
1. Markdown handler는 front matter, GFM 본문, attachment reference를 normalize한다.
2. 공통 metadata와 public document ID로 cover model을 만든다.
3. U2 version history summary로 change-history model을 만든다.
4. GFM table은 table block으로, attachment reference는 resolved image model로 변환한다.
5. 결과는 cover, change history, body blocks, attachment placeholders를 가진 RenderModel이다.

## Attachment 흐름
1. upload 요청은 project/artifact scope, filename, PNG/JPEG media type, byte size를 검증한다.
2. 5 MiB 이하의 검증된 bytes를 U1 ObjectStoragePort에 저장하고 checksum/object reference를 받는다.
3. U3는 AttachmentRepository에 project/artifact-scoped Attachment metadata를 저장한다.
4. preview/export에서 attachment ID를 resolve할 때 project/artifact scope를 다시 확인하고 ObjectStoragePort로 bytes를 읽는다.
5. 잘못된 type/size, scope mismatch, object read failure는 attachment metadata나 기존 source를 변경하지 않는다.

## Fixed XLSX 흐름
1. ExcelDocument type과 requested template kind를 확인한다.
2. TemplateRegistry가 RequirementsDefinition, TraceMatrix, TestScenarioResult, GenericExcel의 template를 선택한다.
3. 공통 cover sheet에는 project, public document ID, title, description, type, source identity를 쓴다.
4. change-history sheet에는 U2 VersionSummary 목록을 version number, source Draft revision, confirmed time으로 기록한다.
5. body sheet는 template별 기본 column과 source/trace rows를 채운다.
6. 생성 workbook bytes는 export response로 반환하며 U2 Draft/Version을 저장하지 않는다.

## DOCX 흐름
1. MarkdownDocument source를 resolve하고 normalized Markdown/front matter를 만든다.
2. MdPublisherAdapter가 외부 md-publisher의 안정화된 입력만 호출한다.
3. cover/change-history information은 front matter/render context로 전달한다.
4. 성공 시 DOCX bytes와 filename/content type을 반환한다.
5. md-publisher import/conversion 실패는 `DOCX_EXPORT_FAILED` safe error로 변환한다. fallback generator는 MVP에 없다.

## Trace matrix export
- U3는 U2 trace list/gap read result만 입력으로 받아 TraceMatrix template body를 채운다.
- U3는 TraceLink를 생성·수정하지 않는다.
- 빈 link/gap 결과는 header만 있는 정상 workbook이다.

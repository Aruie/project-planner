# U3 프론트엔드 컴포넌트

## 판정
U3는 FastAPI renderer/attachment/export backend 단위다. React 화면, form state, upload progress, download interaction은 U5가 소유하므로 U3는 React component를 구현하거나 상세 설계하지 않는다.

## U5 API handoff
| 사용자 흐름 | U3 응답 모델 | U5 처리 |
|---|---|---|
| Markdown preview | RenderModel | cover/change history/body block/image placeholder 렌더링 |
| 이미지 첨부 | Attachment metadata/resolved reference | file type/5 MiB 사전 검증, upload 상태와 오류 표시 |
| XLSX export | ExportResult bytes/filename/content type | download action |
| DOCX export | ExportResult bytes/filename/content type | download action |
| trace matrix export | ExportResult 또는 safe ApiError | empty matrix는 정상 download, 오류 code 표시 |

## 자동화 친화성 인계
U5 구현 시 upload, preview, export buttons에는 안정적인 `data-testid`를 사용한다. 예: `attachment-upload-input`, `xlsx-export-button`, `docx-export-button`, `markdown-preview-panel`.

## 오류 표시 인계
U5는 `ATTACHMENT_TYPE_NOT_ALLOWED`, `ATTACHMENT_TOO_LARGE`, `ATTACHMENT_SCOPE_MISMATCH`, `RENDERER_NOT_SUPPORTED`, `XLSX_EXPORT_FAILED`, `DOCX_EXPORT_FAILED`를 한국어 UX 문구로 변환한다. U3는 UI state나 retry button 정책을 소유하지 않는다.

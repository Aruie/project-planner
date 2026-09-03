# U5 프론트엔드 컴포넌트

## 계층
```text
AppShell
├── ProjectContextBar
├── Navigation
├── ArtifactWorkspace
│   ├── ArtifactEditor
│   ├── MarkdownPreviewPanel
│   ├── AttachmentControl
│   ├── ExportActions
│   ├── VersionPanel
│   └── DiffPanel
├── TraceabilityPanel
└── AiWorkspacePanel
    ├── ConversationHistory
    ├── PromptForm
    ├── TemporaryPreviewPanel
    └── ReviewedSaveForm
```

텍스트 대안: AppShell은 current project context와 Korean navigation을 유지한다. artifact workspace, traceability, AI workspace는 이 context를 받으며 API client를 통해 U2/U3/U4 contract만 호출한다.

## 컴포넌트 계약
| 컴포넌트 | props/state | 사용자 동작·API handoff |
|---|---|---|
| ProjectContextBar | ProjectContext, input state | current project ID 설정; context 없음이면 scoped action 비활성 |
| ArtifactEditor | ArtifactDraftState | explicit create/update; dirty input과 server revision conflict 표시 |
| MarkdownPreviewPanel | RenderModel/RequestState | U3 render 결과 read-only 표시 |
| AttachmentControl | AttachmentState | type/5 MiB precheck, U3 upload/resolve, progress/error 표시 |
| ExportActions | ExportState | U3 XLSX/DOCX/trace export bytes download |
| VersionPanel | version list, RequestState | explicit U2 version confirm/list; auto-confirm 없음 |
| DiffPanel | VersionSelection, DiffResult | U2 structured diff read-only 표시 |
| TraceabilityPanel | TraceabilityState | U2 link create/gaps read |
| AiWorkspacePanel | AiWorkspaceState, AiPromptState | U4 start/get/send, expiry/error/preserved preview 표시 |
| ReviewedSaveForm | ReviewedSaveState | non-empty AI preview only; U4 reviewed-save then U2 Draft result 표시 |

## 안정적 automation IDs
- shell/context: `project-context-input`, `project-context-apply-button`, `app-error-banner`
- artifact: `artifact-type-select`, `artifact-title-input`, `artifact-content-input`, `artifact-save-button`, `draft-conflict-banner`
- version/diff/trace: `version-confirm-button`, `version-list`, `diff-left-select`, `diff-right-select`, `diff-run-button`, `trace-link-form`, `trace-gap-button`
- rendering/export: `markdown-preview-panel`, `attachment-upload-input`, `xlsx-export-button`, `docx-export-button`
- AI (U4 handoff fixed): `ai-prompt-input`, `ai-send-button`, `ai-preview-panel`, `ai-save-reviewed-button`, `ai-error-banner`, `ai-new-session-button`

## UI validation
- title/prompt are trimmed and required before action.
- save buttons disable during their own request; they do not disable unrelated read-only panels.
- reviewed-save disables unless `AiWorkspaceState.preview` is non-empty and active session exists.
- API safe errors are localized Korean text; raw response/provider detail is never rendered.

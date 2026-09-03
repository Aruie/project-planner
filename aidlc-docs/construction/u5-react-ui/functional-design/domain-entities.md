# U5 도메인 상태 모델

## Shared client models
| 모델 | 필드 | 책임 |
|---|---|---|
| ProjectContext | projectId, displayName?, readiness | 모든 scoped route/action의 단일 context |
| ApiProblem | code, message, retryable, currentRevision? | backend safe error의 UI-safe representation |
| RequestState | idle/loading/success/error, requestId | feature별 explicit request 상태 |
| ArtifactDraftState | artifact response, content, dirty, baselineRevision | editor local work와 U2 persisted baseline 분리 |
| VersionSelection | artifactId, left source, right source | U2 diff query 입력 |
| TraceabilityState | link form, links, gaps | trace create/gap presentation state |
| AttachmentState | selectedFile?, progress, result/error | U3 upload/resolve UI state |
| ExportState | format, request state, download name | U3 output delivery state |
| AiWorkspaceState | sessionId, projectId, messages, preview, expiresAt | U4 temporary session response mirror |
| AiPromptState | editable prompt, send state, last safe error | failed prompt가 U4 history에 기록되지 않는 local input |
| ReviewedSaveState | title, tags, request state, created Draft result | U4 explicit reviewed-save form state |

## State relationships
- AppShell owns one ProjectContext and routing state.
- each feature owns local RequestState; shared API client has no business/cache authority.
- ArtifactDraftState remains local until explicit U2 create/update success.
- AiWorkspaceState is replaced only by U4 success responses; on failure the prior snapshot remains unchanged.
- ReviewedSaveState result is an U2 Artifact/Draft result and is not a Version state.

## Backend mapping
| Feature state | Authoritative backend contract |
|---|---|
| ArtifactDraftState | U2 ArtifactResponse/UpdateDraftRequest |
| VersionSelection/result | U2 VersionResponse/DiffResult |
| TraceabilityState | U2 TraceLinkResponse/TraceGapResult |
| Attachment/Export/Preview | U3 attachment/render/export results |
| AiWorkspaceState/ReviewedSaveState | U4 AiWorkspaceState/ReviewedPreviewSaveResponse |

U5 does not recreate U1 entities or expose ContentRef, AWS table keys, S3 object keys, Bedrock model IDs, or raw provider error data.

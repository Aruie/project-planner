# Component Methods

## Signature Conventions
- Python application interfaces use typed command/query/result models.
- REST routes expose Pydantic request and response models; exact HTTP schemas are refined in Units Generation and Functional Design.
- Detailed validation, diff algorithms, DynamoDB expressions, and state transitions are intentionally deferred to Functional Design.

## Project Service
| Method | Input | Output | Purpose |
|---|---|---|---|
| `create_project(command: CreateProjectCommand)` | name, optional description, administrator context | `Project` | Create a project for all downstream menu scopes. |
| `list_projects(query: ProjectListQuery)` | administrator context, paging | `Page[ProjectSummary]` | List accessible projects. |
| `get_project(project_id: ProjectId)` | project ID | `Project` | Resolve the current project context. |

## Artifact Service and Type Handlers
| Method | Input | Output | Purpose |
|---|---|---|---|
| `create_artifact(command: CreateArtifactCommand)` | project ID, artifact type, title, initial metadata | `ArtifactDraft` | Create a document and its single current Draft. |
| `get_artifact(project_id, artifact_id)` | project ID, artifact ID | `ArtifactSummary` | Read document metadata and current status. |
| `get_draft(project_id, artifact_id)` | project ID, artifact ID | `ArtifactDraft` | Load editable current Draft. |
| `update_draft(command: UpdateDraftCommand)` | expected revision, metadata, normalized content | `ArtifactDraft` | Update one current Draft with optimistic concurrency. |
| `normalize_content(artifact_type, content)` | artifact type, raw Markdown or structured data | `NormalizedContent` | Delegate format-specific normalization to a handler. |
| `get_handler(artifact_type)` | artifact type | `ArtifactTypeHandler` | Select Markdown or Excel strategy. |

## Version and Diff Components
| Method | Input | Output | Purpose |
|---|---|---|---|
| `prepare_version_confirmation(command: PrepareVersionCommand)` | project ID, artifact ID, Draft revision | `VersionConfirmation` | Return proposed version number, author, timestamp, and change summary before save. |
| `confirm_version(command: ConfirmVersionCommand)` | confirmation token or expected Draft revision | `VersionSnapshot` | Atomically create immutable snapshot and advance the Draft lifecycle. |
| `list_versions(project_id, artifact_id)` | project/document identifiers | `list[VersionSummary]` | Return version history. |
| `compare_versions(query: DiffQuery)` | base version/Draft, target version/Draft | `ArtifactDiff` | Return metadata and line-level body changes. |
| `summarize_change(base, target)` | normalized content pair | `ChangeSummary` | Produce automatic change-history summary. |

## Attachment and Export Components
| Method | Input | Output | Purpose |
|---|---|---|---|
| `create_upload_target(command: CreateAttachmentCommand)` | project ID, artifact ID, file metadata | `UploadTarget` | Create attachment metadata and S3 upload target. |
| `resolve_attachment(attachment_id)` | attachment ID | `ResolvedAttachment` | Resolve accessible object information for preview/export. |
| `export_artifact(command: ExportArtifactCommand)` | artifact ID, source Draft/version, output format | `ExportResult` | Coordinate renderer selection and output delivery. |
| `render(content: RenderModel, options: RenderOptions)` | normalized content and template options | `RenderedFile` | Generate a format-specific file. |

## Traceability Service
| Method | Input | Output | Purpose |
|---|---|---|---|
| `upsert_trace_link(command: TraceLinkCommand)` | story ID, requirement ID, test case ID, status | `TraceLink` | Create or update a trace relationship. |
| `list_trace_links(project_id)` | project ID, filters | `list[TraceLink]` | Return links for the traceability view. |
| `find_trace_gaps(project_id)` | project ID | `TraceGapReport` | Identify missing or invalid mappings. |
| `export_trace_matrix(project_id)` | project ID | `ExportResult` | Create the fixed-format Excel trace matrix. |

## AI Workspace Service
| Method | Input | Output | Purpose |
|---|---|---|---|
| `create_session(command: CreateAiSessionCommand)` | project ID, administrator context | `AiWorkspaceSession` | Create a project-scoped TTL temporary session. |
| `send_message(command: AiMessageCommand)` | session ID, user text, current preview revision | `AiWorkspacePreview` | Send context to Bedrock and return updated editable preview. |
| `get_session(session_id)` | session ID, project ID | `AiWorkspaceSession` | Resume temporary conversation and preview. |
| `save_reviewed_preview(command: SaveAiPreviewCommand)` | session ID, target artifact metadata, expected preview revision | `ArtifactDraft` | Explicitly create a new requirements-definition Draft only after review. |
| `discard_session(session_id)` | session ID | `None` | Discard temporary conversation without creating a document. |

## Repository and Port Interfaces
| Method Group | Input | Output | Boundary |
|---|---|---|---|
| `ProjectRepository` CRUD | project entities/queries | projects | `projects` table only |
| `ArtifactRepository` Draft operations | artifact draft, expected revision | artifact/draft | `artifacts` table only |
| `VersionRepository` immutable operations | version snapshot, query | versions | `artifact_versions` table only |
| `TraceabilityRepository` link operations | trace links/queries | links | `trace_links` table only |
| `AiSessionRepository` TTL operations | session state, expiry | sessions | `ai_workspace_sessions` table only |
| `ObjectStoragePort` object operations | key, stream, metadata | object reference/stream | S3 only |
| `BedrockPort` conversation operations | structured messages, generation options | generated preview delta | Bedrock only |

## Deferred Functional-Design Decisions
- Exact front matter schema, Excel column schemas, snapshot numbering algorithm, and change-summary rules.
- Conditional-write expressions and DynamoDB transaction composition.
- Line-diff library and semantic diff extensions.
- Bedrock prompt structure, model selection, token/window handling, and retry policy.
- Exact S3 key naming, body-size threshold, and export download delivery.

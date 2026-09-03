# Services

## Service Layer Principles
- Services orchestrate domain and adapter components; FastAPI routes do not contain business workflows.
- Every service receives a project scope for project-owned resources.
- Draft updates use expected revisions; version confirmation creates immutable snapshots through the version workflow.
- Renderer and Bedrock adapters are invoked through interfaces, keeping application services independent of implementations.

## REST Resource Groups
| Resource Group | Representative REST Resources | Orchestrating Service |
|---|---|---|
| Projects | `GET/POST /projects`, `GET /projects/{projectId}` | Project Service |
| Artifacts and Drafts | `GET/POST /projects/{projectId}/artifacts`, `GET/PATCH /projects/{projectId}/artifacts/{artifactId}/draft` | Artifact Service |
| Versions and Diff | `POST /artifacts/{artifactId}/versions/prepare`, `POST /artifacts/{artifactId}/versions/confirm`, `GET /artifacts/{artifactId}/diff` | Version Service, Diff Service |
| Attachments and Exports | `POST /artifacts/{artifactId}/attachments`, `POST /artifacts/{artifactId}/exports` | Attachment Service, Export Service |
| Traceability | `GET/POST /projects/{projectId}/trace-links`, `GET /projects/{projectId}/trace-gaps`, `POST /projects/{projectId}/trace-matrix/export` | Traceability Service |
| AI Workspace | `POST /projects/{projectId}/ai-sessions`, `POST /ai-sessions/{sessionId}/messages`, `POST /ai-sessions/{sessionId}/save` | AI Workspace Service |

## Service Definitions

### Project Service
- Owns project lifecycle and validates that downstream requests have a current project scope.
- Does not own documents, versions, or UI session state.

### Artifact Service
- Owns the common artifact lifecycle: type selection, metadata, single current Draft, Draft read/update, and handler selection.
- Delegates content normalization and render-model conversion to the selected Artifact Type Handler.
- Stores small content inline; stores references to S3 content when content has crossed the configured threshold.

### Version Service
- Owns pre-confirmation information and immutable snapshot creation.
- Coordinates Artifact Repository and Version Repository so a failure cannot leave a partially created official version.
- Emits a version result that Artifact Service uses to maintain the next editable Draft.

### Diff Service
- Reads only normalized Draft/version content and returns a presentation-neutral diff result.
- Separates metadata/front matter differences from body-line differences.

### Attachment Service
- Creates S3 upload targets and attachment metadata before clients upload image bytes.
- Resolves images for renderer consumers without embedding binaries in DynamoDB.

### Export Service
- Selects a renderer through Renderer Registry.
- Excel Renderer owns fixed XLSX sheet construction; DOCX Renderer owns md-publisher conversion; neither renderer writes version records.

### Traceability Service
- Owns mappings among story, requirement, and test-case IDs and reports gaps.
- Uses Export Service/Excel Renderer only for trace matrix output rather than duplicating workbook logic.

### AI Workspace Service
- Owns temporary, project-scoped conversation sessions with DynamoDB TTL.
- Sends session context and user input through Bedrock Port and updates only the temporary preview.
- Calls Artifact Service only after the administrator explicitly reviews and saves the preview; it never automatically persists a normal Draft or version.

## Orchestration Flows

### Draft Edit Flow
1. Artifact REST route resolves current project and invokes Artifact Service.
2. Artifact Service selects a type handler and validates/normalizes content.
3. Artifact Repository writes the current Draft only if the expected revision matches.
4. REST Adapter returns the new Draft revision to the React Artifact Feature.

### Version Confirmation Flow
1. React Version Feature requests a confirmation preview.
2. Version Service reads current Draft and latest version, then returns proposed metadata and change summary.
3. On explicit confirmation, Version Service writes immutable snapshot and advances the current Draft within the same application-level consistency boundary.
4. React refreshes document history and current Draft status.

### AI Review and Save Flow
1. React AI Workspace Feature creates a project-scoped TTL session.
2. AI Workspace Service records temporary user/assistant messages and editable preview state, then calls Bedrock Adapter.
3. The administrator iterates through preview changes without normal document persistence.
4. On explicit save, AI Workspace Service invokes Artifact Service to create a new requirements-definition Draft in the same project.
5. The session remains disposable/expiring and is never a version snapshot.

## Error Ownership
| Condition | Owning Service | API Outcome |
|---|---|---|
| Project not selected or not found | Project Service | Project-context validation error |
| Draft revision conflict | Artifact Service | Conflict response with latest Draft indicator |
| Version confirmation conflict/failure | Version Service | No partial official version; Draft preserved |
| Attachment object unavailable | Attachment Service | Preview/export error; source document preserved |
| Unsupported renderer/type | Export Service | Validation error with supported formats |
| Invalid trace reference | Traceability Service | Validation error or gap indicator |
| Bedrock failure | AI Workspace Service | Retryable error; temporary preview and existing Draft preserved |

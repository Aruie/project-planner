# U1 Domain Entities

## Entity Overview
| Entity | Identity | Mutable Fields | Ownership |
|---|---|---|---|
| Project | `ProjectId` UUID | name, configured document ID prefix, next sequence counter | U1 foundation |
| Artifact | `ArtifactId` UUID plus `(ProjectId, public_document_id)` | metadata and current Draft reference | U1 contract; U2 lifecycle |
| Draft | `DraftId` UUID | metadata, ContentRef, attachment references, revision | U1 contract; U2 lifecycle |
| VersionSnapshot | `VersionId` UUID | none after creation | U1 immutability contract; U2 creation workflow |
| Attachment | `AttachmentId` UUID | metadata/object reference before completed state | U1 validation contract; U3 usage |
| TraceLink | `TraceLinkId` UUID | linked IDs and relationship status | U1 contract; U2 lifecycle |
| AiWorkspaceSession | `AiSessionId` UUID | messages, preview, expiry | U1 contract; U4 lifecycle |

## Value Objects
### Identifiers
- `ProjectId`, `ArtifactId`, `DraftId`, `VersionId`, `AttachmentId`, `TraceLinkId`, `AiSessionId`: immutable UUID wrappers.
- `PublicDocumentId`: project-local display identifier containing `prefix` and `sequence`.
- `DocumentIdPrefix`: configured project prefix. It is not required to be unique across projects.

### Content References
| Value Object | Required Fields | Invariants |
|---|---|---|
| `InlineContentRef` | normalized content, byte size, checksum | byte size is at most 300 KiB |
| `S3ContentRef` | object key, byte size, checksum | byte size is greater than 300 KiB; object key is nonempty |
| `ContentRef` | exactly one of InlineContentRef or S3ContentRef | never represents both storage forms |

### Draft Revision
- `DraftRevision` is a positive integer.
- It provides comparison for expected-versus-current conditional update.
- It increases by one only after an accepted Draft replacement.

### Attachment Metadata
- `AttachmentMediaType`: either `image/png` or `image/jpeg`.
- `AttachmentSize`: integer bytes in range 1 through 5 MiB.
- `AttachmentObjectRef`: S3 key, checksum, and byte size.

## Entity Details

### Project
| Field | Description | Rule |
|---|---|---|
| project_id | immutable internal UUID | U1-BR-001 |
| name | project display name | exact validation deferred to U2 functional design |
| document_id_prefix | configured prefix such as CKA | U1-BR-002 |
| next_document_sequence | project-local allocation counter | produces next positive sequence |
| created_at | creation timestamp | immutable audit metadata |

### Artifact
| Field | Description | Rule |
|---|---|---|
| artifact_id | immutable UUID | U1-BR-001 |
| project_id | owning project | mandatory scope |
| public_document_id | e.g., CKA-001 | unique within project, immutable |
| artifact_type | MarkdownDocument or ExcelDocument subtype | exact allowed values owned by U2/U3 |
| current_draft_id | current Draft reference | exactly one current Draft contract |
| created_at | creation timestamp | immutable audit metadata |

### Draft
| Field | Description | Rule |
|---|---|---|
| draft_id | immutable UUID | U1-BR-001 |
| artifact_id | owning artifact | mandatory |
| revision | optimistic concurrency revision | positive and incremented only on accepted update |
| metadata | normalized common metadata | detailed schema deferred to U2 |
| content_ref | inline or S3 content reference | exactly one valid ContentRef |
| attachment_ids | attachment references | attachment validation applies |

### VersionSnapshot
| Field | Description | Rule |
|---|---|---|
| version_id | immutable UUID | U1-BR-001 |
| artifact_id | owning artifact | mandatory |
| version_number | human version value | numbering algorithm deferred to U2 |
| source_draft_revision | Draft revision used to create snapshot | immutable provenance |
| content_ref | complete snapshot content | immutable |
| created_by and created_at | audit origin | immutable |

### Attachment
| Field | Description | Rule |
|---|---|---|
| attachment_id | immutable UUID | U1-BR-001 |
| project_id and artifact_id | ownership scope | mandatory |
| media_type and byte_size | validated media metadata | PNG/JPEG and <= 5 MiB |
| object_ref | S3 reference | binary is not stored in DynamoDB |

### TraceLink
- Connects a story ID, requirement ID, and test case ID under one project scope.
- U1 preserves typed identifiers and relationship status values; U2 defines CRUD/gap workflows.

### AiWorkspaceSession
- Holds project scope, administrator context, temporary messages, editable preview `ContentRef`, expiry timestamp, and preview revision.
- It is not an Artifact, Draft, or VersionSnapshot.
- U4 determines session workflow; U1 guarantees identity and temporary-storage contracts.

## Repository and Port Contracts
| Contract | Responsibilities | Excluded Responsibilities |
|---|---|---|
| ProjectRepository | project lookup/create and project-local document ID allocation | document lifecycle |
| ArtifactRepository | scoped artifact/Draft retrieval and conditional Draft replacement | version confirmation orchestration |
| VersionRepository | append/read immutable snapshot values | mutation of stored snapshots |
| AttachmentRepository | metadata read/write | byte upload/download |
| TraceLinkRepository | typed link persistence | gap policy and presentation |
| AiSessionRepository | temporary session and expiry metadata | normal Artifact persistence |
| ObjectStoragePort | write/read object by reference | business validation and lifecycle rules |

## U1 Entity Boundaries
- U1 defines types and invariants shared by U2–U5.
- U2 owns normal artifact/version/trace business workflows.
- U3 owns renderer-specific schema and attachment consumption.
- U4 owns Bedrock session orchestration.
- U5 owns UI state and does not manipulate entities directly outside REST contracts.

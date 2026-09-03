# U1 Business Rules

## Identifier Rules
| Rule ID | Rule |
|---|---|
| U1-BR-001 | Every Project, Artifact, Draft, VersionSnapshot, Attachment, TraceLink, and AiWorkspaceSession has an immutable internal UUID. |
| U1-BR-002 | A Project configures a project-local document ID prefix at creation, such as `CKA`. Prefixes are not globally unique. |
| U1-BR-003 | An Artifact public document ID is unique only within its Project and is formatted as `{prefix}-{sequence}` with a zero-padded positive sequence, such as `CKA-001`. |
| U1-BR-004 | An allocated Artifact public document ID is immutable. A prefix configuration change cannot rewrite IDs already assigned to artifacts. |
| U1-BR-005 | U1 repository contracts require a ProjectId for every project-owned entity access. |

## Lifecycle and Preservation Rules
| Rule ID | Rule |
|---|---|
| U1-BR-006 | MVP provides no artifact archive or physical delete operation. Existing artifact-related records are retained. |
| U1-BR-007 | A Draft is the only mutable document-content representation. VersionSnapshot is immutable after persistence. |
| U1-BR-008 | U1 defines storage/immutability primitives but U2 alone orchestrates normal Draft creation, version confirmation, and change-history workflows. |
| U1-BR-009 | Temporary AI session expiry never creates, alters, or deletes an Artifact Draft or VersionSnapshot. |

## Draft Revision Rules
| Rule ID | Rule |
|---|---|
| U1-BR-010 | Each Draft revision is a positive integer. A new Draft starts at revision 1. |
| U1-BR-011 | An update command must include the revision read by the caller as `expected_revision`. |
| U1-BR-012 | A conditional update succeeds only when `expected_revision` equals the stored revision and increases revision by exactly one. |
| U1-BR-013 | On revision mismatch, the operation fails with `DraftRevisionConflict`; no last-write-wins and no automatic merge is permitted. |

## Content and Storage Rules
| Rule ID | Rule |
|---|---|
| U1-BR-014 | Serialized normalized content of 300 KiB or less uses InlineContentRef. |
| U1-BR-015 | Serialized normalized content greater than 300 KiB uses S3ContentRef and stores byte size plus checksum metadata. |
| U1-BR-016 | A failed S3 write or reference validation leaves the prior content reference unchanged. |
| U1-BR-017 | Consumers use ContentRef abstraction and must not require knowledge of inline versus S3 storage. |

## Attachment Rules
| Rule ID | Rule |
|---|---|
| U1-BR-018 | Only PNG (`image/png`) and JPEG (`image/jpeg`) attachments are allowed in MVP. |
| U1-BR-019 | An attachment's declared and verified byte size must not exceed 5 MiB. |
| U1-BR-020 | Attachment metadata is persisted separately from the artifact body; binary image bytes are stored only through ObjectStoragePort. |
| U1-BR-021 | Invalid type or size is rejected before creating a usable attachment reference or writing bytes. |

## Repository Contract Rules
| Rule ID | Rule |
|---|---|
| U1-BR-022 | Purpose-specific repository interfaces cannot access another repository's table directly. |
| U1-BR-023 | Artifact Repository must expose conditional Draft update and project-scoped public-ID allocation contracts. |
| U1-BR-024 | Version Repository must reject mutation of existing VersionSnapshot values. |
| U1-BR-025 | AI Session Repository stores only temporary session/preview state and must support expiry metadata. |

## Functional Error Handling Rules
| Rule ID | Rule |
|---|---|
| U1-BR-026 | Validation errors identify the invalid field or policy without exposing storage internals. |
| U1-BR-027 | Conflict errors identify that the caller must reload current Draft state; they do not merge or overwrite content. |
| U1-BR-028 | Storage errors are retryable only when no visible domain mutation has completed. |
| U1-BR-029 | Invalid scope/identifier operations must not allocate document sequences, write content, or create orphan attachment metadata. |

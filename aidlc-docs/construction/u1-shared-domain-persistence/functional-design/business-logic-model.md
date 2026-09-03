# U1 Business Logic Model

## Scope
U1 provides domain primitives and persistence contracts. It does not implement REST routes, artifact rendering, version confirmation orchestration, or UI behavior. U2 consumes these primitives to implement document lifecycle workflows.

## Core Model Relationships
- A **Project** has one immutable internal UUID and one configured document ID prefix.
- A **Project** contains zero or more **Artifacts**.
- An **Artifact** has one immutable internal UUID, one project-local human-readable document ID, one current **Draft**, and zero or more immutable **VersionSnapshots**.
- A **Draft** references one **ContentRef**, which is either inline content or an S3 object reference.
- An **Artifact** can reference zero or more **Attachments**.
- A **Project** can own **TraceLinks** and temporary **AiWorkspaceSessions**.

## Project-Scoped Document ID Allocation
1. At project creation, the administrator configures a document ID prefix such as `CKA`.
2. The system keeps a project-local positive sequence counter beginning at 1.
3. When U2 creates an artifact, it requests the next number from U1's project-scoped ID allocator.
4. The public document ID is formatted as `{prefix}-{zero-padded sequence}`, for example `CKA-001`.
5. The same prefix may be configured by different projects because the uniqueness constraint is `(project_id, public_document_id)`, not global prefix uniqueness.
6. The assigned public document ID never changes after artifact creation, even if project settings later change.

## Draft Concurrency Model
1. Every Draft carries a positive integer `revision`.
2. A client reads the current Draft and sends its observed revision as `expected_revision` when updating it.
3. The persistence contract accepts the update only when `expected_revision` equals the current revision.
4. On success, the contract stores the replacement Draft and increases revision by exactly one.
5. On mismatch, the contract returns a `DraftRevisionConflict` containing enough information for U2/U5 to reload the current Draft; it never overwrites newer content.

## Content Storage Selection
1. U1 measures the serialized normalized content byte size before persistence.
2. Content at or below **300 KiB** is represented by `InlineContentRef` in the artifact or version record.
3. Content above 300 KiB is written through `ObjectStoragePort` and represented by `S3ContentRef` containing an immutable object key, byte size, and checksum.
4. Consumers resolve content exclusively through `ContentRef`; they do not branch on DynamoDB or S3 details.
5. Failed object storage writes must not replace the existing content reference.

## Attachment Validation Flow
1. A caller supplies proposed attachment metadata before upload.
2. U1 validates the MIME type against `image/png` and `image/jpeg` and validates size is at most **5 MiB**.
3. If valid, U1 creates an attachment identity and S3 object target contract.
4. If invalid, the contract returns a validation error without an attachment reference or object write.
5. Attachment bytes remain in S3; U1 persists only attachment metadata and object reference.

## Preservation Model
- MVP does not expose archive or physical delete for artifacts.
- A stored Project, Artifact, Draft, VersionSnapshot, Attachment, TraceLink, or AI session is retained according to its domain-specific lifecycle.
- AI sessions are temporary by their expiry policy, but expiry is not deletion of an artifact or version.
- Version snapshots are declared immutable domain values; only U2 can request a new snapshot through a later workflow.

## Data Flow Contracts
### Artifact Foundation Flow
1. U2 verifies `ProjectId` and requests a project-scoped public document ID.
2. U2 builds an `Artifact` and initial `Draft` with revision 1.
3. U1 chooses inline or S3 `ContentRef` based on the 300 KiB rule.
4. Artifact Repository persists the artifact/Draft contract and returns the stored revision.

### Draft Update Flow
1. U2 passes artifact identity, project scope, proposed content, and expected revision.
2. U1 validates project scope and content reference selection.
3. Artifact Repository performs the conditional revision update.
4. U1 returns the new Draft or `DraftRevisionConflict`.

### Attachment Preparation Flow
1. U3 asks U1 to validate file type/size and create attachment metadata.
2. U1 returns a valid attachment object and storage target only after validation succeeds.
3. U3 uses the target for upload and later passes the attachment reference to artifact content.

## U1 Error Taxonomy
| Error | Trigger | Required Effect |
|---|---|---|
| `InvalidIdentifier` | malformed UUID, prefix, or public document ID | reject without mutation |
| `ProjectNotFound` | unknown project scope | reject downstream action |
| `DuplicateProjectDocumentId` | attempted duplicate `(project_id, public_document_id)` | reject allocation/create without consuming duplicate identity |
| `DraftRevisionConflict` | expected revision differs from current revision | preserve current Draft and require reload |
| `ContentStorageFailure` | S3 write/read reference operation fails | preserve previous content reference |
| `AttachmentTypeNotAllowed` | MIME is not PNG or JPEG | reject before object write |
| `AttachmentTooLarge` | file exceeds 5 MiB | reject before object write |
| `ImmutableSnapshotMutation` | request attempts to alter a stored snapshot | reject without mutation |

## PBT Testable Property Handoff

PBT-01 property identification is advisory in Partial mode, but the following properties are recorded so that the blocking Partial rules are implementable later.

| Rule | Property | Applicable U1 Behavior | Later Test Shape |
|---|---|---|---|
| PBT-02 Round-trip | ContentRef encode/decode identity | InlineContentRef and S3ContentRef serialization/deserialization preserve their variant and fields. | Generate valid ContentRef values; decode(encode(x)) equals x. |
| PBT-02 Round-trip | PublicDocumentId format/parse identity | A generated project prefix and positive sequence produce a parseable project-local ID. | Generate valid prefix/sequence pairs; parse(format(x)) equals x. |
| PBT-03 Invariant | Revision monotonicity | A successful conditional Draft update increments revision by exactly one; a conflict changes nothing. | Generate positive revisions and matching/mismatching expected values. |
| PBT-03 Invariant | Storage threshold partition | Content at or below 300 KiB maps only to InlineContentRef; content above it maps only to S3ContentRef. | Generate byte sizes at boundaries and arbitrary valid content metadata. |
| PBT-03 Invariant | Attachment validation | Accepted metadata is only PNG/JPEG and no larger than 5 MiB; rejected input creates no usable reference. | Generate constrained media type/size combinations. |
| PBT-07 Generators | Domain-constrained strategies | UUID wrappers, prefix/sequence values, ContentRef variants, revisions, and attachments must respect U1 rules. | Centralize reusable Hypothesis strategies in U1 test utilities. |
| PBT-08 Reproducibility | Shrinking and seed replay | All U1 PBT failures retain Hypothesis shrinking and reproducible failing seeds. | Configure test/CI reporting during Code Generation and Build/Test. |
| PBT-09 Framework | Hypothesis selection | Python backend requires Hypothesis. | Confirm dependency/configuration in U1 NFR Requirements. |


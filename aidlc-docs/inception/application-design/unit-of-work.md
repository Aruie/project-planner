# Unit of Work Definitions

## Decomposition Summary
- **Delivery model**: One team, one monorepo, one MVP web application.
- **Execution order**: U1 → U2 → U3 → U4 → U5.
- **Unit purpose**: Units are logical implementation and test boundaries, not separately deployed services.

## Monorepo Code Organization
| Path | Owner Unit | Purpose |
|---|---|---|
| `backend/app/domain/` | U1 | Core entities, value types, repository/port interfaces, common errors |
| `backend/app/persistence/` | U1 | Purpose-specific DynamoDB repository foundations and S3 port foundation |
| `backend/app/features/artifacts/` | U2 | Project, artifact, Draft, version, diff, and traceability application services/routes |
| `backend/app/features/rendering/` | U3 | Artifact type handlers, renderers, attachment resolution, XLSX/DOCX export |
| `backend/app/features/ai_workspace/` | U4 | TTL sessions, Bedrock adapter, AI preview and reviewed Draft save |
| `frontend/src/features/` | U5 | Project, artifacts, version/diff, traceability, AI workspace React feature modules |
| `frontend/src/shared/` | U5 | API client, common UI, global project context, OpenAPI types |
| `backend/tests/` and `frontend/src/**/*.test.*` | Respective unit | Unit, integration, and UI tests owned with each unit |

## U1 — Shared Domain and Persistence Foundation
- **Sequence**: 1
- **Purpose**: Establish the shared contracts and storage foundations that every later unit consumes.
- **Responsibilities**:
  - Project, artifact, Draft, version, attachment, trace link, and AI-session core types.
  - Repository interfaces and common result/error types.
  - Purpose-specific DynamoDB table access foundations: projects, artifacts, artifact versions, attachments, trace links, AI workspace sessions.
  - S3 object-storage port foundation and inline-versus-S3 body reference types.
  - Optimistic revision and immutable snapshot contract primitives.
- **Primary code areas**: `backend/app/domain/`, `backend/app/persistence/`.
- **Primary stories**: US-001.
- **Depends on**: None.
- **Enables**: U2, U3, U4, U5.
- **Expected later stages**: Functional Design and NFR Requirements/Design required; PBT applies to domain serialization and invariants.

## U2 — Document, Version, Diff, and Traceability Services
- **Sequence**: 2
- **Purpose**: Implement the core product lifecycle for projects, artifacts, current Drafts, immutable versions, comparisons, and trace links.
- **Responsibilities**:
  - Project REST resources and current project validation.
  - Artifact creation, common metadata, one-current-Draft read/update, and S3 overflow references.
  - Version confirmation preparation, immutable snapshots, change history, optimistic concurrency behavior.
  - Metadata/body diff result generation.
  - Story-requirement-test case trace links and trace gap detection.
- **Primary code areas**: `backend/app/features/artifacts/`.
- **Primary stories**: US-002, US-003, US-007, US-008, US-009, US-010.
- **Depends on**: U1.
- **Enables**: U3, U4, U5.
- **Expected later stages**: Functional Design and NFR Requirements/Design required; key PBT targets are serialization round-trips and Draft/version invariants.

## U3 — Rendering, Attachments, and Export
- **Sequence**: 3
- **Purpose**: Transform normalized artifacts into Markdown preview models, fixed XLSX templates, DOCX output, and resolved attachment-aware rendering.
- **Responsibilities**:
  - Markdown and Excel artifact type handlers.
  - Renderer registry and normalized render model conversion.
  - S3 attachment upload resolution and export-safe image retrieval.
  - openpyxl Excel output with cover sheet, change-history sheet, and type-specific body sheets.
  - Embedded md-publisher DOCX output from Markdown/front matter.
- **Primary code areas**: `backend/app/features/rendering/`.
- **Primary stories**: US-004, US-005, US-006.
- **Depends on**: U1 and U2.
- **Enables**: U5 export and preview integration.
- **Expected later stages**: Functional Design required; NFR Requirements/Design applies to large-content/S3 handling and PBT applies to render-model serialization/normalization where invertible.

## U4 — Bedrock AI Workspace
- **Sequence**: 4
- **Purpose**: Provide project-scoped, temporary conversational requirements generation without creating official documents before review.
- **Responsibilities**:
  - DynamoDB TTL AI session and preview persistence.
  - Bedrock conversation adapter and transient preview updates.
  - Project scope enforcement and error-preserving retry behavior.
  - Explicit reviewed-preview save through U2 Artifact Service to create a requirements-definition Draft.
- **Primary code areas**: `backend/app/features/ai_workspace/`.
- **Primary stories**: US-011, US-012.
- **Depends on**: U1 and U2.
- **Enables**: U5 AI workspace UI integration.
- **Expected later stages**: Functional Design and NFR Requirements/Design required; PBT applies to session/preview serialization round-trips and domain-constrained generators.

## U5 — React Feature Modules and API Integration
- **Sequence**: 5
- **Purpose**: Deliver the project-scoped web user experience over the stable backend contracts produced by U1–U4.
- **Responsibilities**:
  - App shell, automatic administrator context, project selection, and navigation.
  - Artifact authoring, table/preview, version confirmation/history/diff, traceability, exports, and AI workspace views.
  - Shared REST/OpenAPI client, UI error handling, and per-feature state.
  - Integration of all backend contracts into BDD user journeys.
- **Primary code areas**: `frontend/src/features/`, `frontend/src/shared/`.
- **Primary stories**: No exclusive primary story; implements the presentation and integration path for all US-001 through US-012.
- **Depends on**: U1, U2, U3, and U4.
- **Expected later stages**: Functional Design only where UI workflow/state needs it; NFR assessment applies to usability/error handling. Backend PBT rules are N/A to UI-only code unless it introduces serialization logic.

## Unit Boundary Rules
1. U1 owns common contracts and storage adapters; later units do not redefine shared entities or repository interfaces.
2. U2 owns normal document/Draft/version/traceability lifecycle; U3 only renders/exports and U4 only creates an official Draft through U2's explicit save interface.
3. U3 owns output format behavior and never creates immutable version snapshots.
4. U4 owns temporary AI sessions and cannot auto-save a document or version.
5. U5 owns visual state and calls REST APIs only; it has no DynamoDB, S3, or Bedrock SDK access.
6. Every unit adds its own tests; integration compatibility is validated before beginning its dependent unit.

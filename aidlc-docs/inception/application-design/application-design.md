# Application Design

## Architecture Summary
The MVP is a project-scoped React and FastAPI application. The React client is organized by user-facing features and communicates with FastAPI using REST/JSON APIs documented by OpenAPI. FastAPI separates HTTP adaptation, application orchestration, domain lifecycle ownership, persistence repositories, renderer strategies, and AWS adapters.

The core design centers on an Artifact Service with type handlers. It provides shared metadata, Draft, version, and diff behaviors while Markdown, Excel, and DOCX generation remain pluggable renderer responsibilities. This preserves the requested artifact superclass concept without forcing every output type into one implementation.

## Confirmed Design Decisions
| Decision | Chosen Design |
|---|---|
| Frontend organization | Feature modules for project, artifact editing, version/diff, traceability, AI workspace, and shared UI/API client |
| API contract | REST/JSON with FastAPI OpenAPI and Pydantic models |
| DynamoDB boundary | Purpose-specific tables: projects, artifacts, artifact versions, attachments, trace links, AI workspace sessions |
| Temporary AI state | Project-scoped DynamoDB TTL sessions, separate from normal documents and versions |
| Large content | Inline DynamoDB below configured threshold; S3 object reference when content is large |
| Artifact processing | Common Artifact Service plus Markdown/Excel/DOCX type handlers and renderer strategies |

## Lifecycle Boundaries
1. A project is the mandatory top-level context.
2. Artifact Service owns exactly one editable current Draft for each document.
3. Version Service alone creates immutable official snapshots after confirmation.
4. Diff Service compares source pairs without changing either source.
5. AI Workspace Service owns temporary conversation and preview state; only explicit review-save creates a requirements-definition Draft.
6. Renderer strategies create output files but do not alter Draft or version records.

## Design Artifact Index
| Artifact | Contents |
|---|---|
| `components.md` | Component boundaries, responsibilities, external adapters, and ownership rules |
| `component-methods.md` | High-level typed method contracts and deferred detailed rules |
| `services.md` | REST resource groups, orchestration and error ownership |
| `component-dependency.md` | Mermaid dependency diagram, text alternative, dependency matrix, and data ownership |

## Requirements and Story Traceability
| Capability | Requirements | User Stories | Design Owners |
|---|---|---|---|
| Project context | FR-001, FR-012 | US-001 | Project Service, Project Feature |
| Artifact types and Markdown authoring | FR-002, FR-003, FR-004 | US-002, US-003 | Artifact Service, Type Handlers, Artifact Feature |
| Attachments | FR-005, NFR-003 | US-004 | Attachment Service, S3 Adapter |
| Excel and DOCX output | FR-006, FR-010, NFR-005 | US-005, US-006 | Export Service, Renderer Registry |
| Draft and immutable versions | FR-007, FR-008, NFR-002 | US-007, US-008 | Artifact Service, Version Service |
| Diff | FR-009 | US-009 | Diff Service |
| Traceability | FR-011 | US-010 | Traceability Service |
| AI workspace | FR-012, NFR-004 | US-011, US-012 | AI Workspace Service, Bedrock Adapter |

## Deferred to Later Stages
- Exact entity attributes, DynamoDB key design, indexes, TTL duration, size threshold, and transactions.
- Detailed version numbering, change-summary, diff, front matter, Excel column, and prompt rules.
- OpenAPI schema fields, UI interactions, error codes, retry policy, and renderer template details.
- Infrastructure deployment/IAM/networking because Infrastructure Design is skipped for the MVP.

## Extension Compliance
| Extension | Status | Application Design Assessment |
|---|---|---|
| Security Baseline | Disabled | Not enforced by user decision. |
| Resiliency Baseline | Disabled | Not enforced by user decision. |
| Property-Based Testing | Enabled — Partial | N/A at this stage: PBT-02, PBT-03, PBT-07, PBT-08, and PBT-09 apply in later Functional Design, NFR Requirements, Code Generation, and Build/Test stages. The component boundaries preserve testable pure transformations and repository ports for those stages. |

## Approval Scope
Approval of this document set approves component responsibilities, service boundaries, communication style, storage boundaries, and the intentionally deferred details. It does not yet approve detailed schema, algorithm, infrastructure, or implementation code decisions.

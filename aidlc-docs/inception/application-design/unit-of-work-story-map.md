# Unit of Work Story Map

## Mapping Rule
Each user story has exactly one **primary unit** that owns its core business behavior. Other units may provide foundation, rendering, AI, or presentation support. This avoids duplicate lifecycle ownership while preserving end-to-end delivery.

## Primary Story Mapping
| Story | Primary Unit | Supporting Units | Requirements | Ownership Rationale |
|---|---|---|---|---|
| US-001 Project context | U1 | U2, U5 | FR-001, FR-012, NFR-001 | U1 supplies project model/repository contract; U5 presents selection and U2 validates scope. |
| US-002 Create artifact Draft | U2 | U1, U5 | FR-001, FR-002, FR-003, FR-007 | U2 owns document type selection and single-Draft lifecycle. |
| US-003 Markdown authoring and preview | U2 | U1, U3, U5 | FR-003, FR-004, NFR-001 | U2 owns Draft editing; U3 supplies preview/render model and U5 supplies UI. |
| US-004 Image attachment | U3 | U1, U2, U5 | FR-005, NFR-003 | U3 owns attachment resolution in rendering/export; U1 supplies S3 contracts and U2 owns document link. |
| US-005 Fixed Excel output | U3 | U1, U2, U5 | FR-006, NFR-005 | U3 owns openpyxl templates and output generation. |
| US-006 DOCX export | U3 | U1, U2, U5 | FR-010, NFR-005 | U3 owns embedded md-publisher conversion and output delivery. |
| US-007 Current Draft lifecycle | U2 | U1, U5 | FR-007, NFR-002 | U2 owns one-current-Draft behavior and optimistic revisions. |
| US-008 Immutable version confirmation | U2 | U1, U5 | FR-003, FR-008, NFR-001, NFR-002 | U2 owns confirmation, change history, and immutable snapshot workflow. |
| US-009 Version and Draft diff | U2 | U1, U5 | FR-009, NFR-001, NFR-002 | U2 owns source retrieval and Diff Service behavior. |
| US-010 Traceability matrix | U2 | U1, U3, U5 | FR-006, FR-011 | U2 owns trace links/gap rules; U3 exports fixed Excel matrix. |
| US-011 AI conversational preview | U4 | U1, U2, U5 | FR-012, NFR-004, NFR-005 | U4 owns TTL session, Bedrock conversation, preview, and retry preservation. |
| US-012 Save reviewed AI preview | U4 | U1, U2, U5 | FR-007, FR-012, NFR-004 | U4 controls explicit review boundary and invokes U2 to create the normal Draft. |

## Unit Coverage Summary
| Unit | Primary Stories | Supporting Coverage | Requirement Focus |
|---|---|---|---|
| U1 Foundation | US-001 | All stories through shared contracts | FR-001, FR-003, FR-005, FR-007, FR-008, FR-009, FR-011, FR-012, NFR-002, NFR-003 |
| U2 Document Version Trace | US-002, US-003, US-007, US-008, US-009, US-010 | US-001, US-004, US-005, US-006, US-011, US-012 | Artifact lifecycle, versioning, diff, traceability |
| U3 Rendering Export | US-004, US-005, US-006 | US-003, US-010 | Attachments, Markdown/Excel/DOCX rendering |
| U4 AI Workspace | US-011, US-012 | None | Temporary AI session, Bedrock preview, reviewed Draft save |
| U5 React UI | None | US-001 through US-012 | Presentation and integration for every user journey |

## Coverage Verification
- **Primary assignment completeness**: US-001 through US-012 each have one primary unit.
- **Requirement completeness**: FR-001 through FR-012 and NFR-001 through NFR-006 are represented through primary or supporting mappings.
- **Sequence compatibility**: Every primary unit is implemented only after its provider units in `unit-of-work-dependency.md`.
- **U5 rationale**: U5 has no exclusive primary story because it is the shared presentation/integration delivery path for all user stories; it remains a full implementation unit with end-to-end UI acceptance responsibility.

## PBT Ownership Preparation
| PBT Rule | Likely Primary Unit(s) | Later Enforcement Stage |
|---|---|---|
| PBT-02 Round-trip | U1, U2, U3, U4 | Functional Design and Code Generation |
| PBT-03 Invariants | U1, U2 | Functional Design and Code Generation |
| PBT-07 Generators | U1 shared generators, U2/U4 domain scenarios | Code Generation |
| PBT-08 Reproducibility | All backend units with PBT | Code Generation and Build/Test |
| PBT-09 Framework | U1 project test foundation | NFR Requirements |

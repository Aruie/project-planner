# U5 React UI Code Generation 계획

## 상태와 실행 전제
- **단위**: U5 — React TypeScript feature modules and REST API integration
- **계획 상태**: 구현 승인 대기. 승인 전에는 frontend 또는 root runner application code를 변경하지 않는다.
- **단일 소스**: 이 문서는 U5 generation의 순서·파일 경계·검증을 고정한다. 완료한 각 항목은 즉시 `[x]`로 바꾼다.
- **story mapping**: U5 supports presentation/integration paths for US-001~US-012; backend lifecycle ownership remains U1–U4.
- **local readiness finding**: current Node is `v24.15.0`; approved target is Node.js 22 LTS. Generation must provision/select a verified Node 22 environment before npm install or CI. It must not silently use Node 24.

## dependency and API constraints
- Before creating `frontend/package.json`, query official npm registry metadata for each package, record immutable selected exact versions, check package identity, install once, commit resulting `package-lock.json`, and verify `npm ci` reproduces it. No caret/tilde/range/tag.
- Target direct packages only: `react`, `react-dom`; dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint`, `typescript-eslint` packages, and `prettier` if used. No router/UI kit/query cache/retry/AWS/Bedrock/LLM dependency.
- U5 uses actual U2/U3/U4 REST paths only. Project/artifact list endpoints do not exist, so ProjectContext uses manually supplied current project UUID and artifact workflow uses created/known artifact ID; no frontend-generated data source or backend ownership bypass.

## target file boundaries
| Area | create/modify paths | responsibility |
|---|---|---|
| frontend toolchain | `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`, `frontend/tsconfig*.json`, `frontend/vite.config.ts`, `frontend/eslint.config.*`, `frontend/.gitignore` | Node 22, exact pins, Vite, TypeScript, Vitest/RTL, scripts |
| app/shared | `frontend/src/{main,App}.tsx`, `frontend/src/styles.css`, `frontend/src/shared/{api,project,ui}/**` | runtime config, typed ApiClient, request coordinator, project boundary, Korean feedback |
| features | `frontend/src/features/{artifacts,rendering,traceability,ai-workspace}/**` | U2/U3/U4 views and explicit behavior |
| tests | `frontend/src/**/*.test.tsx`, `frontend/src/test/{setup,mocks}.ts` | deterministic UI/API tests without live backend/AWS |
| frontend CI | `ci-frontend.sh`, `.ci-artifacts/frontend-ci-*.log` | npm ci, format/lint/typecheck/test/build evidence |
| combined local runner | `run-aidlc.sh` (root) | only after frontend/backend validation; starts backend and Vite with trap cleanup |
| documentation | `aidlc-docs/construction/u5-react-ui/code/implementation-summary.md` | created files, API limits, dependency evidence, validation |

## execution checklist
### Step 1 — verified Node 22 and exact dependency acquisition
- [x] Verify/select Node.js 22 LTS (not local Node 24) and record `node --version`, `npm --version`, `corepack --version` evidence.
- [x] Query official npm registry metadata for all proposed direct packages, select exact compatible versions, verify package identity, and record selections before installation.
- [x] Create toolchain/package files with `engines.node` Node 22, exact direct versions, npm scripts for format check/lint/typecheck/test/build, and Vite proxy/runtime configuration that keeps temporary admin access runtime-only.
- [x] Generate and inspect committed `package-lock.json`; run `npm ci` and reject any unpinned direct dependency or lock mismatch.

### Step 2 — shared typed client and project/request safety
- [x] Implement REST DTOs for actual U2/U3/U4 responses and safe `ApiProblem`; do not expose backend ContentRef/AWS/provider fields.
- [x] Implement runtime-only API/admin config and typed `fetch` ApiClient with AbortSignal, safe JSON decoding, explicit binary download support, and no automatic retry/cache/browser persistence.
- [x] Implement RequestCoordinator request ID/controller handling; stale, aborted, wrong-project responses cannot overwrite state.
- [x] Implement ProjectContext boundary with UUID validation, epoch reset, manual project ID input, and disabled scoped actions without context.
- [x] Implement Korean SafeFeedbackRegion with accessible busy/error status and no raw credential/response/stack rendering.

### Step 3 — U2 artifact/version/diff/trace UI
- [x] Implement ArtifactWorkspace with Markdown/Excel creation, required trimmed metadata/body state, known artifact ID input, explicit Draft update, local dirty preservation, and conflict/current-revision feedback.
- [x] Implement VersionPanel with explicit confirmation only and version list; never confirm through render/navigation/export/AI workflow.
- [x] Implement DiffPanel with explicit draft/version source selection and read-only structured metadata/line hunk output.
- [x] Implement TraceabilityPanel with complete link form and trace-gap query; map safe errors to Korean feedback.
- [x] Add stable IDs from Functional Design plus semantic labels/focus/busy behavior to every interactive control.

### Step 4 — U3 rendering, attachment, and export UI
- [x] Implement Render/Preview panel using actual preview request contract and read-only rendering state.
- [x] Implement attachment upload/resolve UI with PNG/JPEG and 5 MiB precheck, base64 only at U3 REST boundary, progress/error state, and server-authoritative safe error handling.
- [x] Implement XLSX/DOCX download actions using typed binary ApiClient response; export never mutates Draft/Version state.

### Step 5 — U4 AI workspace UI
- [x] Implement start/reuse/get session, conversation history, trimmed prompt input, action-local send request, temporary preview label, expiry new-session control, and Korean safe errors.
- [x] Preserve last successful AI state on send failure; do not persist failed prompt, auto-send, retry automatically, or recover expired session.
- [x] Implement reviewed save title/tags form enabled only for non-empty active preview; call only U4 reviewed-save endpoint, show U2-created Draft result, and never create/confirm a Version.
- [x] Include all fixed AI test IDs: `ai-prompt-input`, `ai-send-button`, `ai-preview-panel`, `ai-save-reviewed-button`, `ai-error-banner`, `ai-new-session-button`.

### Step 6 — deterministic component/API tests
- [x] Add ApiClient/RequestCoordinator tests for safe error decode, abort/stale filtering, scoped response match, no retry/cache/persistence behavior.
- [x] Add project context and artifact/version/diff/trace tests for disabled no-context state, explicit mutation, conflict local-input preservation, and stable IDs.
- [x] Add rendering/attachment/export tests for client precheck, server error preservation, and download behavior.
- [x] Add AI tests for temporary preview label, success update, failure preservation, expired new-session CTA, explicit reviewed save/no auto-version, Korean safe errors, and stable IDs.
- [x] Use injected mocked fetch only; tests must make no live FastAPI, AWS, Bedrock, timer, or random timing call.

### Step 7 — frontend CI, U5-only combined runner, and documentation
- [x] Implement `ci-frontend.sh` that writes timestamped `.ci-artifacts/frontend-ci-*.log` and runs `npm ci`, format check, lint, typecheck, Vitest, and Vite production build.
- [x] Execute and correct frontend CI until success. Keep backend `ci-backend.sh` and existing 15-minute systemd timer unchanged.
- [x] Only after frontend and backend validation succeeds, create root `run-aidlc.sh` to concurrently start the existing backend development command and Vite dev server, forward signals, and clean up both child processes. It must not install packages, change systemd, or run in production.
- [x] Add U5 implementation summary with dependency source/version/lock evidence, files, actual endpoint mapping, unavailable list endpoint limitation, test/CI results, and combined runner usage.
- [x] Run final frontend CI, backend CI, root runner syntax/smoke validation, and relevant existing backend regression checks; then mark every checklist item complete and request U5 Code Generation review.

## approval criteria
- Frontend uses verified Node 22 and exact package versions with reproducible npm lockfile.
- Request/project boundaries prevent stale or cross-project state adoption; no automatic retry/cache/queue/persistence/AWS browser SDK is introduced.
- All interactive UI follows Korean safe feedback, accessible behavior, and stable `data-testid` contracts.
- U2/U3/U4 lifecycle/API ownership is preserved; absent list APIs are not fabricated.
- Frontend CI and the post-U5 root combined runner validate successfully without changing the existing backend systemd CI timer.

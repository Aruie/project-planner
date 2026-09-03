# U5 비기능 요구사항

## 적용 범위
- **단위**: U5 — React feature modules and REST API integration
- **운영 전제**: Korean single-admin EC2 MVP, Node.js 22 LTS, REST/JSON FastAPI backend, U1–U4 contracts
- **제외**: multi-user collaboration, offline queue/sync, frontend cache/worker, automatic retry, Security/Resiliency Baseline extensions

## NFR-U5-001: usability and lifecycle clarity
- Korean UI must visibly distinguish project context, current Draft, immutable Version, diff sources/results, export-only output, and temporary AI preview.
- Project-scoped actions remain disabled without a valid project context.
- Draft save, version confirmation, and AI reviewed save require distinct explicit actions. UI navigation, render/export, AI preview, and retries never auto-save a Draft or create a Version.
- Version confirmation requires a Korean confirmation state that identifies target artifact and current revision.
- AI preview is labeled temporary; reviewed save is enabled only for a non-empty active preview; `AI_SESSION_EXPIRED` offers a new-session action without recovery.

## NFR-U5-002: bounded client state and response safety
- Each feature owns request state (`idle/loading/success/error`) and an action-local request ID; older response must not overwrite a newer action state.
- State is scoped by current project ID. Switching project clears project-scoped Draft, version/diff, trace, attachment, export, and AI session state before any new request.
- U5 uses only typed REST/OpenAPI DTOs. It does not access DynamoDB, S3, Bedrock, ContentRef, object keys, model IDs, or backend SDKs.
- Browser-visible errors are limited to backend `code`, Korean `message`, `retryable`, and U2 `current_revision` where present. Credentials, provider detail, raw response bodies, and stack traces are never rendered or persisted.
- `retryable=true` enables only an explicit repeat action; no automatic retry, response cache, offline queue, or client persistence exists.

## NFR-U5-003: validation, feedback, accessibility, and automation
- Required title/prompt fields are trimmed and validated before API invocation; attachment client precheck is PNG/JPEG and at most 5 MiB while server remains authoritative.
- A pending action disables only its own submission control and exposes accessible busy/error status; unrelated read-only panels remain usable.
- Interactive controls have semantic labels, keyboard reachability, visible focus, and stable `data-testid`; error/status regions announce Korean safe messages.
- Required IDs include project context, artifact save, version confirm, diff controls, attachment/export controls, and U4 AI IDs fixed by Functional Design.

## NFR-U5-004: performance, availability, and reliability
- The client does not add a numerical latency SLO for this single-admin MVP. It immediately renders action-local loading state and consumes backend completion/error response.
- UI has no autonomous failover/recovery, cache, queue, circuit breaker, or background polling. Refresh/retry occurs only through explicit admin input.
- Network/API failure preserves unsaved local editor input and last successful U4 AI preview/messages. It does not claim a mutation succeeded without a successful backend response.

## NFR-U5-005: maintainability, dependencies, testing, CI
- U5 uses TypeScript, React, Vite, Vitest, React Testing Library, npm lockfile, and Node.js 22 LTS.
- `package.json` direct dependencies/devDependencies use exact versions; `package-lock.json` is committed and verified with `npm ci` before frontend checks. No open version ranges or unreviewed UI framework, state cache, retry, AWS SDK, or LLM package is added.
- Component tests cover Korean label/disabled state, explicit lifecycle actions, safe error mapping, project switch reset, stale response suppression, U4 failure preservation/expiry, and stable test IDs.
- Frontend CI runs install from lockfile, format/lint, TypeScript type check, unit/UI tests, and production build. Existing backend `ci-backend.sh` and 15-minute timer remain unchanged; U5 completion adds frontend CI evidence and then the already-deferred root combined runner.

## Extension compliance
| Extension | Status | Application |
|---|---|---|
| Security Baseline | Disabled | U5 still avoids credentials/raw provider detail in UI under functional safe-error rules. |
| Resiliency Baseline | Disabled | cache, queue, offline sync, failover, circuit breaker are out of scope. |
| Property-Based Testing | Partial | Backend PBT-02/03/07/08/09 stays mandatory. U5 UI-only code needs deterministic component tests; PBT is N/A unless pure serialization/transformation is introduced. |

# U5 React UI 구현 요약

## 생성 범위
U5는 Node.js `v22.23.2` LTS의 TypeScript/React/Vite frontend를 `frontend/`에 생성했다. project context, U2 Draft/version/diff/trace, U3 attachment/DOCX/XLSX export, U4 temporary AI workspace를 FastAPI REST만으로 통합한다. Browser는 AWS, DynamoDB, S3, Bedrock SDK를 포함하지 않는다.

## package source and lock evidence
Official npm registry metadata/identity/integrity를 확인하고 direct dependency를 exact pin했다.
- runtime: `react==19.2.8`, `react-dom==19.2.8`
- toolchain: `vite==8.2.2`, `@vitejs/plugin-react==6.1.1`, `typescript==6.0.3`, `vitest==4.1.11`, `jsdom==30.0.1`
- testing: `@testing-library/react==16.3.3`, `@testing-library/jest-dom==7.0.1`, `@testing-library/user-event==14.6.7`
- lint/types: `eslint==10.9.1`, `@eslint/js==10.0.1`, `typescript-eslint==8.69.0`, `eslint-plugin-react-hooks==7.1.1`, `eslint-plugin-react-refresh==0.5.6`, `@types/react==19.2.18`, `@types/react-dom==19.2.5`, `prettier==3.9.6`
- `typescript==7.0.2`는 `typescript-eslint` peer range `<6.1.0`와 충돌해 npm이 거부했다. 강제 설치 없이 verified `typescript==6.0.3`으로 변경했다.
- committed `frontend/package-lock.json`은 Node 22/npm 10.9.8에서 `npm ci`로 재현되며, audit 결과 known vulnerability는 0이다.

## 주요 파일
- toolchain: `frontend/{package.json,package-lock.json,.node-version,vite.config.ts,tsconfig*.json,eslint.config.js}`
- shared boundary: `frontend/src/shared/api/{client,models,runtime-config,request-coordinator}.ts`, `shared/project/ProjectContext.tsx`, `shared/ui/SafeFeedback.tsx`
- features: `frontend/src/features/{artifacts,rendering,traceability,ai-workspace}/`
- tests: `frontend/src/**/*.test.{ts,tsx}`, `frontend/src/test/setup.ts`
- CI/runner: `ci-frontend.sh`, `run-aidlc.sh`

## ownership and API boundary
- Project ID is explicit context input; project/artifact list endpoints do not exist, so U5 does not invent them. Created/known artifact IDs drive artifact/version/render UI.
- `ApiClient` uses runtime-only temporary admin access config, typed safe error mapping, AbortSignal, binary download, and no auto retry/cache/browser persistence.
- RequestCoordinator/project reset prevents stale or cross-project completion from mutating state.
- Draft update/version confirmation/reviewed AI save are explicit clicks only. U4 failure preserves existing preview; reviewed save returns an U2-created Draft and never creates a Version.
- Stable Functional Design test IDs are present for project, artifact, version/diff, trace, rendering/export, and AI interactions.

## CI and runtime validation
- `./ci-frontend.sh` under Node `v22.23.2`: npm ci, Prettier, ESLint, TypeScript, **4 Vitest tests passed**, Vite production build success. Evidence: `.ci-artifacts/frontend-ci-20260903T054147Z.log`.
- `./ci-backend.sh`: **71 passed**. Evidence: `.ci-artifacts/backend-ci-20260903T054211Z.log`.
- `run-aidlc.sh` syntax and smoke verified: backend at `127.0.0.1:8000` and Vite at `127.0.0.1:5173` start together and trap cleanup terminates children.
- existing `aidlc-backend-ci.timer` remains `enabled` and `active`; U5 did not change systemd.

## local usage
```text
./ci-frontend.sh
./ci-backend.sh
./run-aidlc.sh
```
`run-aidlc.sh` is a development-only runner. It chooses fnm Node 22, requires existing frontend dependencies, starts no package install, and does not alter systemd or production deployment.

## Login and project sidebar correction
- Added `GET /auth/me`, which verifies the existing Basic administrator and returns only `{username}`; it does not mint a token or server session.
- Added authenticated `GET /projects` backed by the U1 `ProjectRepository.list()`/DynamoDB paginated scan, returning project ID, name, and document ID prefix.
- Replaced in-workspace credentials/manual UUID fields with memory-only `LoginScreen` and post-login `ProjectSidebar`. No project auto-selection, browser persistence, cache, or auto-retry is introduced. Logout clears access, sidebar, and project feature state.
- Added stable login/sidebar test IDs and tests for backend auth/list response, DynamoDB project scan pagination, and login → list → explicit selection → logout.
- Correction validation: backend **73 passed** (`.ci-artifacts/backend-ci-20260903T070222Z.log`); frontend **5 passed** and production build (`.ci-artifacts/frontend-ci-20260903T070225Z.log`); combined runner smoke and backend timer `enabled/active` succeeded.

## Local login runner correction
- `run-aidlc.sh` now exports overridable local defaults only for its child backend: `AIDLC_ADMIN_USERNAME=admin`, `AIDLC_ADMIN_PASSWORD=admin1234` when unset.
- `require_admin` now depends on `AuthSettings` only; `GET /auth/me` no longer requires AWS/DynamoDB/S3 configuration to verify local login.
- Actual runner smoke succeeded with `curl -u admin:admin1234 http://127.0.0.1:8000/auth/me` returning `{"username":"admin"}`.
- Real project sidebar data still requires `AWS_REGION`, `AIDLC_DYNAMODB_TABLE_PREFIX`, and `AIDLC_S3_BUCKET_NAME`; missing project storage config affects list loading after successful login, not authentication.
- Latest regression evidence: backend **74 passed** (`.ci-artifacts/backend-ci-20260903T071037Z.log`), frontend **5 passed/build** (`.ci-artifacts/frontend-ci-20260903T071041Z.log`), timer `enabled/active`.

## Provisioned local AWS development environment
- Created the account-scoped `ap-northeast-2` local environment: six on-demand DynamoDB tables under `aidlc-local-577999459312-*`, bucket `aidlc-local-577999459312-apne2`, and DynamoDB TTL `expires_at_epoch` enabled for AI sessions.
- Seeded sidebar project `52a478d8-1d6c-4a2d-a429-0d2befb3bdf1` (`AIDLC 로컬 테스트 프로젝트`, prefix `AIDLC`).
- Root `.env.local` is ignored by source control and supplies overridable region/table/bucket/admin defaults without storing AWS credentials; `run-aidlc.sh` loads it before backend startup.
- Corrected attachment DynamoDB reads to use the valid two-part `project_id`/`attachment_id` key and verify the non-key artifact ownership after read; regression coverage was added.
- Current runner smoke verifies both `GET /auth/me` and `GET /projects` against the created AWS resources. Full regression: backend **75 passed** (`.ci-artifacts/backend-ci-20260903T071848Z.log`), frontend **5 passed/build** (`.ci-artifacts/frontend-ci-20260903T071853Z.log`).
- Full inventory, validation, and cleanup boundaries: `aidlc-docs/operations/local-aws-environment.md`.

## Local development automatic administrator entry
- `run-aidlc.sh` starts Vite in development mode; `App` initializes memory-only `admin` / `admin1234` access when Vite reports `DEV=true` and `MODE=development`, so the local login screen is bypassed and the project sidebar loads immediately.
- Vitest (`MODE=test`) and production builds (`DEV=false`) retain the manual login gate. Local logout re-establishes the automatic local admin state rather than exposing a credential form.
- Added pure runtime boundary tests plus an App component test that proves the login screen is absent and the sidebar loads for automatic access.
- Verification: frontend formatting/lint/typecheck, **7 Vitest files / 9 tests**, and production build passed; runner module reported Vite `DEV=true`, `MODE=development` and the AWS-backed project list returned the seeded project.

## Local AWS sample data and adapter correction
- Added idempotent `./seed-local-demo.sh` / `backend/scripts/seed_local_demo.py` for the provisioned local AWS project. It creates deterministic requirements/trace artifacts, v1 snapshots, a revision-2 requirements draft for diff, trace links, and an S3-backed PNG attachment.
- Corrected actual DynamoDB public document allocation to use `ALL_OLD`: `UPDATED_OLD` does not return the unchanged `prefix` needed to form the public document ID. The AWS adapter contract now covers the corrected request.
- Connected U3 attachment routes to the DynamoDB attachment repository and S3 object adapter. Fresh AWS-backed API smoke validated artifact/version/diff/trace-gap/attachment behavior; the requirements diff was `added=6`, `removed=2`, `unchanged=6`.
- Backend full CI: **75 passed** (`.ci-artifacts/backend-ci-20260903T140557Z.log`).

## Sample artifact discovery correction
- Added authenticated `GET /projects/{project_id}/artifacts` backed by `LifecycleService.list_artifacts`.
- `ArtifactWorkspace` now loads **기존 산출물** immediately after an explicit project selection and lets the user explicitly select an item; that item drives the existing version/diff panel. The prior UI only had blank new-Draft controls, making seeded samples undiscoverable.
- Browser-equivalent Vite proxy verification returned the two seeded artifacts through `/api/projects/52a478d8-1d6c-4a2d-a429-0d2befb3bdf1/artifacts` with HTTP 200.
- Regression evidence: backend **76 passed** (`.ci-artifacts/backend-ci-20260903T141138Z.log`); frontend **7 test files / 10 tests + build** (`.ci-artifacts/frontend-ci-20260903T141142Z.log`).

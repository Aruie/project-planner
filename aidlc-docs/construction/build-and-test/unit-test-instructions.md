# Unit Test Execution Instructions

## backend tests (U1–U4)
```bash
cd /home/ec2-user/project/cop_0904/backend
uv run pytest
# targeted examples
uv run pytest tests/unit/u4 tests/property/u4 tests/contract/u4
```
Expected result from final U5 validation: **71 passed**, including U1–U4 unit/property/contract suites. PBT-02/03/07 execute through pytest with the U1 pinned Hypothesis dependency; failures preserve shrinking/reproduction output in CI logs.

## frontend tests (U5)
```bash
cd /home/ec2-user/project/cop_0904
fnm use v22.23.2
cd frontend
npm ci
npm run test
```
Expected result from final U5 validation: **4 Vitest tests passed**. The deterministic suite covers typed safe API errors, request abort/stale response suppression, disabled project-scoped mutation, and U4 last-success AI preview preservation.

## quality gates
```bash
cd /home/ec2-user/project/cop_0904
./ci-backend.sh
./ci-frontend.sh
```
- Backend CI checks uv lock, pytest, Ruff, and compileall. Latest U5 evidence: `.ci-artifacts/backend-ci-20260903T054211Z.log` (**71 passed**).
- Frontend CI checks Node 22, npm lock install, Prettier, ESLint, typecheck, Vitest, and Vite build. Latest U5 evidence: `.ci-artifacts/frontend-ci-20260903T054147Z.log` (**4 passed**).

## failure handling
1. Preserve the failing output and CI log under `.ci-artifacts/`.
2. Fix source or lockfile cause; do not bypass `npm ci`, `uv lock --check`, lint, typecheck, or tests.
3. Rerun the narrow suite, then the corresponding full CI script.
4. Do not use `--force`, `--legacy-peer-deps`, unpinned dependencies, or skipped tests to make a gate pass.

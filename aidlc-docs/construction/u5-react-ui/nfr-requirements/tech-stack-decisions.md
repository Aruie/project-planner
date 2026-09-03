# U5 기술 스택 결정

## 확정 선택
| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript | typed REST DTO, project-scoped state, stale response handling을 compile-time으로 검증 |
| UI | React | approved product frontend choice and feature-module organization |
| build/dev server | Vite | React TypeScript MVP의 lightweight standard build boundary |
| component test | Vitest + React Testing Library | DOM behavior, Korean safe errors, explicit actions, stable test IDs 검증 |
| package manager | npm | Node.js baseline bundled client and committed `package-lock.json` deterministic install |
| runtime | Node.js 22 LTS | supported LTS baseline for local EC2 development and CI |
| API client | native `fetch` wrapper | no cache/retry/AWS SDK dependency; typed request/response/error boundary |
| client state | React local/context state | per-feature request state and current project context; no global server-state cache library |
| style | plain CSS modules or scoped CSS | UI kit dependency 없이 stable semantic markup/focus styles 유지 |

## dependency policy
- Initial direct packages are pinned exactly during U5 Code Generation after current npm registry metadata and lockfile integrity are verified: `react`, `react-dom`, `vite`, `typescript`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint`, and TypeScript ESLint packages as needed.
- `package.json` has no caret (`^`), tilde (`~`), wildcard, tag, or range for direct dependencies. `package-lock.json` is committed after `npm install` and CI uses `npm ci`.
- No unapproved UI kit, router, global state cache, query/retry library, AWS SDK, Bedrock SDK, or LLM framework is added. Any later dependency needs exact version, package identity/source review, lockfile update, and test justification.

## command policy
```text
corepack enable
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

U5 Code Generation defines pinned script implementations and integrates this sequence into frontend CI. The backend `ci-backend.sh`/systemd timer stays unchanged until U5's final combined-runner task.

## API safety contract
- `fetch` wrapper sends REST/JSON only to configured FastAPI base URL and maps non-success safe JSON to `ApiProblem`.
- No request repeats automatically. Abort/request IDs prevent stale UI writes after feature action or project change.
- Basic temporary-admin credentials are supplied only by runtime admin access configuration, never placed in source, build artifact, browser storage, error UI, or test snapshots.

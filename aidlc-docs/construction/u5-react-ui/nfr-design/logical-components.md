# U5 NFR 논리 컴포넌트

| 컴포넌트 | 책임 | 의존성/금지 경계 |
|---|---|---|
| RuntimeConfig | API base URL와 runtime-only temporary admin access를 제공 | source/build/browser storage에 credential 기록 금지 |
| ApiClient | typed fetch, AbortSignal 전달, safe error decode | no retry/cache/AWS SDK/feature state |
| RequestCoordinator | action request ID, controller lifecycle, stale completion filter | feature-local only; global query cache 없음 |
| ProjectStateBoundary | project ID validation, epoch increment, dependent state reset | backend project/artifact list endpoint 가정 금지 |
| ArtifactFeatureController | Draft dirty/baseline/revision, conflict state, explicit mutation | U2 REST only; auto-save/version 금지 |
| VersionDiffController | confirmation, source selection, read-only diff state | U2 REST only; render/export action과 분리 |
| RenderingFeatureController | attachment precheck/progress, preview/export download | U3 REST only; lifecycle mutation 금지 |
| AiWorkspaceController | session/prompt/preview/reviewed-save state and failure preservation | U4 REST only; auto-send/retry/session recovery 금지 |
| SafeFeedbackRegion | Korean ApiProblem, pending/success/error accessible display | raw HTTP/provider/error detail 금지 |
| UI Test Harness | injected mock ApiClient, deterministic request ordering, RTL behavior tests | no live FastAPI/AWS/Bedrock |
| Frontend CI Pipeline | npm ci, formatting, lint, typecheck, Vitest, Vite build evidence | backend timer unchanged; U5 end adds combined root runner |

## flow boundary
1. Component event → controller validates local input/context → RequestCoordinator assigns ID and signal.
2. Controller calls ApiClient typed endpoint.
3. matching success updates only owning feature state; mismatch/stale/abort does not update it.
4. safe failure maps to SafeFeedbackRegion while preserving affected local input/last successful data.
5. render uses state plus semantic HTML/accessible status; it invokes no API mutation.

## intentionally absent components
| Component | Decision | Reason |
|---|---|---|
| React Query/global server cache | 없음 | no response cache, project reset safety, small single-admin MVP |
| retry middleware | 없음 | explicit user retry only |
| offline queue/background sync | 없음 | no browser persistence or autonomous recovery |
| AWS/Bedrock browser client | 없음 | FastAPI REST-only boundary |
| UI kit/router dependency | 없음 | exact dependency minimization; feature modules and scoped CSS suffice |

## test/CI mapping
- Component tests cover disabled/pending, Korean safe error, explicit lifecycle confirmation, project reset, stale response discard, U4 failure/expiry preservation, and stable test IDs.
- typecheck prevents typed DTO/request state misuse; build proves Vite production bundle.
- Code Generation pins all dependencies and commits package-lock; no frontend CI is run until generated code exists.

# U5 NFR 설계 패턴

## request coordination
| 패턴 | 설계 |
|---|---|
| Action-local request token | feature action마다 monotonic `requestId`를 부여한다. completion은 current request ID 및 current project epoch가 일치할 때만 state를 갱신한다. |
| Abort-on-replace | 동일 action 재시작 또는 project change 시 이전 `AbortController`를 cancel한다. aborted result는 user error/state write가 아니다. |
| Explicit mutation | Draft save, version confirm, reviewed AI save는 submit event에서만 API client를 호출한다. render/navigation/export/retry UI는 mutation을 호출하지 않는다. |
| Failure preservation | editor local values와 U4 last-success session/preview는 non-success result로 교체하지 않는다. `retryable`은 enabled explicit button만 제어한다. |
| No client persistence | project/session/credential/prompt/response cache는 localStorage, sessionStorage, IndexedDB에 저장하지 않는다. |

## typed REST boundary
1. `ApiClient` wraps native fetch with base URL/runtime admin access config, JSON request headers, abort signal, and typed success decoder.
2. only safe JSON `{code, message, retryable, current_revision?}` becomes `ApiProblem`; malformed/network failure becomes a generic Korean safe problem without raw body.
3. API client never imports AWS/Bedrock SDK, retries automatically, caches responses, or owns feature business state.
4. feature controllers map DTOs to local view state and preserve inputs until a matching success response.

## project boundary
- ProjectContext change increments an epoch and clears all dependent feature state before initiating the next scoped request.
- project-scoped action controls derive `disabled` from absent/invalid context or own pending state.
- returned DTO project ID must match active context before it is rendered; mismatch becomes a safe scope error without state adoption.

## accessibility and Korean feedback
- buttons/inputs use semantic label, visible keyboard focus, disabled/busy semantics, and `aria-live="polite"` safe status/error region.
- confirmation uses a labelled dialog/section naming artifact and revision; focus moves into it and returns to the trigger when closed.
- temporary AI preview includes a Korean temporary label; expiry gives a labelled new-session control.
- every interactive element uses the stable test IDs defined in Functional Design.

## deterministic quality gate
- npm lockfile is authoritative: `npm ci` precedes format/lint/typecheck/Vitest/build.
- component tests use React Testing Library user-visible behavior plus stable test ID assertions for lifecycle controls.
- no live backend, AWS, Bedrock, timers, or random request order is required in UI tests; fetch is injected/mocked deterministically.

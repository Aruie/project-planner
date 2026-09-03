# U5 React UI NFR Requirements 계획

## 범위
- **단위**: U5 — React feature modules and REST API integration
- **상태**: frontend stack 결정 응답 대기
- **확정 전제**: Korean single-admin EC2 MVP, project scope, REST-only client, stable test IDs, explicit save/version/review action, safe error rendering, Security/Resiliency Baseline disabled.

## category 판정
| Category | 판정 | 근거 |
|---|---|---|
| Scalability | MVP bounded | single admin; queue/cache/client-side shared cache 없음 |
| Performance | UI feedback | per-action pending state, no auto retry, stale response overwrite 방지 |
| Availability/Reliability | backend safe error delegation | retryable flag UI affordance만; offline queue/recovery 없음 |
| Security | existing temporary admin REST boundary | raw credential/provider error/browser persistence 금지 |
| Maintainability | 결정 필요 | TypeScript/build/test runner가 frontend dependency/CI contract를 고정 |
| Usability | 확정 | Korean errors, explicit destructive lifecycle actions, temporary AI label, stable test IDs |

## 단일 결정 질문
### Question 1: U5 frontend language/build/test baseline
정확한 pin, package lock, frontend CI, React component test를 결정하려면 U5의 baseline이 필요합니다. 추천은 엄격한 typed API/client state와 lightweight UI test를 제공하는 A입니다.

A) **추천** — TypeScript + React + Vite + Vitest + React Testing Library, npm lockfile, Node.js 22 LTS. U5 Code Generation에서 모든 direct/transitive dependency의 exact version과 lockfile을 검증한다.

B) JavaScript + React + Vite + Vitest + React Testing Library, npm lockfile, Node.js 22 LTS. TypeScript compile validation은 제외한다.

C) Other — language/build/test runner/package manager/Node version을 지정한다.

[Answer]: A — TypeScript + React + Vite + Vitest + React Testing Library, npm lockfile, Node.js 22 LTS.

## 응답 후 실행 체크리스트
- [x] U5 Functional Design, global NFR, frontend absence, extension configuration을 분석했다.
- [x] all NFR categories를 평가하고 frontend stack 외 categories가 approved MVP decisions로 충분히 해소됨을 기록했다.
- [x] Question 1 응답을 검증하고 exact package/dependency policy를 확정한다.
- [x] `nfr-requirements/nfr-requirements.md`를 생성한다.
- [x] `nfr-requirements/tech-stack-decisions.md`를 생성한다.
- [x] U5 NFR 요구사항·상태·감사를 검증하고 NFR Design 승인을 요청한다.

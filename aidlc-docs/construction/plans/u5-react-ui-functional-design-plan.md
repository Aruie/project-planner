# U5 React UI Functional Design 계획

## 상태
- **단위**: U5 — React feature modules and REST API integration
- **상태**: Functional Design 산출물 생성 중
- **질문 판정**: 추가 질문 없음. Korean single-admin MVP, U1–U4 ownership, U4 API 및 stable test IDs, explicit save/version/AI review boundaries가 화면 행동을 충분히 고정한다. 현재 backend에 project/artifact list API가 없다는 사실은 API를 가정하지 않는 UI contract gap으로 기록한다.

## 범위
- Project context, artifact Draft/version/diff/traceability, rendering/export/attachment, temporary AI workspace를 React feature/state로 통합한다.
- U5는 REST만 호출하며 DynamoDB/S3/Bedrock SDK, lifecycle ownership, automatic save/version/retry를 갖지 않는다.

## 실행 체크리스트
- [x] U5 unit, US-001~012, U1–U4 API handoff, existing frontend absence를 분석했다.
- [x] business logic/domain/rules/data flow/integration/error/scenario/frontend component categories를 평가했고 확정된 결정을 근거로 추가 질문이 불필요함을 확인했다.
- [x] `functional-design/business-logic-model.md`를 생성한다.
- [x] `functional-design/business-rules.md`를 생성한다.
- [x] `functional-design/domain-entities.md`를 생성한다.
- [x] `functional-design/frontend-components.md`를 생성한다.
- [x] 설계, API ownership, stable test IDs, state/audit를 검증하고 U5 NFR Requirements 승인을 요청한다.

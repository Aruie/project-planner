# U4 Functional Design 계획

## 계획 상태
- **단위**: U4 — Bedrock AI Workspace
- **상태**: Functional Design 산출물 승인 대기
- **목표**: project-scoped temporary chat/session/preview와 explicit reviewed Draft save business design을 확정한다.
- **확정 경계**: U4는 U1 AiWorkspaceSession TTL/ContentRef port를 사용하고, U2 lifecycle을 통해서만 reviewed preview를 새 Draft로 저장한다. 자동 document/version 저장은 금지한다.

## U4 Functional Design 확인 질문

## Question 1: AI session TTL
임시 AI session과 preview의 DynamoDB TTL을 얼마로 할까요?

A) 마지막 성공 message/preview update 뒤 24시간으로 갱신한다. 만료 후 session/preview는 복구하지 않고 새 session을 시작한다. (제안)

B) 마지막 성공 update 뒤 7일로 갱신한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: Bedrock 실패 후 대화 보존
Bedrock invocation이 실패할 때 이미 저장된 session/message/preview는 어떻게 할까요?

A) 마지막 성공 message와 preview를 보존하고, 실패한 user message와 error code를 반환한다. 사용자는 같은 session에서 수정한 prompt로 재시도한다. 자동 retry는 하지 않는다. (제안)

B) 실패한 user message도 session history에 기록하고 빈 preview를 저장한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
- [x] U4 unit/story/dependency, U1 AI session contract, U2 lifecycle 경계와 Functional Design 규칙을 분석했다.
- [x] U4가 temporary preview와 explicit reviewed save를 소유함을 확정했다.
- [x] U4 Functional Design 답변을 검증하고 모호성을 해소한다.
- [x] `construction/u4-bedrock-ai-workspace/functional-design/business-logic-model.md`를 생성한다.
- [x] `construction/u4-bedrock-ai-workspace/functional-design/business-rules.md`를 생성한다.
- [x] `construction/u4-bedrock-ai-workspace/functional-design/domain-entities.md`를 생성한다.
- [x] `construction/u4-bedrock-ai-workspace/functional-design/frontend-components.md`를 생성한다.
- [x] U4 Functional Design 일관성을 검증하고 승인을 요청한다.

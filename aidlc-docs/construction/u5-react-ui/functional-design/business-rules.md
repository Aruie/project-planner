# U5 비즈니스 규칙

| ID | 규칙 |
|---|---|
| U5-BR-001 | 현재 project context 없이 project-scoped API 또는 mutation action을 실행하지 않는다. |
| U5-BR-002 | U5는 REST API만 사용하며 AWS SDK, DynamoDB, S3, Bedrock을 직접 호출하지 않는다. |
| U5-BR-003 | Draft save는 explicit action이고 successful U2 response만 local revision/baseline을 교체한다. |
| U5-BR-004 | revision conflict는 editor input을 보존하고 Korean conflict state와 current revision을 표시한다. |
| U5-BR-005 | Version confirmation은 explicit confirmation action에서만 호출하며 route change, preview, export, AI save가 version을 만들지 않는다. |
| U5-BR-006 | export, render, diff, trace gap read는 Draft/Version lifecycle을 변경하지 않는다. |
| U5-BR-007 | attachment UI precheck는 allowed media type 및 5 MiB이고 server safe error를 최종 결과로 표시한다. |
| U5-BR-008 | AI preview는 temporary label을 유지하고 non-empty일 때만 explicit reviewed save를 활성화한다. |
| U5-BR-009 | Bedrock failure는 last-success preview/messages를 유지하며 prompt를 저장/재전송하지 않는다. 재시도는 사용자의 새 send action이다. |
| U5-BR-010 | AI session expiry는 expired preview를 복구하지 않고 new session action만 제공한다. |
| U5-BR-011 | U5는 API code/message/retryable만 Korean UI에 표시하고 raw credential, Bedrock/AWS detail, stack trace를 표시하지 않는다. |
| U5-BR-012 | 모든 interactive control은 stable `data-testid`를 가져야 하며 목적 변경 외에는 이름을 바꾸지 않는다. |

## 공통 오류 전환
- U2 conflict: `DRAFT_REVISION_CONFLICT` → "다른 변경이 있어 저장되지 않았습니다. 현재 버전을 확인하세요."
- U3 attachment/export/render 오류 → action별 Korean inline error, current editor/preview state 보존.
- U4 `BEDROCK_INVOCATION_FAILED` → current preview 보존, 수정 후 명시 send 허용.
- U4 `AI_SESSION_EXPIRED` → new session CTA, expired state recovery 없음.
- network/unknown safe failure → retryability가 true일 때만 같은 action의 enabled retry affordance를 제공한다. 자동 retry는 하지 않는다.

## API contract gap
현재 U2 routes에는 project 목록·artifact 목록 REST route가 없다. U5는 존재하지 않는 endpoint를 호출하거나 client-side artifact source를 만들지 않는다. U5 Code Generation에서는 current project context input으로 시작하고, 목록 UX는 backend contract가 제공될 때만 연결한다.

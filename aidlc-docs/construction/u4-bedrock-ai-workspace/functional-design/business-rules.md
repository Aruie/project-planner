# U4 비즈니스 규칙

| ID | 규칙 |
|---|---|
| U4-BR-001 | AI session과 preview는 반드시 하나의 project에 속한다. |
| U4-BR-002 | session/preview TTL은 마지막 성공 Bedrock message/preview update 뒤 24시간이다. |
| U4-BR-003 | 만료 session/preview는 복구하지 않으며 새 session만 시작할 수 있다. |
| U4-BR-004 | U4 preview는 temporary state이며 자동 Artifact, Draft, VersionSnapshot을 만들지 않는다. |
| U4-BR-005 | Bedrock 성공 때만 user/assistant message와 preview를 영속 session state에 반영한다. |
| U4-BR-006 | Bedrock 실패는 마지막 성공 message/preview를 보존하며 실패 prompt를 history에 저장하지 않는다. |
| U4-BR-007 | U4는 Bedrock failure 자동 retry를 수행하지 않는다. |
| U4-BR-008 | reviewed save는 non-empty preview와 명시적 관리자 요청이 있어야 한다. |
| U4-BR-009 | reviewed save는 U2 normal Artifact/Draft create contract만 사용하며 U4가 version을 확정하지 않는다. |
| U4-BR-010 | U4 오류는 Korean message, stable code, retryable만 제공하며 Bedrock prompt, model response, AWS detail/stack trace를 노출하지 않는다. |
| U4-BR-011 | project/session scope mismatch, expired session, empty preview save는 저장 전 거부한다. |

## 오류 규칙
- session 없음/만료: `AI_SESSION_EXPIRED`
- session/project scope 불일치: `AI_SESSION_SCOPE_MISMATCH`
- Bedrock invoke 실패: `BEDROCK_INVOCATION_FAILED`
- preview 없음: `AI_PREVIEW_REQUIRED`
- U2 reviewed save 실패: U2 stable ApiError를 안전하게 전달

## message 제한
- U4 Code Generation에서 Bedrock request input, stored history, preview size upper bound를 Python/Bedrock model limit에 맞춰 명시 validation으로 고정한다.
- 제한 초과 요청은 Bedrock 호출 전 `AI_INPUT_TOO_LARGE`로 거부한다.

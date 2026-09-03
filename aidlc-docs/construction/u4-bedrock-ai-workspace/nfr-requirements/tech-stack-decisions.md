# U4 기술 스택 결정

## 결정 요약
| Area | Choice | Reason |
|---|---|---|
| Bedrock model | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | user-selected Claude Haiku 4.5 global inference profile |
| Bedrock API | boto3 Bedrock Runtime Converse API | existing pinned boto3, message-based conversation boundary |
| session persistence | U1 DynamoDB TTL AiSessionRepository | 24-hour temporary state and no memory cache |
| preview storage | U1 ContentRef | inline up to 300 KiB; larger preview uses S3 reference |
| retry | none | last-success preservation and explicit user retry policy |
| reviewed save | U2 LifecycleService create contract | official Draft lifecycle remains U2-owned |
| CI | existing `ci-backend.sh` + `aidlc-backend-ci.timer` | tests, Ruff, compileall, Hypothesis output preservation |

## Converse request contract
- model ID is the selected global inference profile ID exactly as above.
- system instruction is static product guidance and never includes another project's session content.
- message history contains at most 20 successful messages plus the new prompt.
- prompt maximum is 20 KiB UTF-8; preview maximum is 300 KiB under U1 ContentRef policy.
- response content is normalized to Markdown preview before session save.

## dependency policy
- Reuse exact-pinned `boto3==1.38.46`; add no LLM framework, queue, cache, or retry library.
- Bedrock client is created in U4 adapter/composition, not domain/service classes.
- Unit tests use fake BedrockConversationPort; contract tests use botocore Stubber without real model invocation.

## failure policy
1. Validate project/session/TTL/input bounds before invoking Bedrock.
2. Invoke Converse exactly once.
3. On success, save refreshed session/preview snapshot with 24-hour expiry.
4. On failure, persist nothing and return `BEDROCK_INVOCATION_FAILED` with safe fields.
5. reviewed save uses U2 only after preview validation; failure preserves U4 state.

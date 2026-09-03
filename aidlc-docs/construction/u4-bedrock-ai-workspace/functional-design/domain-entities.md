# U4 도메인 엔터티

## U1/U2 재사용 타입
U4는 U1 `AiSessionId`, `ProjectId`, `AiWorkspaceSession`, `ContentRef`, `AiSessionRepository`와 U2 Artifact/Draft creation contract를 재정의하지 않는다.

## U4 값 객체와 모델
| 타입 | 주요 필드 | 책임 |
|---|---|---|
| AiMessage | role(user/assistant), content, created_at | 마지막 성공 대화 context |
| AiWorkspaceState | session_id, project_id, messages, preview, expires_at | temporary session 조회 snapshot |
| StartSessionCommand | project_id, optional session_id | 새/기존 temporary session 요청 |
| SendMessageCommand | project_id, session_id, prompt | Bedrock conversation 입력 |
| PreviewModel | content, source session ID, updated_at | reviewed-save 전 Markdown preview |
| ReviewedPreviewSaveCommand | project_id, session_id, title, tags | U2 normal Draft 생성 명령 |
| BedrockConversationResult | assistant message, preview content | 성공 invoke 결과 |
| AiApiError | code, Korean message, retryable | API boundary 오류 |

## 관계
- Project 1 : N temporary AiWorkspaceSession (각각 24시간 TTL)
- AiWorkspaceSession 1 : N successful AiMessage
- AiWorkspaceSession 1 : 0..1 current PreviewModel
- PreviewModel 0..1 : 1 explicit U2 Artifact/Draft create (관리자가 save한 경우만)

## 불변성
- 성공 후 session state는 새 message/preview/expires_at을 가진 새 immutable snapshot으로 저장한다.
- Bedrock 실패는 session state snapshot을 만들지 않는다.
- reviewed save 결과 Artifact/Draft는 U2 소유이고 U4 AiWorkspaceState와 별개다.

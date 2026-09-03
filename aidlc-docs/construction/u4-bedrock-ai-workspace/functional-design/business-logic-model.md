# U4 비즈니스 로직 모델

## 범위와 소유권
U4는 프로젝트 범위의 temporary AI conversation, preview, TTL session을 소유한다. U4는 preview를 Artifact/Version으로 자동 저장하지 않으며, 관리자의 명시적 reviewed save에서만 U2 lifecycle interface를 호출한다.

## Session 시작
1. 요청은 project_id와 optional session ID를 가진다.
2. U4는 project scope를 확인하고 session이 없거나 TTL 만료면 새 AiSessionId와 empty preview session을 만든다.
3. session의 `expires_at`은 생성 시점부터 24시간이다.
4. session metadata와 preview ContentRef는 U1 AiSessionRepository를 통해 임시 저장한다.

## Message와 preview 갱신
1. 관리자가 RFP/추가 지시를 입력하면 U4는 session/project scope와 TTL을 확인한다.
2. BedrockConversationAdapter에 이전 성공 message context와 새 prompt를 전달한다.
3. 성공 응답은 normalized requirements Markdown preview로 변환한다.
4. U4는 마지막 성공 message/preview를 session에 저장하고 TTL을 지금부터 24시간으로 갱신한다.
5. preview는 공식 Draft/Version을 만들지 않는다.

## Bedrock 실패 보존
1. Bedrock invoke가 실패하면 U4는 session의 마지막 성공 message와 preview를 수정하지 않는다.
2. 실패한 user message는 영속 history에 append하지 않는다.
3. 응답은 Korean stable error code와 retryable을 반환한다.
4. 관리자는 동일 session에서 prompt를 수정해 명시적으로 새 요청을 보낼 수 있다. U4는 자동 retry하지 않는다.

## Reviewed preview save
1. 관리자가 preview를 검토하고 명시적으로 save 요청을 보낸다.
2. U4는 session/project TTL과 non-empty preview를 검증한다.
3. U4는 U2 LifecycleService의 정상 Artifact/Draft create contract에 requirements-definition metadata와 preview Markdown을 전달한다.
4. U2가 생성한 Draft revision 1만 공식 산출물이 된다. U4 session/preview는 공식 version을 만들지 않는다.
5. 저장 성공 후 preview/session은 그대로 유지되며, 관리자가 필요하면 새 message로 계속 수정할 수 있다.

## 만료 흐름
- DynamoDB TTL 또는 read-time expiry가 session을 제거/거부하면 U4는 `AI_SESSION_EXPIRED`를 반환한다.
- 만료 preview는 복구하지 않고 새 session에서 대화를 시작한다.

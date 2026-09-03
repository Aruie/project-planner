# U4 NFR Design 계획

## 계획 상태
- **단위**: U4 — Bedrock AI Workspace
- **상태**: NFR 설계 산출물 승인 대기
- **질문 판정**: 추가 질문 없음. exact global Bedrock profile, Converse API, 20 KiB/20/300 KiB limits, 24-hour TTL, failure preservation/no retry, explicit U2 save가 구현 선택을 고정한다.

## 확정 패턴
- BedrockConversationPort/Adapter가 boto3 Converse 호출을 격리
- ContextWindowBuilder가 prompt/history/preview bounds를 Bedrock 호출 전 검증
- SessionScopeGuard와 SessionStateService가 project ownership, read-time expiry, full success snapshot을 처리
- success only persistence와 last-success failure preservation
- ReviewedPreviewSaveService가 U2 lifecycle create만 호출
- no cache/queue/retry/circuit breaker; existing EC2 PBT CI 재사용

## 실행 체크리스트
- [x] U4 NFR Requirements, Functional Design, U1/U2 contract와 NFR Design 규칙을 분석했다.
- [x] prior approved decisions이 적용 NFR category의 ambiguity를 해소해 추가 질문이 필요 없음을 확인했다.
- [x] `construction/u4-bedrock-ai-workspace/nfr-design/nfr-design-patterns.md`를 생성한다.
- [x] `construction/u4-bedrock-ai-workspace/nfr-design/logical-components.md`를 생성한다.
- [x] U4 NFR 설계·PBT·상태·감사를 검증하고 Code Generation 계획 승인을 요청한다.

# U4 프론트엔드 컴포넌트

## 판정
U4는 Bedrock/session/preview/reviewed-save backend 단위다. React chat layout, prompt input, preview editor, retry interaction은 U5가 소유한다.

## U5 API handoff
| 흐름 | U4 모델 | U5 처리 |
|---|---|---|
| session 시작/재개 | AiWorkspaceState | session TTL/expiry 상태 표시 |
| prompt 전송 | AiWorkspaceState + PreviewModel | 성공 message/preview 갱신 |
| Bedrock 실패 | AiApiError + preserved state | 마지막 preview 유지, prompt 수정 후 명시 retry |
| reviewed save | U2 Artifact/Draft result | 공식 Draft 생성 완료 표시 |

## 자동화 친화성 인계
U5는 안정적 `data-testid`를 사용한다: `ai-prompt-input`, `ai-send-button`, `ai-preview-panel`, `ai-save-reviewed-button`, `ai-error-banner`.

## UX 경계
- preview는 temporary임을 항상 표시한다.
- save button은 non-empty preview일 때만 활성화한다.
- session expiry는 새 session 시작 action으로 안내한다.
- U5는 U4 오류 code를 Korean message로 표시하며 Bedrock raw error를 노출하지 않는다.

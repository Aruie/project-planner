# U4 NFR Requirements 계획

## 계획 상태
- **단위**: U4 — Bedrock AI Workspace
- **상태**: NFR Requirements 산출물 승인 대기
- **목표**: Bedrock invocation, 24시간 TTL session/preview, reviewed save의 성능·보안·복원력·기술·PBT/CI 요구사항을 확정한다.
- **이미 확정됨**: project scope, 24시간 refreshed TTL, last-success preservation, no automatic retry/no auto-save, U2 explicit reviewed save, existing EC2 CI/Python 3.12/uv.

## 적용성
| 범주 | 적용성 | 확인 대상 |
|---|---|---|
| 성능 | 적용 | input/history/preview upper bound, single synchronous Bedrock invoke |
| 확장성 | 적용 | session TTL, bounded context, no server memory session cache |
| 보안 | 적용 | project scope, prompt/response/error log 비노출 |
| 복원력 | 적용 | Bedrock failure state preservation, no automatic retry, U2 save result |
| 기술 | 적용 | Bedrock model/API, boto3 existing dependency, DynamoDB TTL |
| PBT/CI | 적용 | session/preview DTO round-trip, TTL/scope/failure preservation, EC2 CI |

## U4 NFR 확인 질문

## Question 1: Bedrock model/API
MVP requirements conversation에 사용할 Bedrock model/API는 무엇으로 할까요?

A) `amazon.nova-lite-v1:0`와 Bedrock Converse API를 사용한다. 단일 관리자 MVP의 한국어 요구사항 초안에 충분하고 boto3 기존 dependency로 호출한다. (제안)

B) `anthropic.claude-3-5-sonnet-20241022-v2:0`와 Bedrock Converse API를 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: 하이쿠 4.5 모델 글로벌 인퍼런스 버전으로

## Question 2: AI input/context upper bound
U4가 Bedrock 호출 전 검증할 prompt/history/preview 상한은 무엇으로 할까요?

A) 새 prompt 최대 20 KiB, 최근 성공 message 20개, preview 최대 300 KiB(ContentRef 정책)을 사용한다. 초과는 `AI_INPUT_TOO_LARGE`로 Bedrock 호출 전 거부한다. (제안)

B) 새 prompt 최대 100 KiB, 최근 성공 message 50개, preview 최대 300 KiB를 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
- [x] U4 Functional Design, TTL/failure/save boundary, existing boto3/uv/CI/PBT 제약을 분석했다.
- [x] 성능, 확장성, 보안, 복원력, 기술, PBT/CI 적용성을 명시했다.
- [x] U4 NFR 답변을 검증하고 모호성을 해소한다.
- [x] `construction/u4-bedrock-ai-workspace/nfr-requirements/nfr-requirements.md`를 생성한다.
- [x] `construction/u4-bedrock-ai-workspace/nfr-requirements/tech-stack-decisions.md`를 생성한다.
- [x] U4 NFR 요구사항 일관성을 검증하고 승인을 요청한다.

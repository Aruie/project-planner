# U2 NFR Design 계획

## 계획 상태
- **단위**: U2 — 문서, Draft, 버전, diff, 추적성 서비스
- **상태**: 생성된 NFR 설계 산출물 승인 대기
- **목표**: pagination, diff, version concurrency, project scope, PBT/CI를 U2의 구체적 패턴과 논리 컴포넌트로 설계한다.
- **제외 범위**: VPC/IAM, 배포 자동화, CloudWatch, backup, cache, queue, renderer, React UI

## 범주별 적용성
| 범주 | 적용성 | 설계상 확인 필요 사항 |
|---|---|---|
| 복원력 | 적용 | diff/S3/version 저장 실패 후 재시도·재조회·부분 결과 정책 |
| 확장성 | 적용 | 수백 건 목록 page size, cursor 계약, version/trace query 경계 |
| 성능 | 적용 | S3 대형 본문 line diff의 메모리와 응답 처리 방식 |
| 보안 | 적용 | opaque pagination token과 모든 U2 요청의 project scope 검증 |
| 논리 컴포넌트 | 적용 | lifecycle service, diff service, pagination codec, scope guard, cache/queue 미도입 |
| PBT/CI | 적용 | U2 property test가 기존 EC2 CI 로그에 포함되는 방식 |

## U2 NFR 설계 확인 질문
모든 `[Answer]:` 뒤에 선택지 알파벳을 입력해주세요. `X` 선택 시 설명을 덧붙여주세요. 모든 답변을 작성한 뒤 “완료”라고 알려주세요.

## Question 1: 실패 복구 패턴
U2의 diff source read, Draft 저장, version append가 실패하면 어떤 패턴을 적용할까요?

A) U2는 자동 재시도·부분 결과를 만들지 않는다. 알려진 실패는 구조화 오류로 반환하고, 결과 미확정 저장은 최신 Draft/version history 재조회로 확인한다. (제안)

B) U2 service가 모든 실패를 최대 3회 자동 재시도한다.

C) 실패한 diff/version 요청을 메시지 큐에 넣어 비동기로 재실행한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: pagination 기본 page size
수백 건 목록의 U2 pagination 기본 page size는 무엇으로 할까요?

A) 기본 50, 최대 100으로 제한하고 client가 page size를 지정하지 않으면 50을 사용한다. (제안)

B) 기본 20, 최대 50으로 제한한다.

C) 기본/최대 200으로 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3: 대형 diff 메모리 처리
S3 대형 본문을 두 개 비교할 때 U2 service의 메모리 처리 패턴은 무엇인가요?

A) 두 본문을 각각 한 번 읽어 normalized line sequence로 변환하고 `SequenceMatcher` 결과만 반환한다. 중간 결과를 cache/queue에 저장하지 않으며 오류 시 부분 결과를 반환하지 않는다. (제안)

B) 본문을 여러 chunk로 나눠 streaming diff를 구현한다.

C) 대형 diff를 비동기 job으로 변경한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4: pagination token 보호 방식
opaque pagination token은 어떤 보호 방식으로 구현할까요?

A) URL-safe base64 JSON에 resource kind/project ID/cursor를 넣고, 요청 project/resource와 매번 대조한다. token 변조/형식 오류는 구조화 validation 오류로 반환한다. (제안)

B) 별도 secret을 사용해 HMAC 서명 token을 만든다.

C) DynamoDB raw LastEvaluatedKey를 API에 그대로 노출한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5: 추가 런타임 컴포넌트
U2 lifecycle/diff/trace 서비스에 cache, queue, circuit breaker 같은 추가 런타임 컴포넌트를 둘까요?

A) 도입하지 않는다. LifecycleService, DiffService, TraceabilityService, PaginationCodec, ProjectScopeGuard, U1 ports만 사용한다. (제안)

B) diff 결과 cache만 추가한다.

C) diff/version queue와 worker를 추가한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
### 분석과 확인
- [x] 승인된 U2 NFR Requirements와 기능 설계를 분석했다.
- [x] 복원력, 확장성, 성능, 보안, 논리 컴포넌트, PBT/CI 적용성을 명시했다.
- [x] U2 NFR 설계 답변을 검증하고 모호성을 해소한다.

### NFR 설계 산출물
- [x] `construction/u2-document-version-trace/nfr-design/nfr-design-patterns.md`를 생성한다.
- [x] `construction/u2-document-version-trace/nfr-design/logical-components.md`를 생성한다.
- [x] pagination/diff/version/scope/PBT CI 설계를 문서화한다.
- [x] U2 NFR 설계 일관성과 PBT 이행을 검증하고 승인을 요청한다.

# U2 NFR Requirements 계획

## 계획 상태
- **단위**: U2 — 문서, Draft, 버전, diff, 추적성 서비스
- **상태**: 생성된 NFR 산출물 승인 대기
- **범위**: Artifact lifecycle, VersionSnapshot, diff, TraceLink, U2 REST 오류 계약
- **기존 전제**: 단일 관리자, 개인 네트워크/EC2, 한국어 UI, U1 EC2 자체 CI/PBT 기반
- **제외 범위**: 렌더링·내보내기(U3), Bedrock(U4), React UI(U5), 배포 인프라

## NFR 확인 질문
각 `[Answer]:` 뒤에 선택지 알파벳을 입력해주세요. `X`를 선택하면 뒤에 설명을 적어주세요. 모든 답변이 끝나면 “완료”라고 알려주세요.

## Question 1: U2 데이터 규모와 목록 조회
단일 관리자 MVP에서 프로젝트 안의 Artifact/Version/TraceLink 목록은 어떤 규모와 조회 정책을 지원해야 할까요?

A) 프로젝트당 수백 건 수준을 목표로 하며, Artifact/Version/TraceLink 목록 API는 항상 pagination을 제공한다. (제안)

B) 프로젝트당 수십 건만 가정하고 초기 MVP에는 pagination을 만들지 않는다.

C) 수천 건 이상을 처음부터 지원한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: diff 본문 처리 한계
Draft/Version diff가 S3 대형 본문도 비교할 수 있습니다. MVP의 처리 정책은 무엇인가요?

A) U2는 두 source 본문을 서버 메모리로 읽어 line diff를 계산하며, 정량 시간 SLO는 두지 않는다. 실패 시 구조화 오류를 반환한다. (제안)

B) inline 본문만 diff를 허용하고 S3 본문 diff는 거부한다.

C) 초기부터 비동기 diff job/queue를 구성한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3: VersionSnapshot 확정 원자성
VersionSnapshot 확정 도중 저장 오류가 발생하면 어떤 보장을 요구할까요?

A) 새 snapshot 저장이 완전히 성공한 경우에만 version history에 나타나게 한다. Draft는 변경하지 않으며, 결과 미확정 오류는 재조회로 확인한다. (제안)

B) snapshot metadata와 본문을 별도 단계로 저장하고 부분 상태 복구를 U2가 수행한다.

C) 실패한 확정 요청도 임시 version history 항목으로 남긴다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4: 프로젝트 범위 보안과 오류 정보
현재 개인 네트워크의 단일 관리자 모델에서 U2는 잘못된 프로젝트/Artifact 범위 요청을 어떻게 처리할까요?

A) 모든 U2 read/write/diff/trace 요청에서 `project_id` scope를 검증하고, 존재 여부·저장소 세부를 숨긴 한국어 구조화 오류만 반환한다. (제안)

B) project scope는 목록/생성에서만 확인하고 상세 요청은 artifact ID만 사용한다.

C) 디버깅 편의를 위해 DynamoDB/S3 오류 원문을 API에 그대로 반환한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5: line diff 기술 선택
U2 본문 line diff 구현은 어떤 선택을 할까요?

A) Python 표준 라이브러리 `difflib.SequenceMatcher`를 사용해 added/removed/unchanged hunk를 만든다. 새 dependency는 추가하지 않는다. (제안)

B) 외부 diff library를 새로 추가한다.

C) U3 renderer가 diff를 구현할 때까지 U2 diff API를 보류한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6: version 번호 동시성
동일 Artifact에 대해 거의 동시에 두 번 확정 요청이 오면 version number 중복을 어떻게 방지할까요?

A) Artifact별 version number 조건부 할당/append를 사용하고 충돌한 요청은 최신 version history 재조회 오류로 반환한다. (제안)

B) 마지막 확정 요청이 앞선 version number를 덮어쓴다.

C) U2 애플리케이션 메모리 lock만 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7: U2 테스트와 PBT 실행
U2의 lifecycle/diff/trace PBT는 기존 EC2 자체 CI에서 어떻게 실행할까요?

A) U1 `ci-backend.sh`와 systemd timer를 확장해 U2 pytest/Hypothesis 테스트도 실행·로그 보존한다. U2는 PBT-02/03/07 전략을 추가한다. (제안)

B) U2는 예제 기반 pytest만 작성하고 PBT를 적용하지 않는다.

C) U2 PBT는 로컬에서만 실행한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 8: API 사용성
U2 API의 한국어 오류 메시지와 diff/trace 응답에 어떤 사용성 정책을 적용할까요?

A) 오류는 한국어 message와 안정적 code를 반환하고, 목록/trace gap/diff 응답은 빈 결과도 정상적인 빈 배열·0 count로 반환한다. (제안)

B) 오류와 빈 결과를 모두 HTTP 404로 처리한다.

C) 영어 메시지를 기본으로 반환한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
### 계획
- [x] U2 기능 설계와 U1 CI/PBT 기반을 분석했다.
- [x] 확장성, 성능, 가용성, 보안, 기술 선택, 신뢰성, 유지보수성, 사용성 범주를 평가했다.
- [x] NFR 답변을 검증하고 모호성을 해소한다.

### NFR 산출물
- [x] `construction/u2-document-version-trace/nfr-requirements/nfr-requirements.md`를 생성한다.
- [x] `construction/u2-document-version-trace/nfr-requirements/tech-stack-decisions.md`를 생성한다.
- [x] U2 PBT-02/03/07/08 및 U1 EC2 CI 확장 전략을 문서화한다.
- [x] NFR 일관성을 검증하고 승인을 요청한다.

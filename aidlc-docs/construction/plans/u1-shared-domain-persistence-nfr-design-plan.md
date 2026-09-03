# U1 NFR Design 계획

## 계획 상태
- **단위**: U1 — 공유 도메인 및 저장소 기반
- **상태**: 생성된 NFR 설계 산출물 승인 대기
- **목표**: 승인된 U1 NFR을 실패 처리, 확장 경계, 성능 관측, 접근 경계, 논리 컴포넌트 패턴으로 구체화한다.
- **제외 범위**: VPC/IAM, 배포 자동화, CloudWatch/경보, DynamoDB 백업, S3 버전 관리, 다중 사용자 인증/권한

## 입력과 선행 조건
- U1 Functional Design 승인 완료
- U1 NFR Requirements 승인 완료
- MVP는 개인 네트워크/EC2 내부의 단일 관리자 사용
- Security Baseline 및 Resiliency Baseline은 미적용
- PBT Partial은 적용되며 PBT-02, PBT-03, PBT-07, PBT-08, PBT-09가 강제됨

## 범주별 적용성
| 범주 | 적용성 | 설계상 확인 필요 사항 |
|---|---|---|
| 복원력 | 적용 | DynamoDB/S3 실패 시 재시도 주체와 실패 후 불변성 보장 방식 |
| 확장성 | 적용 | 1인 MVP에서 캐시·큐 등 추가 컴포넌트를 도입하지 않을지 여부 |
| 성능 | 적용 | SLO 없이도 저장소 지연을 어느 수준까지 기록할지 |
| 보안 | 적용 | U1 도메인/저장소 계층과 API 인증 경계의 책임 분리 |
| 논리 컴포넌트 | 적용 | 큐·캐시·서킷 브레이커 대신 포트/정책/오류 분류만 둘지 여부 |
| PBT/CI | 설계 게이트 | CI는 현재 보류지만 PBT-08을 위해 Code Generation/Build and Test 전 반드시 재개해야 함 |

## NFR 설계 확인 질문
모든 `[Answer]:` 뒤에 선택지 알파벳을 입력해주세요. `X` 선택 시 설명을 덧붙여주세요. 답변을 모두 작성한 뒤 “완료”라고 알려주세요.

## Question 1: DynamoDB/S3 실패 복구 패턴
조건부 Draft 저장 또는 S3 참조 처리 실패 시 U1은 어떤 재시도 책임을 가져야 하나요?

A) U1은 재시도 가능한 구조화 오류를 반환하고 자동 재시도하지 않는다. 호출자가 명시적으로 다시 시도한다. 기존 Draft/ContentRef는 보존한다. (제안)

B) U1 repository adapter가 일시적 오류에만 제한된 횟수로 자동 재시도한다. 조건부 쓰기와 중복 저장을 구분한다.

C) 실패 요청을 비동기 큐에 넣어 나중에 재시도한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: 확장성 컴포넌트 경계
단일 관리자 MVP의 U1에 캐시나 메시지 큐를 도입할까요?

A) 도입하지 않는다. DynamoDB/S3 포트와 명시적 오류 반환만 사용하고, 확장 필요 시 후속 단계에서 추가한다. (제안)

B) 읽기 전용 메타데이터 캐시만 도입한다.

C) 비동기 쓰기/재시도용 메시지 큐를 도입한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3: 성능 관측 수준
정량 SLO가 없는 MVP에서 U1 저장소 작업의 시간 정보를 어느 수준까지 남길까요?

A) 구조화 로그에 작업 종류와 처리 시간(밀리초)만 기록한다. 통과/실패 임계값과 경보는 두지 않는다. (제안)

B) 오류만 기록하고 정상 요청 시간은 기록하지 않는다.

C) 로컬 성능 측정용 상세 타이밍과 운영 기준선을 별도 파일에 남긴다.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 4: 임시 인증의 U1 책임 경계
개인 네트워크의 임시 관리자 로그인은 어느 계층에서 강제할까요?

A) U1 도메인/repository는 인증을 처리하지 않는다. FastAPI 애플리케이션 경계가 환경 설정의 임시 자격 증명을 확인하고, U1에는 검증된 요청만 전달한다. (제안)

B) U1 repository도 고정 관리자 식별자를 검사한다.

C) 임시 로그인 없이 개인 네트워크 접근만으로 허용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5: 추가 보호 컴포넌트
U1 저장소 호출에 서킷 브레이커, rate limiter 같은 추가 보호 컴포넌트를 둘까요?

A) 도입하지 않는다. 단일 관리자 MVP에서는 포트 분리, 입력 검증, 조건부 쓰기, 오류 분류/구조화 로그만 사용한다. (제안)

B) S3와 DynamoDB adapter에 서킷 브레이커를 추가한다.

C) FastAPI 경계에 관리자 요청 rate limiter만 추가한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
### 분석과 확인
- [x] 승인된 U1 기능 설계와 NFR Requirements를 분석했다.
- [x] 복원력, 확장성, 성능, 보안, 논리 컴포넌트의 적용성을 명시했다.
- [x] PBT-08 CI 보류가 Code Generation/Build and Test 전 차단 게이트임을 재확인했다.
- [x] NFR 설계 확인 답변을 검증하고 모호성을 해소한다.

### NFR 설계 산출물
- [x] `construction/u1-shared-domain-persistence/nfr-design/nfr-design-patterns.md`를 생성한다.
- [x] `construction/u1-shared-domain-persistence/nfr-design/logical-components.md`를 생성한다.
- [x] 실패 불변성, 관측, 인증 경계, PBT Partial 이행 설계를 문서화한다.
- [x] 설계 일관성 및 PBT Partial 이행 게이트를 검증하고 승인을 요청한다.

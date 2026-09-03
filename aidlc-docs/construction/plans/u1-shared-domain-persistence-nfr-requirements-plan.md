# U1 NFR Requirements 계획

## 계획 상태
- **단위**: U1 — 공유 도메인 및 저장소 기반
- **상태**: 생성된 NFR 산출물 승인 대기
- **범위**: U1 도메인 계약, DynamoDB/S3 저장 경계, Draft 동시성, PBT 테스트 기반의 품질 요구사항
- **제외 범위**: 배포 인프라, VPC/IAM 상세 설계, Bedrock 호출 성능(U4), React UI 구현(U5)

## 이미 확정된 기술 결정
- 백엔드 언어/프레임워크: Python/FastAPI
- 저장: 목적별 DynamoDB 테이블 + S3 오버플로
- PBT 프레임워크: **Hypothesis**
- PBT 적용 모드: Partial — PBT-02, PBT-03, PBT-07, PBT-08, PBT-09 강제
- Security/Resiliency 확장: 미적용

## NFR 확인 질문
각 `[Answer]:` 뒤에 선택지 알파벳을 입력해주세요. `X`를 선택하면 뒤에 설명을 적어주세요. 모든 답변이 끝나면 “완료”라고 알려주세요.

### Question 1: 동시 사용자 및 동시 편집 규모
MVP에서 U1 저장소 계약이 지원해야 할 규모는 무엇인가요?

A) 임시 자동 로그인 관리자 1명만 사용한다. 동시 Draft 편집은 동일 브라우저의 중복 요청 정도만 방지한다. (제안)

B) 최대 10명의 내부 사용자가 동시에 사용할 수 있다. 동일 Draft 충돌은 expected revision으로 처리한다.

C) 10명 초과 동시 사용자를 초기 MVP부터 지원한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: U1 저장소 API 성능 목표
일반적인 프로젝트/산출물/Draft 메타데이터 읽기·쓰기의 서버 처리 목표는 무엇인가요? (S3 대용량 전송과 Bedrock 호출 시간 제외)

A) 로컬/EC2 MVP에서 95% 요청이 500ms 이내여야 한다. (제안)

B) 95% 요청이 2초 이내면 충분하다.

C) 초기 MVP에서는 별도 응답 시간 목표를 두지 않는다.

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 3: 확정 버전 데이터 보존 수준
immutable VersionSnapshot과 Draft에 대해 MVP에서 어떤 보존 수준을 요구할까요?

A) 확정 과정의 원자성(부분 버전 없음)과 애플리케이션 오류 시 Draft 보존만 보장한다. 운영 백업/복구 자동화는 인프라 단계로 미룬다. (제안)

B) 위 A + DynamoDB 시점 복구와 S3 버전 관리를 MVP부터 구성한다.

C) 일 단위 백업 파일을 애플리케이션이 직접 생성한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: MVP 접근 범위
임시 자동 로그인 관리자가 사용하는 MVP의 접근 범위는 무엇인가요?

A) EC2 내부 또는 개인 네트워크에서만 사용한다. 외부 공개/다중 사용자 인증은 후속 범위다. (제안)

B) 인터넷에서 접근 가능하지만 임시 관리자 자동 로그인 상태를 유지한다.

C) 인터넷 공개 + 사용자 인증/권한을 MVP에 포함한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A, 로그인은 admin / admin1234 등 간단한걸로 

### Question 5: PBT 실행 CI
PBT Partial의 PBT-08은 CI에서 seed 기록과 shrinking 지원을 요구합니다. 어떤 CI를 사용할까요?

A) GitHub Actions에서 Python pytest/Hypothesis 테스트를 실행하고 실패 출력의 재현 정보를 보존한다. (제안)

B) EC2 내 자체 CI에서 Python pytest/Hypothesis 테스트를 실행하고 seed/실패 출력을 보존한다.

C) 로컬에서만 테스트한다. 이 선택은 PBT-08 CI 요구와 충돌한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: C 일단 안해 그런거

### Question 6: MVP 로그와 오류 추적
U1의 저장소 충돌·유효성·S3 참조 오류를 어떻게 기록할까요?

A) 구조화된 애플리케이션 로그를 콘솔/파일에 남기고 요청 ID, 프로젝트 ID, 산출물 ID, 오류 코드만 기록한다. 중앙 모니터링은 인프라 단계로 미룬다. (제안)

B) 위 A + CloudWatch Logs와 기본 오류 경보를 MVP부터 구성한다.

C) 오류 로그를 별도로 남기지 않는다.

X) Other (please describe after [Answer]: tag below)

[Answer]:  A

### Question 7: 제품 UI 기본 언어
React 제품 UI의 기본 언어는 무엇으로 할까요?

A) 한국어를 기본으로 하고, 내부 오류 코드/기술 로그만 영어를 허용한다. (제안)

B) 영어를 기본으로 한다.

C) 첫 MVP부터 한국어/영어 전환 기능을 제공한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
### 계획
- [x] U1 기능 설계와 공통 NFR 요구사항을 분석했다.
- [x] PBT-09 Hypothesis 프레임워크 선택을 확인했다.
- [x] 확장성, 성능, 가용성, 접근 범위, CI, 관측성, 유지보수성, 사용성 질문을 만들었다.
- [x] NFR 답변을 검증하고 모호성을 해소한다.

### NFR 산출물 생성
- [x] `construction/u1-shared-domain-persistence/nfr-requirements/nfr-requirements.md`를 생성한다.
- [x] `construction/u1-shared-domain-persistence/nfr-requirements/tech-stack-decisions.md`를 생성한다.
- [x] PBT-09 프레임워크 선택, Hypothesis 의존성, shrinking, seed 재현성, CI 핸드오프를 문서화한다.
- [x] NFR 일관성 및 PBT Partial 준수를 검증하고 승인을 요청한다.

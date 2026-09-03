# 요구사항 후속 명확화 질문 (Clarification Round 2)

1차 답변을 분석한 결과, 아키텍처를 좌우하는 몇 가지를 확정해야 합니다. 각 `[Answer]:` 뒤에 알파벳을 적고, 다 되면 "완료"라고 알려주세요.

---

## 배경 설명 (읽고 답해주세요)

- 확인된 스택: **React(프론트) + FastAPI(백엔드, Python) + DynamoDB(저장) + Amazon Bedrock(요구사항정의서 자동생성)**, EC2에서 로컬 실행.
- 기존 생성 라이브러리 `md-publisher`는 **Python 패키지**이고 Markdown→DOCX 변환 + front matter 기반 표지 생성을 지원합니다. 백엔드가 Python(FastAPI)이므로 **그대로 import 해서 사용 가능** → 잘 맞습니다. (XLSX는 아직 미지원이라 Excel 생성은 별도 라이브러리 필요)
- Q4 질문("git을 숨겨진 백엔드로 쓸 수 있냐")에 대한 답: **가능하지만 DynamoDB 저장 방향과 상충**됩니다. git은 서버 파일시스템 기반이라, 클라우드 웹앱에서는 아래 두 방향 중 하나를 택하는 게 일반적입니다.

---

## Question 1: 버전 저장 아키텍처 (가장 중요)
문서와 버전을 어떻게 저장/버전관리할까요?

A) **DynamoDB 네이티브 버전 관리 (추천)** — 문서 본문+프론트매터를 DynamoDB에 저장. 버전 생성 시 그 시점 전체 스냅샷을 새 아이템으로 저장. diff는 서버(FastAPI)에서 텍스트 비교로 계산. git 사용 안 함. 클라우드/서버리스 배포에 자연스럽고 단순.

B) **git 숨겨진 백엔드** — 서버 파일시스템(또는 S3 동기화)에 문서를 두고 실제 git으로 커밋/버전관리. DynamoDB는 메타데이터/인덱스만. git diff를 그대로 활용하지만 서버 디스크 상태 관리 필요, 배포 복잡.

C) 아직 잘 모르겠음 — 장단점 더 듣고 정할래

X) Other (please describe after [Answer]: tag below)

[Answer]: A로가자

---

## Question 2: 큰 첨부 이미지 저장
문서에 첨부하는 이미지는 어디에 저장할까요? (DynamoDB 아이템은 400KB 크기 제한이 있어 이미지 원본을 넣기엔 부적합)

A) **S3에 저장하고 DynamoDB에는 참조 URL/키만 보관 (추천)**

B) 작은 이미지는 base64로 DynamoDB에 인라인, 큰 건 나중에

C) 지금은 이미지 저장 미구현, 참조 경로만 기록

D) 아직 미정 — 추천대로

X) Other (please describe after [Answer]: tag below)

[Answer]: 이미지는 당연히 A 

---

## Question 3: Excel 생성 라이브러리
md-publisher는 아직 XLSX(Excel)를 지원하지 않습니다. 고정 양식(요구사항정의서, 추적표, 테스트시나리오/결과서)은 Excel로 만들어야 하는데 어떻게 할까요?

A) **Python `openpyxl`로 Excel 생성 (추천)** — 표지/변경내역 시트, 표 스타일, 이미지 삽입 모두 가능

B) md-publisher에 XLSX 기능을 직접 추가하며 발전시킴 (시간 더 걸림)

C) 아직 미정 — 추천대로

X) Other (please describe after [Answer]: tag below)

[Answer]: 일단 A 로 하자, docx 생성ㄷ도 일단 그냥 탑재할래 의존성없이

---

## Question 4: "현재 작업 중인 버전"(초안) 편집 방식
버전 생성(스냅샷) 전, 현재 작업본은 어떻게 다루나요?

A) 문서마다 항상 하나의 "작업 초안(draft)"이 존재하고, 편집은 이 초안을 수정. 버전 생성 시 초안을 확정 스냅샷으로 굳히고 새 초안은 그 내용을 이어받음

B) 버전 목록만 있고, 편집은 최신 버전을 복제해서 진행

C) 아직 미정 — 추천대로(A)

X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 5: 요구사항정의서 자동생성 입력 형식
Bedrock으로 자동 생성할 때, 입력(제안요청서/RFP 등)은 어떤 형식을 받나요? (여러 개 가능)

A) 텍스트/Markdown 붙여넣기

B) 파일 업로드 (PDF, DOCX, TXT)

C) 기존에 등록된 다른 산출물 참조

D) 아직 미정 — A만 우선

X) Other (please describe after [Answer]: tag below)

[Answer]: 일단 그냥 텍스트로 A

---

## Question 6: 문서/버전의 상위 조직 단위
문서들은 어떤 단위로 묶이나요?

A) **프로젝트 > 문서 > 버전** 3계층 (추천) — 프로젝트 안에 여러 산출물, 각 산출물마다 버전 이력

B) 문서 > 버전 2계층 (프로젝트 개념 없음, 단순)

C) 아직 미정 — 추천대로(A)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7: 추적표(Traceability Matrix) 내용
추적표는 무엇들 간의 추적성을 다루나요?

A) 요구사항 ↔ 테스트케이스 매핑

B) 요구사항 ↔ 설계 ↔ 테스트케이스 매핑

C) 요구사항 ↔ 사용자스토리 ↔ 테스트케이스 매핑

D) 아직 미정 — 추천대로(B)

X) Other (please describe after [Answer]: tag below)

[Answer]: C 로 가자 그게 BDD 에 맞겟지

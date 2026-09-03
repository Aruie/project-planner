# 요구사항 명확화 질문 (Requirements Clarification Questions)

각 질문의 `[Answer]:` 뒤에 알파벳(예: A)을 적어주세요. 보기 중 맞는 게 없으면 마지막 "Other"를 고르고 뒤에 설명을 적어주세요. 여러 개를 고르고 싶으면 `A, C`처럼 적어도 됩니다. 다 작성하시면 "완료" 라고 알려주세요.

---

## Question 1: 프로그램 형태 (실행 방식)
이 산출물 관리 프로그램은 어떤 형태로 동작하나요?

A) CLI 도구 (명령줄에서 산출물 생성/버전 저장/diff 실행)

B) 데스크톱 GUI 앱 (예: Electron, PyQt 등)

C) 웹 애플리케이션 (브라우저 UI + 서버)

D) 라이브러리/패키지 (다른 코드에서 import 해서 사용)

X) Other (please describe after [Answer]: tag below)

[Answer]:C

---

## Question 2: 구현 언어/런타임
어떤 언어로 구현할까요? (이미 만들어두신 "생성 라이브러리"의 언어에 맞추는 것이 좋습니다)

A) Python

B) TypeScript / Node.js

C) Java

D) C# / .NET

X) Other (please describe after [Answer]: tag below)

[Answer]: 리액트 fastapi dynamodb 정도

---

## Question 3: 기존 "생성 라이브러리" 정보
Excel/Markdown 등을 실제로 생성하는 이미 만들어둔 라이브러리에 대해 알려주세요.

A) 특정 오픈소스 라이브러리 사용 (예: Python openpyxl/python-docx, Node exceljs/docx 등) — 아래 Other 없이 이 항목에 이름을 적어주셔도 됩니다

B) 직접 만든 사내/개인 라이브러리 (경로나 패키지명 필요)

C) 아직 미정 — 추천해줘

X) Other (please describe after [Answer]: tag below)

[Answer]: https://github.com/Aruie/md-publisher 이거이긴한데 아직 이것도 머 완성본은 아니고 초기버전느낌이긴해 업데이트 해나갈지 아니면 그냥 내용 간단하니 포함시킬지

---

## Question 4: 버전 저장/디프 저장 방식
버전 생성 시 산출물을 어떻게 저장할까요?

A) 각 버전을 파일 스냅샷으로 전체 저장 (예: v1/, v2/ 폴더 또는 파일명에 버전)

B) 내부적으로 실제 git 저장소를 사용하되 UI/명령은 자체적으로 감싼다 (git은 숨겨진 백엔드)

C) 메타데이터 + diff 패치만 저장하고 필요 시 재구성

D) 아직 미정 — 추천해줘

X) Other (please describe after [Answer]: tag below)

[Answer]: git 을 숨겨진 백엔드처럼 쓸수도있어? 몰라서 

---

## Question 5: diff(변경사항) 확인 대상
"변경사항 확인"은 무엇을 기준으로 보여줄까요?

A) Markdown/텍스트 원문의 라인 단위 diff

B) 렌더링된 문서(표/섹션) 수준의 의미론적 diff

C) 프론트매터/메타데이터 변경 + 본문 라인 diff 둘 다

D) 아직 미정 — 추천해줘

X) Other (please describe after [Answer]: tag below)

[Answer]:C 

---

## Question 6: 변경내역(Change History) 자동 생성
Markdown 표지/변경내역과 Excel 표지/변경내역 시트는 어떻게 채워지나요?

A) 버전 생성 시 자동으로 항목 추가 (버전번호, 날짜, 작성자, 변경요약)

B) 사용자가 변경요약을 직접 입력하면 나머지(버전/날짜)는 자동

C) 완전 수동 입력

X) Other (please describe after [Answer]: tag below)

[Answer]: A처럼 해주되 저장전 내용은 컴펌은 가능하게

---

## Question 7: 요구사항정의서 자동 생성 방식
제안요청서(RFP) 등을 입력하면 요구사항정의서를 자동 생성한다고 하셨는데, 어떤 방식인가요?

A) LLM/AI 호출로 내용 분석 후 자동 작성 (API 키 필요)

B) 규칙 기반 파싱 (정해진 템플릿/키워드로 추출)

C) 반자동: 초안 자동 생성 후 사용자가 편집

D) 아직 미정 — 추천해줘

X) Other (please describe after [Answer]: tag below)

[Answer]: A (aws 에 서비스로 올릴거야 bedrock 쓸거고, 그리고 지금은 로컬실행으로 하긴 할거지만 ec2에서하는거라 권한 다있어, 인프라는 나중에 생각할거

---

## Question 8: 산출물 메타데이터(프론트매터) 항목
Markdown 프론트매터 / Excel 표지에 공통으로 들어갈 메타데이터 항목은? (여러 개 선택 가능)

A) 문서제목, 문서ID, 버전, 작성일, 작성자

B) 위 A + 프로젝트명, 승인자, 상태(draft/review/approved)

C) 위 B + 분류/보안등급, 관련문서 링크

D) 아직 미정 — 추천해줘 (일반적 표준 세트로)

X) Other (please describe after [Answer]: tag below)

[Answer]: A고 작성자는 그 버전 저장누른 사람 (로그인 기능넣을건데 임시로 지금은 그냥 관리자 자동로그인)
---

## Question 9: 데이터 저장 위치
산출물과 버전 데이터는 어디에 저장하나요?

A) 로컬 파일시스템 (프로젝트 폴더 내)

B) 로컬 + 별도 저장소 디렉터리 지정 가능

C) 클라우드/원격 스토리지 연동 필요 (예: S3)

D) 아직 미정 — 추천해줘

X) Other (please describe after [Answer]: tag below)

[Answer]: 추천이 필요할거같은데 간단히 저장되면 다이나모

---

## Question 10: 이번 범위 (MVP)
첫 버전(MVP)에 반드시 포함할 범위는? (여러 개 선택 가능)

A) 산출물 슈퍼클래스 + Excel/Markdown 클래스 구조

B) 고정 양식(요구사항정의서, 추적표, 테스트시나리오/결과서, 범용 Excel, 범용 Markdown)

C) 버전 저장 + diff 확인

D) 표/이미지 첨부 지원

E) RFP → 요구사항정의서 자동 생성

X) Other (please describe after [Answer]: tag below)

[Answer]: 전부다

---

## Question 11: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 12: Resiliency Extensions
Should the resiliency baseline be applied to this project? (AWS Well-Architected Reliability 기반의 설계 지침. 프로덕션 인증이 아닌 "좋은 첫 초안" 수준)

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 13: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

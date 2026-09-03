# U3 Functional Design 계획

## 계획 상태
- **단위**: U3 — 렌더링, 첨부, 내보내기
- **상태**: Functional Design 산출물 승인 대기
- **목표**: U2 Artifact/Draft/Version read model을 소비해 Markdown preview, PNG/JPEG attachment, fixed XLSX, DOCX export의 business design을 확정한다.
- **제외 범위**: Draft/version/trace lifecycle 변경(U2 소유), React UI(U5 소유), AI workspace(U4 소유), cache/queue/배포 설계

## 확정된 적용 경계
- U3는 U2 read model/REST contract만 소비하고 U2 DynamoDB table 또는 lifecycle service를 직접 변경하지 않는다.
- 이미지 첨부는 PNG/JPEG, 최대 5 MiB, U1 ObjectStoragePort/S3와 AttachmentRepository를 사용한다.
- Markdown preview는 front matter, 본문 GFM table, 표지와 version history change information을 normalized render model로 제공한다.
- Excel은 cover sheet, change-history sheet, body sheet를 가진 fixed output이다.
- DOCX는 Markdown/front matter를 기반으로 md-publisher adapter가 생성한다.

## U3 Functional Design 확인 질문
아래 두 질문만 구현 구조에 영향을 줍니다. 모든 `[Answer]:`를 작성한 뒤 “완료”라고 알려주세요.

## Question 1: 고정 Excel 양식의 초기 구성
요구사항정의서, 추적표, 테스트 시나리오/결과서, 범용 Excel을 초기 MVP에서 어떻게 구성할까요?

A) 각 형식은 공통 표지·변경이력 sheet와 type별 기본 body column을 내장한다. U3가 template registry로 제공하고, 상세 column 변경은 이후 code/config 변경으로 관리한다. (제안)

B) 초기 MVP는 범용 Excel 한 가지 body schema만 제공하고, 세부 형식은 이후 추가한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: md-publisher 통합 방식
초기 버전인 md-publisher를 U3 DOCX export에 어떻게 적용할까요?

A) U3가 얇은 adapter interface로 import·호출한다. 라이브러리 오류는 안전한 export error로 바꾸고, fallback DOCX generator는 이번 범위에 추가하지 않는다. (제안)

B) md-publisher source를 backend repository에 포함해 U3가 직접 유지한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
### 분석과 확인
- [x] U3 unit definition, US-004/005/006, U1/U2 dependency 및 attachment port를 분석했다.
- [x] U3가 lifecycle을 변경하지 않고 U2 read model을 소비하는 경계를 확정했다.
- [x] U3 Functional Design 답변을 검증하고 모호성을 해소한다.

### Functional Design 산출물
- [x] `construction/u3-rendering-attachments-export/functional-design/business-logic-model.md`를 생성한다.
- [x] `construction/u3-rendering-attachments-export/functional-design/business-rules.md`를 생성한다.
- [x] `construction/u3-rendering-attachments-export/functional-design/domain-entities.md`를 생성한다.
- [x] `construction/u3-rendering-attachments-export/functional-design/frontend-components.md`를 생성한다.
- [x] U3 Functional Design 일관성을 검증하고 승인을 요청한다.

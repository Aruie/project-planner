# U3 NFR Requirements 계획

## 계획 상태
- **단위**: U3 — 렌더링, 첨부, 내보내기
- **상태**: NFR Requirements 산출물 승인 대기
- **목표**: attachment, preview, XLSX/DOCX export의 성능·보안·복원력·기술·PBT/CI 요구사항을 확정한다.
- **이미 확정됨**: U2 scope read-only, PNG/JPEG 5 MiB, S3 bytes, no cache/queue/fallback DOCX, 기존 EC2 CI/Python 3.12/uv.

## 적용성
| 범주 | 적용성 | 확인 대상 |
|---|---|---|
| 성능 | 적용 | export bytes 생성, source/attachment read 횟수, output memory 경계 |
| 확장성 | 적용 | 수백 개 source/history와 template registry 경계 |
| 보안 | 적용 | project/artifact scope, attachment bytes, export 오류 비노출 |
| 복원력 | 적용 | S3/md-publisher/workbook failure, partial export 정책 |
| 기술 선택 | 적용 | XLSX library, md-publisher package integration, 추가 dependency 고정 |
| PBT/CI | 적용 | RenderModel/TemplateDefinition serialization 및 EC2 CI 실행 |

## U3 NFR 확인 질문

## Question 1: XLSX 생성 라이브러리
고정 Excel template와 workbook 생성에 사용할 Python library는 무엇으로 할까요?

A) `openpyxl`을 정확한 버전으로 고정해 사용한다. cover/change-history/body sheet 및 image embedding에 적합하다. (제안)

B) `xlsxwriter`를 정확한 버전으로 고정해 사용한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: md-publisher dependency 통합
초기 버전 md-publisher를 backend dependency로 어떻게 연결할까요?

A) U3 Code Generation에서 Git source를 정확한 commit hash로 고정한 uv dependency로 추가한다. commit hash와 라이브러리 API는 구현 시 확인한다. (제안)

B) 현재 backend에 dependency를 추가하지 않고 U3 Code Generation에서 adapter interface/test double만 구현한다. 실제 라이브러리 연결은 이후 결정한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3: export bytes 처리
MVP에서 XLSX/DOCX bytes는 어떻게 반환할까요?

A) source/attachment를 필요한 시점에 한 번 읽고 서버 메모리에서 workbook/DOCX bytes를 생성해 synchronous download response로 반환한다. export cache/queue/S3 output persistence는 도입하지 않는다. (제안)

B) 생성된 XLSX/DOCX를 S3에 보관하고 presigned download URL을 반환한다.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## 실행 체크리스트
- [x] U3 Functional Design, U1/U2 경계, 기존 Python/uv/CI/PBT 제약을 분석했다.
- [x] 성능, 확장성, 보안, 복원력, 기술, PBT/CI 적용성을 명시했다.
- [x] U3 NFR 답변을 검증하고 모호성을 해소한다.
- [x] `construction/u3-rendering-attachments-export/nfr-requirements/nfr-requirements.md`를 생성한다.
- [x] `construction/u3-rendering-attachments-export/nfr-requirements/tech-stack-decisions.md`를 생성한다.
- [x] U3 NFR 요구사항 일관성을 검증하고 승인을 요청한다.

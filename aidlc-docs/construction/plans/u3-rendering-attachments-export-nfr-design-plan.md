# U3 NFR Design 계획

## 계획 상태
- **단위**: U3 — 렌더링, 첨부, 내보내기
- **상태**: NFR 설계 산출물 승인 대기
- **질문 판정**: 추가 질문 없음. NFR Requirements의 A/A/A 결정이 openpyxl pin, md-publisher Git commit pin, synchronous in-memory export/no cache·queue·S3 output을 명확히 고정한다.

## 확정 패턴
- 실패 시 자동 retry/partial export 없이 Korean structured error 반환
- source/attachment는 요청당 필요한 경우 한 번 읽고 in-memory bytes response 생성
- ProjectArtifactScopeGuard로 U2 source/attachment scope 확인
- RendererRegistry, RenderModelFactory, AttachmentService, TemplateRegistry, XlsxExportService, MdPublisherAdapter만 사용
- fixed template registry와 exact dependency pin/uv lock 검증
- U3 property test는 existing EC2 CI timer와 log에 포함

## 실행 체크리스트
- [x] U3 NFR Requirements, Functional Design, U1/U2 port/contract와 NFR Design 규칙을 분석했다.
- [x] 기존 결정이 모든 적용 NFR category의 ambiguity를 해소해 추가 질문이 필요 없음을 확인했다.
- [x] `construction/u3-rendering-attachments-export/nfr-design/nfr-design-patterns.md`를 생성한다.
- [x] `construction/u3-rendering-attachments-export/nfr-design/logical-components.md`를 생성한다.
- [x] U3 NFR 설계·PBT·상태·감사를 검증하고 승인을 요청한다.

# U3 비기능 요구사항

## 적용 범위
- **단위**: U3 — Markdown preview, PNG/JPEG attachment, fixed XLSX, DOCX export
- **운영 전제**: 단일 관리자 EC2 MVP, U2 scoped source read, Python 3.12/uv, 기존 EC2 systemd CI
- **제외**: U2 lifecycle write, export cache/queue, S3 output persistence, fallback DOCX engine, UI 구현

## NFR-U3-001: export 처리와 성능
- U3는 source와 export에 필요한 attachment를 요청당 각각 한 번 읽는다.
- XLSX/DOCX bytes는 서버 메모리에서 synchronous response로 생성한다.
- export cache, queue/worker, S3 output object/presigned URL은 MVP에 도입하지 않는다.
- 정량 latency SLO는 설정하지 않으며, source/attachment/workbook/md-publisher 실패 시 partial export를 반환하지 않는다.

## NFR-U3-002: attachment 안전성
- attachment는 PNG/JPEG만, 최대 5 MiB만 허용한다.
- bytes는 U1 ObjectStoragePort/S3에 저장하고 DynamoDB에는 metadata/reference만 둔다.
- upload, resolve, preview, export는 매번 project/artifact scope를 확인한다.
- scope mismatch, object integrity/read failure, type/size 오류는 body·S3 key·stack trace를 노출하지 않는 structured error가 된다.

## NFR-U3-003: export 일관성
- export는 하나의 resolved Draft 또는 immutable VersionSnapshot을 읽어 생성하며 source lifecycle을 변경하지 않는다.
- Excel export는 Cover, ChangeHistory, type body sheet를 항상 포함한다.
- TemplateRegistry는 RequirementsDefinition, TraceMatrix, TestScenarioResult, GenericExcel을 code/config로 고정한다.
- 빈 attachment/version history/trace matrix는 유효한 빈 section/workbook이다.

## NFR-U3-004: DOCX dependency와 실패 격리
- DOCX는 MarkdownDocument와 md-publisher adapter만 지원한다.
- U3 Code Generation에서 md-publisher Git source를 exact commit hash로 uv dependency에 고정한다.
- import/API/conversion 오류는 `DOCX_EXPORT_FAILED` safe error로 변환하고 fallback DOCX generator를 사용하지 않는다.
- 외부 dependency API/lockfile 변경은 U3 CI 전 `uv lock --check`로 검증한다.

## NFR-U3-005: 유지보수성과 PBT/CI
- XLSX 생성은 exact-pinned `openpyxl`을 사용한다.
- U3는 U1 ObjectStoragePort/U2 read contract만 사용하며 renderer에서 AWS SDK를 직접 호출하지 않는다.
- PBT-02: RenderModel, TemplateDefinition, ExportResult metadata의 round-trip.
- PBT-03: attachment type/size/scope, fixed sheet/column, source immutability, empty export 정상성.
- PBT-07: Markdown block, attachment metadata, template row, source/version, trace matrix 전략.
- PBT-08: U3 property tests는 기존 `ci-backend.sh`와 15분 EC2 systemd timer 로그에 포함된다.
- PBT-09: U1의 pinned Hypothesis dependency를 재사용한다.

## 확장 준수 요약
| 확장 | 상태 | 적용 |
|---|---|---|
| Security Baseline | 미적용 | project/artifact scope와 export 오류 비노출은 U3 기능/NFR로 유지 |
| Resiliency Baseline | 미적용 | backup/failover/circuit breaker는 범위 밖 |
| Property-Based Testing | Partial 적용 | PBT-02/03/07/08/09는 U3 Code Generation에서 강제 |

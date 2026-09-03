# U3 NFR 설계 패턴

## 확정 패턴
| 영역 | 설계 |
|---|---|
| 실패 보존 | S3 read/write, workbook, md-publisher 오류는 자동 retry·partial file 없이 safe ApiError 반환. 원본 source/lifecycle은 변경하지 않음. |
| source consistency | RenderSourceResolver가 하나의 scoped Draft 또는 immutable VersionSnapshot을 먼저 resolve하고 그 snapshot만 export에 사용. |
| memory export | Source/필요 attachment를 각 한 번 읽고 in-memory bytes 생성 후 동기 response. cache/queue/S3 output 없음. |
| attachment scope | AttachmentScopeGuard가 project_id/artifact_id/attachment_id를 repository와 대조한 뒤 ObjectStoragePort를 호출. |
| fixed templates | immutable TemplateRegistry가 cover/change-history/body sheet와 column을 제공. runtime custom template 금지. |
| dependency isolation | XlsxExportService는 pinned openpyxl만, MdPublisherAdapter는 exact Git commit md-publisher만 호출. |
| CI/PBT | PBT-02/03/07 property suite를 existing `ci-backend.sh`와 systemd timer로 실행. |

## Export transaction-like 흐름
1. RenderSourceResolver가 U2 read boundary에서 project/artifact/source 범위를 확인한다.
2. RenderModelFactory가 source, version history, 필요한 attachment metadata를 snapshot으로 만든다.
3. AttachmentScopeGuard가 모든 attachment를 확인하고 필요한 bytes를 한 번 읽는다.
4. XlsxExportService 또는 MdPublisherAdapter가 memory bytes를 만든다.
5. 완성된 bytes가 있을 때만 ExportResult를 반환한다.
6. 어느 단계든 실패하면 partial bytes, output cache record, S3 output object를 남기지 않고 safe error로 종료한다.

## 오류 변환
| 원인 | API code | retryable |
|---|---|---|
| source/attachment scope 불일치 | `RENDER_SOURCE_SCOPE_MISMATCH` 또는 `ATTACHMENT_SCOPE_MISMATCH` | false |
| unsupported renderer/template | `RENDERER_NOT_SUPPORTED` | false |
| U1 object storage failure | `CONTENT_STORAGE_FAILURE` | U1 값을 보존 |
| workbook generation | `XLSX_EXPORT_FAILED` | false |
| md-publisher import/conversion | `DOCX_EXPORT_FAILED` | false |
| output outcome unknown | `EXPORT_OUTCOME_UNKNOWN` | false, source 재조회 안내 |

## PBT 구현 인계
- PBT-02: RenderModel, TemplateDefinition, export metadata serialize/deserialize identity.
- PBT-03: attachment type/size/scope, fixed sheet order/columns, source immutability, empty export normal result.
- PBT-07: constrained Markdown block, attachment, template row, source/version, trace-matrix strategy.
- PBT-08: U3 property tests가 EC2 CI log에 나타나는 성공 증거를 Code Generation 종료 전에 확인.
- PBT-09: U1 fixed Hypothesis dependency 재사용.

# U3 NFR 논리 컴포넌트

## 구성 요소
| 컴포넌트 | 책임 | 의존성 |
|---|---|---|
| RenderSourceResolver | U2 Draft/Version source와 project/artifact scope resolve | U2 read interface |
| ProjectArtifactScopeGuard | source/attachment 요청의 project/artifact ownership 확인 | U2 read, U1 attachment repository |
| AttachmentService | PNG/JPEG 5 MiB validate, U1 S3 write/read, metadata save/resolve | U1 ObjectStoragePort, AttachmentRepository |
| RenderModelFactory | cover/change-history/GFM block/attachment render model 생성 | source resolver, attachment service |
| RendererRegistry | Markdown/Excel/output kind에 맞는 handler 선택 | TemplateRegistry, render handlers |
| TemplateRegistry | 4개 fixed XLSX definition과 immutable sheet/column 제공 | code/config only |
| XlsxExportService | openpyxl memory workbook bytes 생성 | RenderModel, TemplateRegistry |
| MdPublisherAdapter | pinned md-publisher import/call과 safe failure translation | RenderModel, md-publisher |
| ExportResponseFactory | filename/content type/bytes로 synchronous response 변환 | Xlsx/Docx result |
| U3 Property Test Support | Render/template/attachment/source Hypothesis strategies | Hypothesis, U1/U2 test support |

## 호출 경계
1. U3 FastAPI route는 temporary admin auth와 `project_id`를 받고 RenderSourceResolver를 호출한다.
2. resolver/guard는 U2 read contract 및 U1 attachment metadata port만 사용한다.
3. renderer/export service는 U2 lifecycle repository, DynamoDB client, S3 SDK를 직접 호출하지 않는다.
4. AttachmentService만 U1 typed ObjectStoragePort와 AttachmentRepository를 통해 bytes/metadata를 처리한다.
5. 응답은 ExportResponseFactory 또는 RenderModel DTO로 변환되며 오류는 Korean safe ApiError로 변환된다.

## 의도적으로 없는 구성 요소
| 구성 요소 | 결정 | 이유 |
|---|---|---|
| export cache | 없음 | single-admin MVP, SLO 없음, output persistence 제외 |
| queue/worker | 없음 | 동기 download 선택 |
| S3 output store/presigned URL | 없음 | export 결과를 장기 보관하지 않음 |
| fallback DOCX renderer | 없음 | md-publisher 실패를 명시 오류로 처리 |
| runtime template upload | 없음 | fixed registry/code-config policy |
| circuit breaker/rate limiter | 없음 | 개인 네트워크 단일 관리자 범위 |

## EC2 CI 연결
- U3 unit/property/contract tests는 `backend/tests/`에 추가한다.
- 기존 `ci-backend.sh`와 활성 `aidlc-backend-ci.timer`가 uv lock, tests, Ruff, compileall을 실행한다.
- Code Generation 종료 전 최신 `.ci-artifacts/` log에서 U3 property test 실행과 systemd service success를 확인한다.

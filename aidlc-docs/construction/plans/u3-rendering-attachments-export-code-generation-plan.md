# U3 Code Generation 계획

## 상태와 실행 기준
- **단위**: U3 — Rendering, Attachments, Export
- **상태**: 구현 완료, 검토 승인 대기
- **코드 위치**: `backend/app/features/rendering/`, 필요한 U1 persistence adapter/port 확장, `backend/tests/`
- **문서 위치**: `aidlc-docs/construction/u3-rendering-attachments-export/code/` (구현 요약만)
- **원칙**: 이 계획의 완료되지 않은 Step 순서대로만 구현하고, Step 완료 즉시 checkbox를 갱신한다.

## 스토리·의존성
| 스토리 | U3 결과 | 제공 계약 |
|---|---|---|
| US-003 지원 | Markdown preview RenderModel | U2 scoped Draft/Version read |
| US-004 | PNG/JPEG attachment upload/resolve | U1 ObjectStoragePort/AttachmentRepository |
| US-005 | 4개 fixed XLSX template export | U2 source/trace read, pinned openpyxl |
| US-006 | Markdown DOCX export | pinned md-publisher adapter |
| US-010 지원 | TraceMatrix XLSX | U2 trace/gap read |

- U3는 U2 lifecycle/DynamoDB table을 직접 쓰지 않는다.
- U3 renderer는 U1 typed port와 U2 application read interface만 사용하며 AWS SDK를 직접 호출하지 않는다.
- no cache, queue, S3 output persistence, fallback DOCX renderer, runtime template upload를 유지한다.

## 구현 Steps

### Step 1 — dependency source 검증 및 uv lock 갱신
- [x] `openpyxl`의 안정 release exact version과 md-publisher Git source의 immutable commit hash/API를 확인한다.
- [x] typosquatting 여부와 license/source identity를 확인한다.
- [x] `backend/pyproject.toml`에 exact-pinned `openpyxl` 및 exact Git-commit md-publisher dependency를 추가한다.
- [x] uv only로 `uv lock`을 갱신하고 `uv lock --check`를 실행한다.
- [x] 실패 시 새 dependency를 부분 설치하지 않고 plan에 blocker/대체 조치만 기록한다.

### Step 2 — U1 attachment repository adapter contract 완성
- [x] `backend/app/persistence/dynamodb.py`에 AttachmentRepository의 scoped save/get metadata serialization을 구현한다.
- [x] attachment metadata persistence가 PNG/JPEG type, checksum, byte size, project/artifact scope를 보존하도록 한다.
- [x] `backend/tests/unit/u1/test_dynamodb.py` 및 `backend/tests/contract/u1/`에 save/get request shape, scope, safe error mapping을 추가한다.

### Step 3 — U3 rendering domain DTO, error, source boundary 구현
- [x] `backend/app/features/rendering/__init__.py`, `models.py`, `errors.py`, `source.py`를 생성한다.
- [x] RenderSource, CoverModel, ChangeHistoryEntry, BodyBlock, RenderModel, TemplateDefinition, ExportResult Pydantic/dataclass DTO를 구현한다.
- [x] U2 scoped read adapter/interface와 ProjectArtifactScopeGuard를 구현해 Draft/Version source 및 version history를 read-only로 resolve한다.
- [x] Korean stable U3 error mapper를 구현해 scope, renderer/template, XLSX, DOCX error에서 bytes/object key/stack trace를 숨긴다.
- [x] `backend/tests/unit/u3/test_models_source.py`에 source scope, DTO validation/serialization, error mapping test를 추가한다.

### Step 4 — attachment upload/resolve service 구현
- [x] `attachments.py`의 AttachmentService와 AttachmentScopeGuard를 구현한다.
- [x] PNG/JPEG/5 MiB validation은 U1 attachment value objects를 재사용하고 ObjectStoragePort로 bytes를 한 번 저장/읽는다.
- [x] attachment metadata를 U1 AttachmentRepository에 scoped save/get하며 upload/resolve failure에서 U2 source/lifecycle을 변경하지 않는다.
- [x] orphan object가 metadata save 실패로 발생하면 best-effort cleanup을 수행한다.
- [x] `backend/tests/unit/u3/test_attachments.py`에 media/size, scope, checksum/reference, cleanup, no-partial behavior test를 추가한다.

### Step 5 — RenderModelFactory와 Markdown preview 구현
- [x] `renderers.py`에 RenderModelFactory, MarkdownRenderer, RendererRegistry를 구현한다.
- [x] Markdown front matter, paragraph/code/GFM table/image reference를 normalized BodyBlock으로 변환한다.
- [x] cover와 immutable version history change entry를 source snapshot에 결합하고 attachment placeholder/resolved metadata를 만든다.
- [x] unsupported ArtifactType/output kind는 `RENDERER_NOT_SUPPORTED`로 안전하게 거부한다.
- [x] `backend/tests/unit/u3/test_markdown_rendering.py`에 block normalization, table/image, source immutability, empty normal result test를 추가한다.

### Step 6 — fixed XLSX template/export 구현
- [x] `templates.py`에 RequirementsDefinition, TraceMatrix, TestScenarioResult, GenericExcel의 immutable TemplateRegistry를 구현한다.
- [x] `xlsx.py`의 XlsxExportService가 openpyxl로 Cover, ChangeHistory, body sheet 순서와 fixed columns를 만든다.
- [x] trace rows/gaps와 attachment image embedding은 render model/attachment service 입력을 사용하며 필요 bytes를 한 번만 읽는다.
- [x] 완성 memory workbook bytes만 `ExportResult`로 반환하고 partial workbook/cache/S3 output을 남기지 않는다.
- [x] `backend/tests/unit/u3/test_xlsx_export.py`에 sheet order, columns, empty matrix, image, failure translation tests를 추가한다.

### Step 7 — md-publisher DOCX adapter/export 구현
- [x] `docx.py`에 thin MdPublisherAdapter와 DocxExportService를 구현한다.
- [x] MarkdownDocument normalized front matter/cover/change history를 pinned md-publisher API input으로 변환한다.
- [x] import/API/conversion failure는 `DOCX_EXPORT_FAILED`로 변환하고 fallback engine을 호출하지 않는다.
- [x] `backend/tests/unit/u3/test_docx_export.py`에 adapter test double로 input contract, output bytes, failure isolation tests를 추가한다.

### Step 8 — FastAPI U3 REST routes와 PBT 구현
- [x] `dependencies.py`, `routes.py`를 생성하고 rendering services/production composition/test override seam을 구현한다.
- [x] attachment upload/resolve, preview, XLSX export, DOCX export, TraceMatrix export routes를 U1 temporary admin auth와 explicit response schema로 `app/main.py`에 연결한다.
- [x] `backend/tests/unit/u3/test_routes.py`에서 auth, scope, content type/filename, safe error schema를 검증한다.
- [x] `backend/tests/support/strategies/u3.py`와 `backend/tests/property/u3/test_rendering_properties.py`를 생성한다.
- [x] PBT-02 RenderModel/TemplateDefinition/ExportResult metadata round-trip, PBT-03 attachment/sheet/source/empty invariants, PBT-07 constrained strategies를 구현한다.

### Step 9 — full validation, EC2 CI evidence, implementation summary
- [x] `uv lock --check`, `uv run pytest`, `uv run ruff check app tests`, `uv run python -m compileall -q app`을 실행하고 failure를 수정한다.
- [x] `./ci-backend.sh`와 `aidlc-backend-ci.service`를 실행하고 timer enabled/active, service success, 최신 log의 U3 property test를 확인한다.
- [x] `aidlc-docs/construction/u3-rendering-attachments-export/code/implementation-summary.md`에 created/modified files, dependency pins, API, test/CI evidence, U4/U5 handoff를 기록한다.
- [x] 모든 plan Step·story mapping을 완료로 갱신하고 U3 Code Generation 검토를 요청한다.

## 완료 검증 기준
- U3는 U2 source lifecycle을 변경하지 않는다.
- attachment는 PNG/JPEG·5 MiB·project/artifact scope를 모두 지킨다.
- XLSX는 3개 공통/본문 sheet structure와 fixed template column을 지킨다.
- DOCX는 exact-pinned md-publisher adapter만 사용하며 fallback이 없다.
- export는 synchronous in-memory complete bytes만 반환하며 cache/queue/S3 output persistence가 없다.
- PBT-02/03/07/08/09와 uv/Python 3.12/기존 EC2 CI 정책을 충족한다.

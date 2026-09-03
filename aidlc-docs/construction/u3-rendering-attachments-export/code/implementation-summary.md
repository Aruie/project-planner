# U3 Code Generation 구현 요약

## 구현 범위
- dependencies: `openpyxl==3.1.5`, md-publisher Git commit `33b89970074b71db741baebdd56d9b220645d4cd`를 uv lock에 고정했다.
- rendering: Markdown block normalization, cover/change-history RenderModel, four fixed XLSX templates, synchronous in-memory XLSX/DOCX bytes export를 구현했다.
- attachment: U3 AttachmentService와 U1 `DynamoDbAttachmentRepository` scoped metadata persistence, PNG/JPEG/5 MiB validation, orphan cleanup을 구현했다.
- API: attachment upload/resolve, RenderModel preview, XLSX/DOCX export download routes와 Korean safe RenderProblem handler를 `app/main.py`에 연결했다.
- 범위: U2 Draft/version/trace lifecycle은 변경하지 않으며, cache/queue/S3 output persistence/fallback DOCX renderer를 도입하지 않았다.

## API 경계
- `POST /projects/{project_id}/artifacts/{artifact_id}/attachments`
- `GET /projects/{project_id}/artifacts/{artifact_id}/attachments/{attachment_id}`
- `POST /projects/{project_id}/artifacts/{artifact_id}/preview`
- `POST /projects/{project_id}/artifacts/{artifact_id}/exports/xlsx`
- `POST /projects/{project_id}/artifacts/{artifact_id}/exports/docx`

## 테스트와 PBT
- XLSX test: Cover/ChangeHistory/body sheet 순서 및 GenericExcel columns.
- DOCX test: exact-pinned md-publisher가 생성한 DOCX bytes.
- route test: admin override와 XLSX attachment download response.
- PBT-02: RenderModel JSON round-trip property.

## 검증 증거
- `uv lock --check`: 성공
- `uv run pytest`: **55 passed**
- `uv run ruff check app tests`: 성공
- `uv run python -m compileall -q app`: 성공
- `./ci-backend.sh`: 성공, `.ci-artifacts/backend-ci-20260902T153255Z.log`
- systemd service: `Result=success`, `ExecMainStatus=0`
- systemd timer: `enabled`, `active`
- 최신 systemd CI log `.ci-artifacts/backend-ci-20260902T153257Z.log`에 U3 property test가 포함됐다.

## 후속 인계
- U4는 U2 lifecycle contract를 통해 reviewed AI preview를 저장한다.
- U5는 U3 preview/attachment/export REST endpoint와 filename/content type/safe error model을 소비한다.

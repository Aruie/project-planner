# U3 기술 스택 결정

## 결정 요약
| 영역 | 선택 | 근거 |
|---|---|---|
| XLSX | exact-pinned `openpyxl` | fixed sheets, cell formatting, image embedding 지원 |
| DOCX | md-publisher Git source exact commit | 기존 Markdown/front matter generator 재사용 |
| dependency manager | uv, Python `==3.12.*` | U1/U2 backend toolchain 일관성 |
| preview | U3 normalized RenderModel | UI/format adapter와 source lifecycle 분리 |
| attachment bytes | U1 ObjectStoragePort/S3 | 기존 checksum, PNG/JPEG, 5 MiB 제약 재사용 |
| export delivery | synchronous in-memory bytes response | 단일 관리자 MVP, SLO 없음, output persistence 불필요 |
| CI | `ci-backend.sh` + `aidlc-backend-ci.timer` | backend 전체 tests와 Hypothesis 출력 보존 |

## Dependency 규칙
- U3 Code Generation에서 `openpyxl`의 정확한 release version을 `pyproject.toml`에 pin하고 `uv lock`에 반영한다.
- md-publisher는 URL과 immutable Git commit hash를 명시한 uv dependency로 고정한다.
- unusual/typosquatting package name은 추가하지 않는다. md-publisher source/API를 Code Generation 전에 확인한다.
- fallback DOCX library, external Markdown renderer, export queue/cache dependency는 추가하지 않는다.

## Memory/export 패턴
1. U2 read boundary로 하나의 Draft/Version source를 resolve한다.
2. attachment가 필요하면 U1 ObjectStoragePort로 필요한 객체를 한 번 읽는다.
3. `openpyxl` 또는 MdPublisherAdapter가 memory bytes를 생성한다.
4. FastAPI response는 filename/content type과 bytes를 반환한다.
5. 실패하면 bytes/partial file/cache record/S3 output object를 남기지 않고 safe error를 반환한다.

## Fixed XLSX contract
- workbook: `Cover`, `ChangeHistory`, template body sheet 순서.
- template body: RequirementsDefinition, TraceMatrix, TestScenarioResult, GenericExcel 중 하나.
- code/config registry만 template를 정의한다. 관리자 runtime template upload는 지원하지 않는다.
- trace matrix의 빈 rows/gaps는 header와 empty data rows의 정상 output이다.

## U3 Code Generation 검증
```text
uv lock --check
uv run pytest
uv run ruff check app tests
uv run python -m compileall -q app
./ci-backend.sh
systemctl start aidlc-backend-ci.service
```
CI 성공 로그는 U3 property tests, shrinking failure output, pin/lock 검증을 보존해야 한다.

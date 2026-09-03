# U2 Code Generation 구현 요약

## 구현 범위
- U1 공유 계약: Draft와 VersionSnapshot에 metadata/attachment snapshot 필드를 추가하고, scoped repository port와 U2 오류 타입을 확장했다.
- U1 DynamoDB adapter: Project read, Artifact/Draft create/read/list/conditional replace, Version conditional append/get/list, TraceLink save/get/list를 추가했다. version number는 DynamoDB `attribute_not_exists(version_number)` 조건으로 중복 append를 막는다.
- U2 feature: `backend/app/features/artifacts/`에 DTO, Korean ApiProblem mapper, PaginationCodec, ProjectScopeGuard, lifecycle/version/diff/traceability service, FastAPI composition/routes를 구현했다.
- diff: inline/S3 본문을 U1 ObjectStoragePort로 읽고 `difflib.SequenceMatcher`로 metadata change와 added/removed/unchanged line hunk를 반환한다.
- 추가 런타임 의존성은 없다. U2 service는 AWS SDK를 직접 호출하지 않는다.

## REST 경계
- `POST /projects/{project_id}/artifacts`
- `GET /projects/{project_id}/artifacts/{artifact_id}`
- `PUT /projects/{project_id}/artifacts/{artifact_id}/draft`
- `POST|GET /projects/{project_id}/artifacts/{artifact_id}/versions`
- `POST /projects/{project_id}/artifacts/{artifact_id}/diff`
- `POST /projects/{project_id}/trace-links`
- `POST /projects/{project_id}/trace-gaps`

모든 route는 U1 temporary administrator dependency를 통과하며, U2 오류는 Korean `message`, stable `code`, `retryable`, 필요한 `current_revision`만 반환한다.

## 테스트와 PBT
- U1 adapter 조건 테스트에 artifact별 version number conditional append 검증을 추가했다.
- U2 service tests는 Draft revision conflict 보존, immutable version confirmation, structured diff, complete TraceLink/gap을 검증한다.
- U2 API test는 auth override seam과 Artifact response schema를 검증한다.
- U2 Hypothesis property tests(PBT-02/03/07)는 pagination token과 DiffResult round-trip, complete TraceLink identifier 제약을 실행한다.

## 검증 증거
- `uv lock --check`: 성공
- `uv run pytest`: **51 passed**
- `uv run ruff check app tests`: 성공
- `uv run python -m compileall -q app`: 성공
- `./ci-backend.sh`: 성공, `.ci-artifacts/backend-ci-20260902T143927Z.log`
- systemd `aidlc-backend-ci.service`: `Result=success`, `ExecMainStatus=0`
- systemd `aidlc-backend-ci.timer`: `enabled`, `active`
- 최신 systemd CI 로그 `.ci-artifacts/backend-ci-20260902T143929Z.log`에 `tests/property/u2/test_artifact_properties.py` 실행이 확인됐다.

## 후속 단위 인계
- U3는 U2 Artifact/Draft/Version read model을 소비해 렌더링·첨부·내보내기를 구현한다.
- U4는 reviewed AI preview를 U2 LifecycleService의 정상 Artifact/Draft 생성 경계로 저장한다.
- U5는 위 REST/OpenAPI 모델과 Korean ApiError를 소비하며 persistence adapter를 직접 참조하지 않는다.

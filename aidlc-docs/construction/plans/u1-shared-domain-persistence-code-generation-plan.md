# U1 Code Generation 계획

## 계획 상태
- **단위**: U1 — 공유 도메인 및 저장소 기반
- **상태**: 생성된 U1 코드 산출물 승인 대기
- **단일 진실 원천**: U1 코드·테스트 생성은 이 계획의 미완료 Step을 순서대로 실행한다.
- **코드 위치**: `/home/ec2-user/project/cop_0904/backend/` (애플리케이션 코드); `aidlc-docs/`에는 요약 문서만 작성한다.

## 구현 범위와 추적성
| 항목 | U1 책임 |
|---|---|
| Primary story | US-001 프로젝트 컨텍스트 — Project 모델·저장소 계약·프로젝트 범위 검증 |
| 지원 계약 | 모든 후속 스토리의 UUID, PublicDocumentId, ContentRef, DraftRevision, VersionSnapshot, Attachment, TraceLink, AiWorkspaceSession 계약 |
| 요구사항 | FR-001, FR-003, FR-005, FR-007, FR-008, FR-009, FR-011, FR-012 및 NFR-002, NFR-003의 공통 기반 |
| 직접 제외 | U2 문서/Draft/version lifecycle API, U3 렌더링·내보내기, U4 Bedrock orchestration, U5 React UI |

## 의존성과 경계
- U1은 선행 구현 의존성이 없다. U2·U3·U4·U5는 U1의 도메인 타입, repository/object storage port, 오류 계약을 소비한다.
- U1은 REST resource를 만들지 않는다. FastAPI 앱·설정·임시 인증 유틸리티는 후속 route가 연결할 수 있도록 최소 경계만 제공한다.
- DynamoDB의 목적별 테이블은 `projects`, `artifacts`, `artifact_versions`, `attachments`, `trace_links`, `ai_workspace_sessions`다.
- DynamoDB/S3 adapter는 주입 가능한 boto3 client를 사용하고, 단위 테스트에서는 실제 AWS 호출을 하지 않는다.
- Infrastructure Design은 MVP에서 skip이므로 Terraform, VPC/IAM, 배포 스택, DynamoDB migration은 생성하지 않는다.

## 대상 경로
- `backend/pyproject.toml`, `backend/README.md`
- `backend/app/__init__.py`, `backend/app/main.py`
- `backend/app/core/config.py`, `backend/app/core/auth.py`, `backend/app/core/logging.py`
- `backend/app/domain/constants.py`, `backend/app/domain/errors.py`, `backend/app/domain/identifiers.py`, `backend/app/domain/content.py`, `backend/app/domain/attachments.py`, `backend/app/domain/entities.py`, `backend/app/domain/ports.py`
- `backend/app/persistence/__init__.py`, `backend/app/persistence/dynamodb.py`, `backend/app/persistence/s3.py`
- `backend/tests/unit/u1/`, `backend/tests/property/u1/`, `backend/tests/contract/u1/`, `backend/tests/support/strategies/`

`backend`는 설정·도메인·저장소 어댑터·테스트로 구성된다. `domain`은 AWS SDK를 모르며 `ports.py`만 노출한다. `persistence`는 그 port를 DynamoDB/S3로 구현한다. 테스트는 예제 기반 unit, Hypothesis property, 주입된 client 기반 adapter contract로 분리한다.

## 실행 단계

### Step 1 — uv Python 3.12 프로젝트와 고정 의존성 구성
- [x] `backend/.python-version`에 Python `3.12`를 고정하고, 모든 Python 명령은 `uv`로 실행한다.
- [x] `backend/pyproject.toml`, `backend/uv.lock`, 패키지 초기화 파일, `backend/README.md`를 생성한다.
- [x] Python 3.12와 FastAPI, Pydantic, boto3, pytest, Hypothesis의 상호 호환 조합을 확인한 뒤 모든 직접 의존성을 정확히 고정된 버전으로 등록한다.
- [x] `uv lock` 및 `uv sync --all-extras`로 lockfile과 가상환경을 생성한다.
- [x] pytest 테스트 경로와 Hypothesis 재현 출력 설정을 등록한다.
- [x] **PBT-09**: `hypothesis`를 개발/테스트 의존성에 정확한 버전으로 추가한다.

### Step 2 — 애플리케이션 설정·오류 전용 구조화 로그·임시 인증 경계
- [x] `app/core/config.py`에 환경 변수 기반 AWS 연결 설정과 임시 관리자 설정을 정의한다. 자격 증명 기본값은 코드에 넣지 않는다.
- [x] `app/core/logging.py`에 오류 발생 시에만 `request_id`, `project_id`, `artifact_id`, `operation`, `error_code`, `error_class`, `retryable`을 기록하는 로거를 만든다.
- [x] `app/core/auth.py`에 환경 설정을 읽는 임시 관리자 검증 dependency를 만들고, `app/main.py`에 route 없는 FastAPI 앱 뼈대를 만든다.
- [x] 정상 요청 본문·이미지·비밀번호·토큰·처리시간을 로그에 기록하지 않는 단위 테스트를 작성한다.

### Step 3 — 식별자·문서 ID·공통 오류 도메인 구현
- [x] `app/domain/constants.py`, `errors.py`, `identifiers.py`에 300 KiB/5 MiB 상수, typed domain error, UUID wrapper, DocumentIdPrefix, PublicDocumentId format/parse를 구현한다.
- [x] 프로젝트 로컬 `(project_id, public_document_id)` 범위와 불변 ID 규칙을 구현한다.
- [x] `InvalidIdentifier`, `ProjectNotFound`, `DuplicateProjectDocumentId`, `DraftRevisionConflict`, `ContentStorageFailure`, `PersistenceOutcomeUnknown`, `ImmutableSnapshotMutation` 등의 오류 계약을 구현한다.
- [x] 예제 기반 단위 테스트로 경계·형식·오류 직렬화 계약을 검증한다.

### Step 4 — ContentRef·첨부 제약·핵심 엔터티 구현
- [x] `app/domain/content.py`, `attachments.py`, `entities.py`에 InlineContentRef, S3ContentRef, DraftRevision, Attachment metadata, Project, Artifact, Draft, VersionSnapshot, TraceLink, AiWorkspaceSession을 구현한다.
- [x] 정규화 바이트 수 기준 300 KiB 이하 inline / 초과 S3 분기와 SHA-256 checksum을 구현한다.
- [x] PNG/JPEG 및 1–5 MiB 첨부 메타데이터 검증, immutable VersionSnapshot, revision 양수/정확히 +1 계약을 구현한다.
- [x] 예제 기반 단위 테스트로 임계값·MIME·크기·불변성·revision 충돌 계약을 검증한다.

### Step 5 — 도메인 port와 저장소 계약 구현
- [x] `app/domain/ports.py`에 Project, Artifact, Version, Attachment, TraceLink, AiSession repository와 ObjectStoragePort의 typed protocol/추상 계약을 구현한다.
- [x] Project별 public document ID 원자 할당, Draft 조건부 갱신, immutable snapshot append/read, attachment metadata 저장, AI session TTL metadata 계약을 정의한다.
- [x] U2/U3/U4가 저장소 구현 세부 대신 ContentRef와 port만 사용하도록 반환 타입과 오류를 정의한다.
- [x] port 단위 테스트로 AWS SDK 의존성 없는 계약을 검증한다.

### Step 6 — DynamoDB repository adapter 구현
- [x] `app/persistence/dynamodb.py`에 목적별 테이블 이름 주입, PK/SK 직렬화, 프로젝트 범위 조회, project-local public ID 조건부 할당을 구현한다.
- [x] Artifact Draft의 `expected_revision` 조건부 갱신과 VersionSnapshot 불변 append/read를 구현한다.
- [x] Attachment, TraceLink, AiSession metadata adapter와 TTL 필드 직렬화 기반을 구현한다.
- [x] 조건부 실패를 `DraftRevisionConflict` 또는 중복 ID 오류로 매핑하고, 결과 미확정 오류는 자동 재시도하지 않는다.

### Step 7 — S3 object storage adapter와 실패 보존 구현
- [x] `app/persistence/s3.py`에 본문/이미지 쓰기·읽기, checksum/byte size 확인, 새 시도용 객체 키, 최선 노력 미참조 객체 정리 계약을 구현한다.
- [x] 300 KiB 초과 본문과 이미지 바이너리만 S3에 기록하고 DynamoDB에는 ContentRef/Attachment metadata만 남기도록 한다.
- [x] 실패 시 기존 Draft/ContentRef를 변경하지 않고 retryable 또는 결과 미확정 오류를 반환하도록 adapter/서비스 경계를 구현한다.

### Step 8 — DynamoDB/S3 adapter contract 테스트
- [x] `backend/tests/contract/u1/`에 주입된 boto3 client/stub 기반 DynamoDB 조건식, ID 할당, 오류 매핑, S3 metadata/checksum/cleanup 계약 테스트를 작성한다.
- [x] 실제 AWS 계정, DynamoDB 테이블, S3 버킷을 사용하지 않는다.
- [x] 자동 재시도, 캐시, 메시지 큐, 서킷 브레이커, rate limiter를 추가하지 않는지 검증한다.

### Step 9 — Hypothesis 전략과 PBT-02/03/07 테스트
- [x] `backend/tests/support/strategies/`에 UUID, 접두어/순번, ContentRef, DraftRevision, MIME/크기 첨부 전략을 작성한다.
- [x] `backend/tests/property/u1/`에 ContentRef와 PublicDocumentId round-trip 테스트를 작성한다. (**PBT-02**)
- [x] revision 증가/충돌 보존, 300 KiB 분기, MIME/5 MiB 첨부 불변조건 테스트를 작성한다. (**PBT-03**)
- [x] 제약 전략이 유효 도메인 값을 만들고 invalid case를 의도적으로 분리하는지 검증한다. (**PBT-07**)
- [x] Hypothesis shrinking을 유지하고 failure seed/재현 정보를 pytest 출력에 보존한다.

### Step 10 — 로컬 테스트 실행과 코드 품질 검증
- [x] U1 unit/property/contract 테스트를 로컬에서 실행한다.
- [x] 타입/정적 검사 또는 해당 프로젝트의 lint 검사를 실행한다.
- [x] 실패 시 해당 코드와 테스트를 수정한 뒤 재실행한다.
- [x] 실행 명령과 결과를 `aidlc-docs/construction/u1-shared-domain-persistence/code/`의 요약 문서에 기록한다.

### Step 11 — PBT-08 CI 차단 게이트
- [x] EC2 자체 CI에서 pytest/Hypothesis를 실행하고, shrinking 결과와 failure seed/재현 출력을 `.ci-artifacts/` 로그에 보존하도록 구성한다.
- [x] CI 실행 증거로 `ci-backend.sh`의 성공 로그와 활성 systemd timer를 검증했다.
- [x] 사용자가 EC2 자체 CI(B)를 별도 승인했으며, `aidlc-backend-ci.timer`는 15분 주기로 CI service를 실행한다.

### Step 12 — U1 코드 문서화와 인계
- [x] `aidlc-docs/construction/u1-shared-domain-persistence/code/implementation-summary.md`를 작성한다.
- [x] 생성 파일, US-001/요구사항/PBT 추적성, U2–U5 소비 계약, 로컬 검증 결과, CI 게이트 상태를 기록한다.
- [x] 배포/IaC 산출물은 MVP Infrastructure Design skip 결정에 따라 `N/A`로 기록한다.

## 승인 전 조건
- 현재 워크스페이스에는 애플리케이션 코드가 없으며, 위 경로에만 새 코드를 생성한다.
- 코드 생성은 이 계획 승인 후에만 시작한다.
- CI 구성을 실행하려면 별도의 명시적 사용자 승인이 필요하다. 다만 CI 미구성 상태에서는 PBT-08 때문에 U1 Code Generation 완료를 선언하거나 U2로 진행할 수 없다.
- 정확히 고정된 의존성 버전은 Step 1에서 호환성 확인 후 선택하며, 열린 버전 범위를 사용하지 않는다.

## 사용자 요청 실행 유틸리티
- [x] 프로젝트 루트의 `run-backend.sh`는 `uv --directory backend run uvicorn app.main:app`으로 백엔드를 실행한다.
- [x] 기본 바인딩은 `127.0.0.1:8000`이며 `AIDLC_HOST`, `AIDLC_PORT`, 추가 uvicorn 인자를 지원한다.
- [ ] 프론트엔드 UI(U5) 완료 후 프로젝트 루트에 프론트엔드·백엔드를 함께 실행하는 통합 스크립트를 생성한다. 이 항목은 U1 범위에서 실행하지 않는다.

## 계획 체크리스트
### 계획 수립
- [x] U1 기능/NFR 설계, US-001, 의존성, Greenfield 구조를 분석했다.
- [x] 애플리케이션 코드와 AIDLC 문서의 위치를 분리했다.
- [x] U1의 직접/지원 책임과 U2–U5 소비 계약을 명시했다.
- [x] PBT Partial과 PBT-08 CI 차단 조건을 계획에 반영했다.
- [x] 실행 가능한 12개 코드 생성 단계를 작성했다.

### 승인 이후 실행
- [x] Step 1 — uv Python 3.12 프로젝트와 고정 의존성 구성
- [x] Step 2 — 애플리케이션 설정·오류 전용 구조화 로그·임시 인증 경계
- [x] Step 3 — 식별자·문서 ID·공통 오류 도메인 구현
- [x] Step 4 — ContentRef·첨부 제약·핵심 엔터티 구현
- [x] Step 5 — 도메인 port와 저장소 계약 구현
- [x] Step 6 — DynamoDB repository adapter 구현
- [x] Step 7 — S3 object storage adapter와 실패 보존 구현
- [x] Step 8 — DynamoDB/S3 adapter contract 테스트
- [x] Step 9 — Hypothesis 전략과 PBT-02/03/07 테스트
- [x] Step 10 — 로컬 테스트 실행과 코드 품질 검증
- [x] Step 11 — PBT-08 CI 차단 게이트
- [x] Step 12 — U1 코드 문서화와 인계

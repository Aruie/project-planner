# U1 구현 요약

## 구현 범위
U1은 US-001 프로젝트 컨텍스트와 U2–U5가 소비할 공통 도메인·저장소 기반을 제공한다. U2의 문서 lifecycle REST API, U3 렌더링, U4 Bedrock orchestration, U5 React UI는 구현하지 않았다.

## 주요 구현
- `backend/app/core/`: 환경 변수 기반 설정, 오류 전용 JSON 로그, FastAPI 임시 관리자 경계, route 없는 앱 shell
- `backend/app/domain/`: UUID/프로젝트 내부 문서 ID, ContentRef, 첨부 제약, 불변 엔터티, repository/object storage protocol, domain error
- `backend/app/persistence/dynamodb.py`: 목적별 table adapter, public ID 원자 할당, Draft 조건부 갱신, immutable version, metadata TTL
- `backend/app/persistence/s3.py`: 대형 본문/이미지 object storage, checksum·크기 검증, orphan cleanup
- `backend/tests/unit/u1/`: 예제 기반 경계·오류·adapter 테스트
- `backend/tests/contract/u1/`: botocore Stubber 계약 테스트
- `backend/tests/property/u1/`: Hypothesis PBT-02/03/07 테스트

## 요구사항 및 PBT 추적성
| 항목 | 구현 증거 |
|---|---|
| US-001 / FR-001 | `Project`, `ProjectRepository`, project-local `PublicDocumentId`, DynamoDB 원자 할당 |
| FR-003/007/008/009 | ContentRef, DraftRevision, immutable VersionSnapshot, 조건부 Draft adapter 계약 |
| FR-005 | PNG/JPEG 5 MiB 제약, AttachmentObjectRef, S3 attachment adapter |
| FR-011/012 | TraceLink/AiWorkspaceSession 공통 타입·repository metadata 계약 |
| PBT-02 | ContentRef/PublicDocumentId round-trip Hypothesis 테스트 |
| PBT-03 | revision·300 KiB·첨부 불변성 Hypothesis 테스트 |
| PBT-07 | 공통 Hypothesis 제약 전략 |
| PBT-08 | `ci-backend.sh`, `.ci-artifacts/` failure output, 활성 EC2 systemd timer |
| PBT-09 | 고정된 `hypothesis==6.131.9` 개발 의존성 |

## 검증 결과
- `uv lock --check`: 통과
- `uv run pytest`: 44 passed
- `uv run ruff check app tests`: 통과
- `uv run python -m compileall -q app`: 통과
- `./ci-backend.sh`: 44 passed, 로그는 `.ci-artifacts/backend-ci-*.log`
- `aidlc-backend-ci.timer`: enabled, active, 15분 주기

## U2–U5 인계 계약
- U2는 U1의 Project/Artifact/Draft/VersionSnapshot 및 repository port를 사용해 lifecycle API를 구현한다.
- U3는 AttachmentObjectRef와 ObjectStoragePort로 이미지/내보내기 입력을 가져온다.
- U4는 AiWorkspaceSession 및 TTL metadata 계약을 사용하고 reviewed Draft 생성은 U2에 위임한다.
- U5는 U1 AWS adapter에 접근하지 않고 U2–U4 REST API만 사용한다.

## 운영 및 배포
- Terraform, VPC/IAM, DynamoDB table provisioning, S3 bucket provisioning은 MVP Infrastructure Design skip 결정에 따라 N/A다.
- EC2 자체 CI service/timer 정의는 `backend/ci/systemd/`에 있으며, 이 EC2에는 활성화돼 있다.
- U5 완료 후 프론트엔드·백엔드 통합 실행 스크립트를 프로젝트 루트에 추가한다.

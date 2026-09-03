# U2 프론트엔드 컴포넌트

## 판정
U2는 FastAPI backend lifecycle/API 단위다. React 컴포넌트 구조, 상태, form validation, 화면 상호작용은 U5의 책임이므로 U2에서는 구현·상세 설계를 하지 않는다.

## U5 핸드오프 API 모델
- Artifact 생성: 유형 선택, 공통 metadata, 초기 본문
- Draft 읽기/저장: revision, conflict `current_revision`, 한국어 ApiError
- Version 확정/목록: artifact별 순번 VersionSummary
- Diff 조회: structured DiffResult(metadata changes + line hunks)
- TraceLink CRUD/gap 조회: 완전 link 및 TraceGapResult

## 자동화 친화성 인계
U5는 이후 UI 생성 시 상호작용 요소에 안정적인 `data-testid`를 부여하고, U2 API 오류 코드를 화면 상태로 변환한다. U2는 UI test ID나 React state를 소유하지 않는다.

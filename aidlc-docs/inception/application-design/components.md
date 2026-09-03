# Components

## 설계 결정 요약
- React는 기능별 feature 모듈과 shared 공통 모듈로 구성한다.
- FastAPI는 REST/JSON + OpenAPI 계약을 제공한다.
- 영속성은 목적별 DynamoDB 테이블, 이미지/대형 본문은 S3, AI 대화는 TTL 임시 세션을 사용한다.
- Artifact Service가 공통 Draft/버전/diff 흐름을 담당하고 유형별 렌더러 전략이 Markdown/Excel/DOCX 출력을 담당한다.

## Presentation Components
| Component | Responsibility | Primary Interfaces |
|---|---|---|
| App Shell and Project Context | 현재 프로젝트 선택, 전역 탐색, 자동 로그인 관리자 컨텍스트 | REST client, project context state |
| Project Feature | 프로젝트 생성, 목록, 선택 | `GET/POST /projects`, `GET /projects/{projectId}` |
| Artifact Feature | 산출물 목록, 유형 선택, Draft 메타데이터/본문/표 편집 | `/projects/{projectId}/artifacts` REST resources |
| Version and Diff Feature | 버전 확인, 이력, Draft/버전 비교 표시 | version and diff REST resources |
| Traceability Feature | 사용자스토리-요구사항-테스트케이스 연결 및 추적표 조회 | trace link REST resources |
| AI Workspace Feature | 프로젝트 내부 채팅 입력, 미리보기, 검토 후 Draft 저장 | AI session and AI result REST resources |
| Shared UI and API Client | 공통 레이아웃, 오류 표시, REST 호출, OpenAPI 타입 사용 | reusable UI, HTTP client |

## Backend Entry Components
| Component | Responsibility | Exposes |
|---|---|---|
| FastAPI REST Adapter | Pydantic 요청/응답 검증, HTTP 상태 변환, OpenAPI 발행, 현재 프로젝트 식별 | `/projects`, `/artifacts`, `/versions`, `/diff`, `/attachments`, `/trace-links`, `/ai-sessions` |
| Exception Mapper | 도메인/저장소/외부 연동 오류를 일관된 API 오류로 변환 | REST error response |
| Dependency Composition Root | 서비스, repository, renderer, Bedrock client를 조립 | FastAPI dependency providers |

## Application and Domain Components
| Component | Responsibility | Depends On |
|---|---|---|
| Project Service | 프로젝트 생성·조회·선택 가능한 프로젝트 컨텍스트 제공 | Project Repository |
| Artifact Service | 공통 산출물 생성, Draft 읽기·수정, 메타데이터, 유형 전략 선택 | Artifact Repository, Artifact Type Handler, Attachment Service |
| Version Service | 확정 전 요약, immutable 스냅샷 생성, 변경내역, 단일 Draft와 낙관적 동시성 조정 | Artifact Repository, Version Repository, Change Summary Component |
| Diff Service | Draft/버전 쌍의 메타데이터 및 본문 라인 diff 생성 | Artifact Repository, Version Repository, Diff Engine |
| Attachment Service | 이미지 업로드/해결, S3 키와 첨부 메타데이터 연결 | Attachment Repository, Object Storage Port |
| Export Service | 선택한 산출물의 XLSX/DOCX 생성 작업 조정 | Artifact Service, Version Service, Renderer Registry, Attachment Service |
| Traceability Service | 사용자스토리, 요구사항, 테스트케이스 링크와 누락 링크 조회 | Traceability Repository |
| AI Workspace Service | 프로젝트 범위 TTL 대화 세션, Bedrock 요청, 편집 가능한 미리보기, 검토 후 Draft 저장 조정 | AI Session Repository, Bedrock Port, Artifact Service |
| Artifact Type Handler | 산출물 유형별 본문 검증·정규화·렌더링 모델 변환 | Markdown/Excel handler implementations |
| Renderer Registry | 요청한 출력 형식에 적합한 renderer 선택 | Markdown Renderer, Excel Renderer, DOCX Renderer |

## Persistence and External Adapter Components
| Component | Responsibility | Storage or External Contract |
|---|---|---|
| Project Repository | 프로젝트 메타데이터 읽기/쓰기 | `projects` DynamoDB table |
| Artifact Repository | 문서 메타데이터, 현재 Draft, 인라인 본문 또는 S3 본문 참조, optimistic revision | `artifacts` DynamoDB table |
| Version Repository | immutable 스냅샷, 버전 순서, 변경내역 | `artifact_versions` DynamoDB table |
| Attachment Repository | S3 객체 키, MIME type, 크기, 문서 연결 메타데이터 | `attachments` DynamoDB table |
| Traceability Repository | story-requirement-test case 링크와 상태 | `trace_links` DynamoDB table |
| AI Session Repository | TTL 대화 메시지와 미저장 미리보기 | `ai_workspace_sessions` DynamoDB table with TTL |
| Object Storage Adapter | 이미지 및 임계값 초과 문서 본문 저장/읽기 | Amazon S3 |
| Bedrock Adapter | 대화형 생성 요청 및 응답 변환 | Amazon Bedrock runtime |
| Markdown Renderer | Markdown 미리보기 모델 및 front matter 해석 | Artifact Type Handler contract |
| Excel Renderer | openpyxl 기반 표지·변경내역·유형별 본문 시트 생성 | XLSX output stream |
| DOCX Renderer | 내장 md-publisher 기반 Markdown to DOCX 변환 | DOCX output stream |

## Ownership and Boundary Rules
1. React feature는 REST API만 호출하며 DynamoDB, S3, Bedrock에 직접 접근하지 않는다.
2. REST Adapter는 HTTP 변환만 담당하고 business orchestration을 서비스로 위임한다.
3. Artifact Service는 공통 산출물 lifecycle의 소유자이며 renderer는 저장소나 버전 생성을 수행하지 않는다.
4. Version Service만 immutable version snapshot을 생성한다.
5. AI Workspace Service는 임시 세션을 소유하며, 명시적인 review-save 요청 전에는 Artifact Service Draft를 생성하거나 수정하지 않는다.
6. Repository는 DynamoDB 테이블 경계 안의 읽기/쓰기를 담당하고 도메인 규칙이나 출력 변환을 포함하지 않는다.

# U5 로그인·프로젝트 사이드바 교정 계획

## 변경 범위
현재 workspace에 관리자 ID/비밀번호와 manual project UUID 입력이 노출된 UX를 교체한다.

1. dedicated LoginScreen은 username/password를 memory state로만 보유하고 existing HTTP Basic contract를 `GET /auth/me`으로 명시 검증한다.
2. backend `GET /projects`는 관리자에게 project ID/name/prefix 목록을 반환한다. U1 ProjectRepository/DynamoDB adapter에 scoped list contract를 추가한다.
3. successful login 뒤 AppShell은 sidebar project list를 load한다. user click만 project context를 바꾸며 dependent state/request는 reset된다.
4. empty project list는 Korean empty state를 표시한다. U5는 project creation/editing UI를 이 correction에서 만들지 않는다.
5. credentials, raw response, list cache는 browser storage에 저장하지 않는다. logout은 memory access/project state를 지운다.

## 구현 체크리스트
- [x] current auth/project repository/U5 app gap을 분석했다.
- [x] dedicated login, in-memory Basic verification, project list sidebar, explicit selection, safe empty/error/logout rules를 설계했다.
- [x] backend auth/project list contracts, DynamoDB list adapter, unit/API tests를 구현한다.
- [x] React LoginScreen, ProjectSidebar, login/session state, sidebar UI/component tests를 구현한다.
- [x] frontend/backend CI·combined runner를 검증하고 implementation summary/state/audit를 갱신한다.

## acceptance criteria
- unverified user cannot see workspace/project list.
- valid credentials show project sidebar; invalid credentials show Korean safe login error.
- project selection is an explicit sidebar click and reset state happens before scoped requests.
- logout removes in-memory credentials/project selection and returns to LoginScreen.
- backend checks, frontend checks, combined runner smoke remain successful.

# U5 로그인 및 프로젝트 사이드바 교정 설계

## 사용자 흐름
1. 앱 최초 진입은 `LoginScreen`만 표시한다. workspace/API feature는 검증 전 render하지 않는다.
2. 관리자가 ID/비밀번호를 입력하고 로그인하면 ApiClient가 Basic header로 `GET /auth/me`을 호출한다.
3. 성공 response 후에만 credential을 React memory state에 유지하고 `GET /projects`를 호출한다.
4. `ProjectSidebar`는 project name, prefix, ID를 표시한다. 첫 project를 자동 선택하지 않는다.
5. 관리자가 sidebar item을 클릭하면 ProjectContext epoch를 증가시키고 모든 scoped feature state를 지운 뒤 해당 project를 active로 표시한다.
6. Logout은 credentials, verified principal, project list, active project를 메모리에서 지우고 LoginScreen으로 복귀한다.

## backend contracts
| Endpoint | Auth | Response | 책임 |
|---|---|---|---|
| `GET /auth/me` | existing Basic `require_admin` | `{username}` | credential verification only; server session/token 발급 없음 |
| `GET /projects` | existing Basic `require_admin` | `[{project_id,name,document_id_prefix}]` | U1 project storage read only |

## rules
- `GET /projects`는 successful `GET /auth/me` 후에만 UI가 호출한다.
- login failure는 `로그인 정보가 올바르지 않습니다.`만 표시하며 credential/detail을 보존/로그하지 않는다.
- list failure는 Korean retry UI를 표시하며 previously selected project state를 만들지 않는다.
- empty list는 `등록된 프로젝트가 없습니다.`만 표시한다; manual UUID input fallback은 제거한다.
- sidebar selection, logout, retry는 explicit click only; browser persistence, token, automatic retry/cache 없음.
- existing U2/U3/U4 routes와 lifecycle ownership은 변경하지 않는다.

## stable test IDs
`login-username-input`, `login-password-input`, `login-submit-button`, `login-error-banner`, `project-sidebar`, `project-sidebar-item-{projectId}`, `project-sidebar-empty`, `logout-button`.

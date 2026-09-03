# Local AWS Test Environment

## Scope
Created on 2026-09-03 for the local AIDLC development runner in `ap-northeast-2` (Seoul), AWS account `577999459312`. This is a development environment; it is not a production deployment.

## Resources
- DynamoDB on-demand tables, all tagged `Application=aidlc` and `Environment=local`:
  - `aidlc-local-577999459312-projects` — partition key `project_id` (string)
  - `aidlc-local-577999459312-artifacts` — partition key `project_id` / sort key `artifact_id` (string)
  - `aidlc-local-577999459312-versions` — partition key `artifact_id` (string) / sort key `version_number` (number)
  - `aidlc-local-577999459312-attachments` — partition key `project_id` / sort key `attachment_id` (string)
  - `aidlc-local-577999459312-trace-links` — partition key `project_id` / sort key `trace_link_id` (string)
  - `aidlc-local-577999459312-ai-sessions` — partition key `session_id` (string), TTL attribute `expires_at_epoch`
- S3 bucket: `aidlc-local-577999459312-apne2`
- Initial sidebar project: `52a478d8-1d6c-4a2d-a429-0d2befb3bdf1`, name `AIDLC 로컬 테스트 프로젝트`, document prefix `AIDLC`.

## Runtime configuration
The root `.env.local` contains only account-specific resource defaults and the local development login. It contains no AWS access key, secret, or session token; AWS authentication is supplied by the attached EC2 IAM role. `run-aidlc.sh` loads the file when present. Any caller-provided environment value remains higher priority than its defaults.

```bash
./run-aidlc.sh
```

`run-aidlc.sh` starts a Vite development server, which automatically establishes memory-only `admin` / `admin1234` access and bypasses the login screen. This happens only when `DEV=true` and `MODE=development`; production builds continue to require manual login. No browser storage, token, or server session is created.

## Validation evidence
- DynamoDB tables were `ACTIVE`; AI session TTL was `ENABLED` for `expires_at_epoch`.
- Direct DynamoDB read returned the initial project.
- Runner smoke returned `{"username":"admin"}` from `GET /auth/me`, and `GET /projects` returned the initial project. Vite also responded at `http://127.0.0.1:5173`.
- Backend CI: 75 passed, `.ci-artifacts/backend-ci-20260903T071848Z.log`.
- Frontend CI: 5 passed and production build, `.ci-artifacts/frontend-ci-20260903T071853Z.log`.

## Cleanup
These resources persist and may incur AWS charges. To remove this local environment, empty the S3 bucket first, then delete the bucket and the six DynamoDB tables with prefix `aidlc-local-577999459312-`. Do not execute cleanup against another prefix or account.

## Sample dataset
Run the idempotent seed at any time after provisioning:

```bash
./seed-local-demo.sh
```

It preserves existing deterministic samples on repeat runs and creates/repairs:
- Requirements Markdown artifact `8fd6c982-5c66-4d1b-9d20-b17d3d62c271`: approved v1 `9470ac45-d7b1-4570-bafb-2b3ba82d65b1` and revision-2 working draft, so version-versus-draft diff is visible.
- Trace matrix Excel artifact `1b270f94-6071-4b8f-bfa3-4018f1c2f553`: approved v1 `c7d4885f-033d-4623-b05a-a733a9c66388`.
- Trace links for `STORY-001`/`REQ-001`/`TC-001` and `STORY-002`/`REQ-002`/`TC-002`; `STORY-003`, `REQ-003`, and `TC-003` remain intentional gaps.
- PNG attachment `35d51d0a-85fa-4c81-b86b-526f6878ca3c` in S3 plus DynamoDB metadata for the requirements artifact.

Fresh AWS-backed runner validation returned artifact revision 2, requirements version v1, diff summary `added=6`, `removed=2`, `unchanged=6`, the intentional trace gaps, and the PNG attachment. `GET` attachment composition now uses the same DynamoDB/S3 adapters as the rest of the application.

## Site sample workflow
After `./run-aidlc.sh`, the local development screen enters as admin automatically. Click `AIDLC 로컬 테스트 프로젝트` in the left project sidebar. The **기존 산출물** list then shows:
- `AIDLC 샘플 요구사항 정의서 (검토 중)` — revision 2. Select it, click **버전 목록** in the version/diff panel, choose v1, then click **Draft와 비교**.
- `AIDLC 샘플 추적표` — revision 1.

The frontend uses `GET /api/projects/{project_id}/artifacts` through Vite's proxy; fresh runner verification returned both seeded artifacts from this browser-equivalent path.

## EC2 browser access
`run-aidlc.sh` now binds Vite to `0.0.0.0:5173` by default, while FastAPI remains private on `127.0.0.1:8000` behind Vite's `/api` proxy. This allows a browser that reaches the EC2 frontend port to use the same `/api` path; it does not expose FastAPI directly. Override only when needed with `AIDLC_FRONTEND_HOST`.

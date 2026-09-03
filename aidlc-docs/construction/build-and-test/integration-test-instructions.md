# Integration Test Instructions

## automated integration smoke
```bash
cd /home/ec2-user/project/cop_0904
bash -n run-aidlc.sh ci-backend.sh ci-frontend.sh
./run-aidlc.sh
```
Expected: FastAPI starts at `127.0.0.1:8000`, Vite starts at `127.0.0.1:5173`, and Ctrl+C terminates both child processes. Final validation completed this smoke successfully.

## real API/UI integration prerequisites
1. Export the required backend configuration variables and ensure the configured AWS project resources exist.
2. Start `./run-aidlc.sh`.
3. Open `http://127.0.0.1:5173`, enter temporary administrator access in memory and enter a valid existing project UUID.
4. Use a real artifact UUID after creating a Draft; U2 does not currently expose project/artifact list REST endpoints, so the UI deliberately does not invent list data.

## scenarios
| Scenario | Steps | Expected result |
|---|---|---|
| U2 Draft → version/diff | Create a Markdown Draft, explicitly save, explicitly confirm version, select the returned version, run diff | only explicit actions mutate backend; version and diff results are scoped to project/artifact |
| U3 attachment/export | Select PNG/JPEG at most 5 MiB, upload, request DOCX/XLSX | client precheck is visible; server remains authoritative; download does not mutate Draft/Version |
| U4 temporary AI → reviewed Draft | Start AI session, send prompt, verify temporary preview, simulate/receive safe failure, then explicit reviewed save | failure retains last successful preview; expiry offers new session; reviewed save returns a Draft and creates no Version |
| scope and stale UI | change project context during pending action | previous request is aborted/stale and cannot replace new project state |

## cleanup
Press Ctrl+C in the runner terminal. The script sends termination to Vite and FastAPI children. No database cleanup is automated; manually created AWS test data must be removed only with deliberate user authorization.

## live integration limitation
No automated AWS/Bedrock end-to-end suite is added for this MVP because it would incur cloud side effects and needs real configured project data. Adapter contract tests use botocore Stubber; UI tests use injected mock fetch.

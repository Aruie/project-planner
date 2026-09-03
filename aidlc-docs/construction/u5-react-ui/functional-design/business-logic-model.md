# U5 비즈니스 로직 모델

## 소유권
U5는 U1–U4 REST contract의 presentation/integration layer다. 모든 feature state는 현재 project context에 종속된다. UI는 Draft, VersionSnapshot, attachment, trace link, AI session을 직접 저장·변경하지 않으며 각 소유 backend endpoint만 호출한다.

## App shell과 project context
1. AppShell은 Korean navigation, current project ID context, feature route, API error banner를 유지한다.
2. project context가 없으면 document, version, traceability, export, AI action을 비활성화하고 project selection/input을 안내한다.
3. U5는 현 backend에 project/artifact list REST endpoint가 없음을 가정하지 않는다. current project ID는 explicit project context input/host-provided value이며, list endpoint가 제공된 뒤에만 selector list를 렌더링한다.

## Artifact lifecycle
1. ArtifactEditor는 Markdown/Excel type, metadata, body와 local dirty state를 관리한다.
2. create는 U2 artifact create contract만 호출하고, save는 `expected_revision`과 body/metadata를 보낸다.
3. successful save response가 editor baseline/revision을 교체한다. revision conflict는 local input을 보존하고 server current revision 안내를 표시한다.
4. VersionPanel은 explicit confirmation 후에만 U2 version contract를 호출하며, UI navigation/preview가 version을 자동 생성하지 않는다.
5. DiffPanel은 selected draft/version pair를 read-only request로 보내고 metadata/body hunks를 표시한다.

## Rendering, attachment, export, traceability
1. PreviewPanel은 U3 normalized RenderModel을 read-only 표시한다.
2. AttachmentControl은 supported image와 5 MiB client-side precheck 뒤 upload/resolve state를 표시한다. server error가 최종 판단이다.
3. ExportActions는 XLSX/DOCX/trace matrix response bytes를 browser download로 전달하며 lifecycle state를 바꾸지 않는다.
4. TraceabilityPanel은 complete story/requirement/test link create와 gap read를 분리해 표시한다.

## AI workspace
1. AiWorkspacePanel은 current project에서 U4 session start/reuse 후 last successful messages, preview, expiry를 state에 반영한다.
2. prompt send는 one explicit user action으로만 U4 message API를 호출한다. 실패면 current preview/messages를 유지하고 Korean safe error와 editable prompt를 표시한다.
3. preview는 temporary label을 유지한다. non-empty preview에서만 reviewed-save action을 활성화한다.
4. reviewed save success는 U2-created Draft result를 표시하고 AI session/preview는 지우거나 Version을 생성하지 않는다.
5. `AI_SESSION_EXPIRED`는 새 session start action을 제시하며 expired content를 복구하지 않는다.

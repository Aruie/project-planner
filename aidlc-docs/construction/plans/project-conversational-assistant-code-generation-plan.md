# Project-wide Conversational Assistant Code Generation Plan

## Scope
- Automatically start a project-scoped AI conversation without explicit start buttons.
- Read bounded current content and metadata for all artifacts in the selected project.
- Return typed `answer` or `proposal` responses.
- For proposals, validate and display the target artifact and server-computed changed lines.
- Apply proposals safely to the target artifact, including switching documents when needed.

## Execution Steps
- [x] Step 1: Extend backward-compatible AI session, API, and Bedrock result contracts.
- [x] Step 2: Build bounded project context and typed answer/proposal orchestration.
- [x] Step 3: Update Bedrock instructions and structured response parsing.
- [x] Step 4: Auto-start frontend chat and render answer/proposal-specific UI.
- [x] Step 5: Add safe cross-document proposal application.
- [x] Step 6: Update unit/integration tests and run full backend/frontend validation.

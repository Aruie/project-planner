"""Project-scoped conversational AI orchestration with safe document proposals."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from difflib import unified_diff

from app.domain.content import InlineContentRef, S3ContentRef, content_checksum, select_content_ref
from app.domain.entities import AiSessionMessage, AiWorkspaceSession
from app.domain.errors import AiSessionNotFound
from app.domain.identifiers import AiSessionId, ArtifactId, ProjectId
from app.domain.ports import (
    AiSessionRepository,
    ArtifactRepository,
    ObjectStoragePort,
    ProjectRepository,
)
from app.features.artifacts.models import ArtifactMetadata

from .errors import (
    AiWorkspaceProblem,
    input_too_large,
    invocation_failed,
    preview_required,
    scope_mismatch,
    session_expired,
)
from .models import AiMessage, AiWorkspaceState, ReviewedPreviewSaveResponse
from .ports import BedrockConversationPort, ReviewedDraftCreatePort

PROMPT_MAX_BYTES = 320 * 1024
PROJECT_CONTEXT_MAX_BYTES = 240 * 1024
CONTEXT_MAX_MESSAGES = 20
PREVIEW_MAX_BYTES = 300 * 1024
CHANGES_MAX_BYTES = 48 * 1024
SESSION_TTL = timedelta(hours=24)


def _truncate_utf8(value: str, byte_limit: int) -> str:
    encoded = value.encode("utf-8")
    if len(encoded) <= byte_limit:
        return value
    return encoded[:byte_limit].decode("utf-8", errors="ignore") + "\n...[내용 일부 생략]"


def _changed_parts(before: str, after: str) -> str:
    lines = list(
        unified_diff(
            before.splitlines(),
            after.splitlines(),
            fromfile="현재 문서",
            tofile="변경안",
            lineterm="",
            n=2,
        )
    )
    if not lines:
        return "실제 변경된 내용이 없습니다."
    return _truncate_utf8("\n".join(lines), CHANGES_MAX_BYTES)


class AiWorkspaceService:
    def __init__(
        self,
        projects: ProjectRepository,
        sessions: AiSessionRepository,
        storage: ObjectStoragePort,
        conversation: BedrockConversationPort,
        reviewed_create: ReviewedDraftCreatePort,
        now: Callable[[], datetime] | None = None,
        artifacts: ArtifactRepository | None = None,
    ) -> None:
        self._projects = projects
        self._sessions = sessions
        self._storage = storage
        self._conversation = conversation
        self._reviewed_create = reviewed_create
        self._now = now or (lambda: datetime.now(UTC))
        self._artifacts = artifacts

    def start(
        self, project_id: ProjectId, session_id: AiSessionId | None = None
    ) -> AiWorkspaceState:
        self._projects.get(project_id)
        if session_id is not None:
            return self._state(self._load(project_id, session_id))
        session = AiWorkspaceSession(AiSessionId.new(), project_id, None, self._now() + SESSION_TTL)
        return self._state(self._sessions.save(session))

    def get(self, project_id: ProjectId, session_id: AiSessionId) -> AiWorkspaceState:
        return self._state(self._load(project_id, session_id))

    def send(
        self,
        project_id: ProjectId,
        session_id: AiSessionId,
        prompt: str,
        active_artifact_id: str | None = None,
    ) -> AiWorkspaceState:
        session = self._load(project_id, session_id)
        if not prompt or len(prompt.encode("utf-8")) > PROMPT_MAX_BYTES:
            raise input_too_large()
        context = session.messages[-CONTEXT_MAX_MESSAGES:]
        try:
            project_prompt = self._project_prompt(project_id, prompt, active_artifact_id)
            result = self._conversation.converse(context, project_prompt)
            proposal = self._proposal(project_id, active_artifact_id, result)
        except AiWorkspaceProblem:
            raise
        except Exception as error:
            raise invocation_failed() from error

        message = result.assistant_message.strip()
        if not message:
            raise invocation_failed()
        preview_ref = None
        target_id = None
        target_title = ""
        changes = ""
        if proposal is not None:
            target_id, target_title, before, preview = proposal
            if len(preview.encode("utf-8")) > PREVIEW_MAX_BYTES:
                raise input_too_large()
            preview_ref = self._store_preview(project_id, session_id, preview)
            changes = _changed_parts(before, preview)

        now = self._now()
        messages = (
            *session.messages,
            AiSessionMessage("user", prompt.strip(), now),
            AiSessionMessage("assistant", message, now),
        )[-CONTEXT_MAX_MESSAGES:]
        saved = AiWorkspaceSession(
            session_id=session_id,
            project_id=project_id,
            preview_content_ref=preview_ref,
            expires_at=now + SESSION_TTL,
            messages=tuple(messages),
            proposal_target_artifact_id=target_id,
            proposal_target_title=target_title,
            proposal_changes=changes,
        )
        return self._state(self._sessions.save(saved))

    def save_reviewed(
        self, project_id: ProjectId, session_id: AiSessionId, title: str, tags: tuple[str, ...]
    ) -> ReviewedPreviewSaveResponse:
        session = self._load(project_id, session_id)
        preview = self._preview(session)
        if not preview:
            raise preview_required()
        artifact = self._reviewed_create.create(
            project_id,
            ArtifactMetadata(
                title=title,
                description="AI 검토 완료 요구사항 정의",
                artifact_type="MarkdownDocument",
                tags=(*tags, "requirements-definition"),
            ),
            preview,
        )
        return ReviewedPreviewSaveResponse.model_validate(artifact.model_dump())

    def _project_prompt(
        self, project_id: ProjectId, request: str, active_artifact_id: str | None
    ) -> str:
        project = self._projects.get(project_id)
        header = (
            f"프로젝트명: {project.name}\n"
            f"과제명: {project.task_name or '-'}\n"
            f"수탁기관: {project.contractor_name or '-'}\n"
            f"발주처: {project.client_name or '-'}\n"
            f"회사·기관: {project.organization_name or '-'}\n"
        )
        documents: list[tuple[str, str]] = []
        if self._artifacts is not None:
            for artifact in sorted(
                self._artifacts.list_for_project(project_id),
                key=lambda item: str(item.public_document_id),
            ):
                draft = self._artifacts.get_draft(project_id, artifact.artifact_id)
                active = str(artifact.artifact_id) == active_artifact_id
                metadata = (
                    f"문서 ID: {artifact.artifact_id}\n"
                    f"문서 번호: {artifact.public_document_id}\n"
                    f"제목: {draft.title}\n"
                    f"형식: {artifact.artifact_type}\n"
                    f"revision: {draft.revision.value}\n"
                    f"현재 열린 문서: {'예' if active else '아니오'}"
                )
                documents.append((metadata, self._read_content(draft.content_ref)))

        catalog = "\n\n".join(metadata for metadata, _ in documents) or "산출물 없음"
        prefix = f"<project>\n{header}\n<artifact_catalog>\n{catalog}\n</artifact_catalog>\n"
        suffix = (
            "\n</project>\n"
            f"<active_artifact_id>{active_artifact_id or ''}</active_artifact_id>\n"
            f"<user_request>{request}</user_request>"
        )
        remaining = PROJECT_CONTEXT_MAX_BYTES - len((prefix + suffix).encode("utf-8"))
        body_parts: list[str] = []
        for metadata, content in documents:
            if remaining <= 0:
                break
            block_prefix = f"\n<artifact>\n{metadata}\n<content>\n"
            block_suffix = "\n</content>\n</artifact>"
            overhead = len((block_prefix + block_suffix).encode("utf-8"))
            if remaining <= overhead:
                break
            bounded = _truncate_utf8(content, remaining - overhead)
            block = f"{block_prefix}{bounded}{block_suffix}"
            body_parts.append(block)
            remaining -= len(block.encode("utf-8"))
        return prefix + "".join(body_parts) + suffix

    def _proposal(self, project_id, active_artifact_id, result):
        if result.response_type != "proposal":
            return None
        if self._artifacts is None:
            raise invocation_failed()
        target_value = result.target_artifact_id or active_artifact_id
        preview = (result.preview_markdown or "").strip()
        if not target_value or not preview:
            raise invocation_failed()
        target_id = ArtifactId.parse(target_value)
        self._artifacts.get(project_id, target_id)
        draft = self._artifacts.get_draft(project_id, target_id)
        return target_id, draft.title, self._read_content(draft.content_ref), preview

    def _load(self, project_id: ProjectId, session_id: AiSessionId) -> AiWorkspaceSession:
        try:
            session = self._sessions.get(project_id, session_id)
        except AiSessionNotFound as error:
            raise session_expired() from error
        if session.project_id != project_id:
            raise scope_mismatch()
        if session.expires_at <= self._now():
            raise session_expired()
        return session

    def _read_content(self, reference) -> str:
        if isinstance(reference, InlineContentRef):
            return reference.content
        return self._storage.get_content(reference).decode("utf-8")

    def _store_preview(self, project_id: ProjectId, session_id: AiSessionId, preview: str):
        object_key = f"ai-preview/{project_id}/{session_id}/{content_checksum(preview)}"
        reference = select_content_ref(preview, object_key=object_key)
        if isinstance(reference, S3ContentRef):
            return self._storage.put_content(
                object_key, preview.encode("utf-8"), reference.checksum
            )
        return reference

    def _preview(self, session: AiWorkspaceSession) -> str | None:
        reference = session.preview_content_ref
        if reference is None:
            return None
        return self._read_content(reference)

    def _state(self, session: AiWorkspaceSession) -> AiWorkspaceState:
        preview = self._preview(session)
        response_type = (
            "proposal" if preview and session.proposal_target_artifact_id is not None else "answer"
        ) if session.messages else None
        return AiWorkspaceState(
            session_id=str(session.session_id),
            project_id=str(session.project_id),
            messages=tuple(
                AiMessage(role=item.role, content=item.content, created_at=item.created_at)
                for item in session.messages
            ),
            preview=preview,
            response_type=response_type,
            proposal_target_artifact_id=(
                str(session.proposal_target_artifact_id)
                if session.proposal_target_artifact_id is not None
                else None
            ),
            proposal_target_title=session.proposal_target_title or None,
            proposal_changes=session.proposal_changes or None,
            expires_at=session.expires_at,
        )

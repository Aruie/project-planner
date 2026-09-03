"""U4 temporary session orchestration and explicit U2 reviewed-save seam."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.domain.content import InlineContentRef, S3ContentRef, content_checksum, select_content_ref
from app.domain.entities import AiSessionMessage, AiWorkspaceSession
from app.domain.errors import AiSessionNotFound
from app.domain.identifiers import AiSessionId, ProjectId
from app.domain.ports import AiSessionRepository, ObjectStoragePort, ProjectRepository
from app.features.artifacts.models import ArtifactMetadata

from .errors import (
    input_too_large,
    invocation_failed,
    preview_required,
    scope_mismatch,
    session_expired,
)
from .models import AiMessage, AiWorkspaceState, ReviewedPreviewSaveResponse
from .ports import BedrockConversationPort, ReviewedDraftCreatePort

PROMPT_MAX_BYTES = 20 * 1024
CONTEXT_MAX_MESSAGES = 20
PREVIEW_MAX_BYTES = 300 * 1024
SESSION_TTL = timedelta(hours=24)


class AiWorkspaceService:
    def __init__(
        self,
        projects: ProjectRepository,
        sessions: AiSessionRepository,
        storage: ObjectStoragePort,
        conversation: BedrockConversationPort,
        reviewed_create: ReviewedDraftCreatePort,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._projects = projects
        self._sessions = sessions
        self._storage = storage
        self._conversation = conversation
        self._reviewed_create = reviewed_create
        self._now = now or (lambda: datetime.now(UTC))

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

    def send(self, project_id: ProjectId, session_id: AiSessionId, prompt: str) -> AiWorkspaceState:
        session = self._load(project_id, session_id)
        if not prompt or len(prompt.encode("utf-8")) > PROMPT_MAX_BYTES:
            raise input_too_large()
        context = session.messages[-CONTEXT_MAX_MESSAGES:]
        try:
            result = self._conversation.converse(context, prompt)
        except Exception as error:
            raise invocation_failed() from error
        preview = result.preview_markdown.strip()
        if not preview or len(preview.encode("utf-8")) > PREVIEW_MAX_BYTES:
            raise input_too_large()
        now = self._now()
        preview_ref = self._store_preview(project_id, session_id, preview)
        messages = (
            *session.messages,
            AiSessionMessage("user", prompt, now),
            AiSessionMessage("assistant", result.assistant_message.strip(), now),
        )[-CONTEXT_MAX_MESSAGES:]
        saved = AiWorkspaceSession(
            session_id, project_id, preview_ref, now + SESSION_TTL, tuple(messages)
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
        if isinstance(reference, InlineContentRef):
            return reference.content
        return self._storage.get_content(reference).decode("utf-8")

    def _state(self, session: AiWorkspaceSession) -> AiWorkspaceState:
        return AiWorkspaceState(
            session_id=str(session.session_id),
            project_id=str(session.project_id),
            messages=tuple(
                AiMessage(role=item.role, content=item.content, created_at=item.created_at)
                for item in session.messages
            ),
            preview=self._preview(session),
            expires_at=session.expires_at,
        )

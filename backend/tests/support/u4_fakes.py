from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.domain.entities import AiWorkspaceSession, Project
from app.domain.errors import AiSessionNotFound
from app.domain.identifiers import AiSessionId, ProjectId
from app.features.ai_workspace.ports import BedrockConversationResult
from app.features.artifacts.models import ArtifactMetadata, ArtifactResponse


@dataclass
class FakeAiSessionRepository:
    sessions: dict[AiSessionId, AiWorkspaceSession] = field(default_factory=dict)
    saves: int = 0

    def save(self, session: AiWorkspaceSession) -> AiWorkspaceSession:
        self.saves += 1
        self.sessions[session.session_id] = session
        return session

    def get(self, project_id: ProjectId, session_id: AiSessionId) -> AiWorkspaceSession:
        session = self.sessions.get(session_id)
        if session is None:
            raise AiSessionNotFound("missing")
        return session

    def expires_at(self, session_id: AiSessionId) -> datetime:
        return self.sessions[session_id].expires_at


@dataclass
class FakeBedrock:
    result: BedrockConversationResult = field(
        default_factory=lambda: BedrockConversationResult("응답", "answer")
    )
    error: Exception | None = None
    calls: int = 0
    prompts: list[str] = field(default_factory=list)

    def converse(self, messages, prompt):
        self.calls += 1
        self.prompts.append(prompt)
        if self.error:
            raise self.error
        return self.result


@dataclass
class FakeReviewedCreate:
    project: Project
    calls: int = 0

    def create(
        self, project_id: ProjectId, metadata: ArtifactMetadata, content: str
    ) -> ArtifactResponse:
        self.calls += 1
        return ArtifactResponse(
            artifact_id="123e4567-e89b-12d3-a456-426614174001",
            project_id=str(project_id),
            public_document_id="PRJ-001",
            artifact_type="MarkdownDocument",
            draft_id="123e4567-e89b-12d3-a456-426614174002",
            revision=1,
            title=metadata.title,
            description=metadata.description,
            tags=metadata.tags,
        )


@dataclass
class FakeProjects:
    project: Project

    def get(self, project_id: ProjectId) -> Project:
        return self.project


def fixed_now() -> datetime:
    return datetime(2026, 9, 3, tzinfo=UTC)

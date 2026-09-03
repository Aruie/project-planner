"""U4 typed boundaries; services never import boto3 or U2 repositories."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.domain.entities import AiSessionMessage
from app.domain.identifiers import ProjectId
from app.features.artifacts.models import ArtifactMetadata, ArtifactResponse


@dataclass(frozen=True, slots=True)
class BedrockConversationResult:
    assistant_message: str
    preview_markdown: str


@runtime_checkable
class BedrockConversationPort(Protocol):
    def converse(
        self, messages: tuple[AiSessionMessage, ...], prompt: str
    ) -> BedrockConversationResult: ...


@runtime_checkable
class ReviewedDraftCreatePort(Protocol):
    def create(
        self, project_id: ProjectId, metadata: ArtifactMetadata, content: str
    ) -> ArtifactResponse: ...

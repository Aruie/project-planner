"""Immutable shared U1 entities; U2-U4 own their lifecycle orchestration."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.domain.attachments import AttachmentMediaType, AttachmentObjectRef
from app.domain.content import ContentRef
from app.domain.errors import InvalidIdentifier
from app.domain.identifiers import (
    AiSessionId,
    ArtifactId,
    AttachmentId,
    DocumentIdPrefix,
    DraftId,
    ProjectId,
    PublicDocumentId,
    TraceLinkId,
    VersionId,
)


@dataclass(frozen=True, slots=True, order=True)
class DraftRevision:
    value: int

    def __post_init__(self) -> None:
        if self.value < 1:
            raise InvalidIdentifier("Draft revision must be positive")

    def next(self) -> DraftRevision:
        return DraftRevision(self.value + 1)


@dataclass(frozen=True, slots=True)
class Project:
    project_id: ProjectId
    name: str
    document_id_prefix: DocumentIdPrefix
    next_document_sequence: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    task_name: str = ""
    contractor_name: str = ""
    client_name: str = ""
    organization_name: str = ""

    def allocate_document_id(self) -> PublicDocumentId:
        return PublicDocumentId(self.document_id_prefix, self.next_document_sequence)


@dataclass(frozen=True, slots=True)
class Artifact:
    artifact_id: ArtifactId
    project_id: ProjectId
    public_document_id: PublicDocumentId
    artifact_type: str
    current_draft_id: DraftId
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True, slots=True)
class Draft:
    draft_id: DraftId
    artifact_id: ArtifactId
    revision: DraftRevision
    content_ref: ContentRef
    attachment_ids: tuple[AttachmentId, ...] = ()
    title: str = ""
    description: str = ""
    tags: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class VersionSnapshot:
    version_id: VersionId
    artifact_id: ArtifactId
    version_number: int
    source_draft_revision: DraftRevision
    content_ref: ContentRef
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    attachment_ids: tuple[AttachmentId, ...] = ()
    title: str = ""
    description: str = ""
    artifact_type: str = ""
    tags: tuple[str, ...] = ()
    change_summary: str = ""

    def __post_init__(self) -> None:
        if self.version_number < 1:
            raise InvalidIdentifier("Version number must be positive")


@dataclass(frozen=True, slots=True)
class Attachment:
    attachment_id: AttachmentId
    project_id: ProjectId
    artifact_id: ArtifactId
    media_type: AttachmentMediaType
    object_ref: AttachmentObjectRef


@dataclass(frozen=True, slots=True)
class TraceLink:
    trace_link_id: TraceLinkId
    project_id: ProjectId
    story_id: str
    requirement_id: str
    test_case_id: str
    status: str


@dataclass(frozen=True, slots=True)
class AiSessionMessage:
    """A successful U4 conversation message persisted with its temporary session."""

    role: str
    content: str
    created_at: datetime

    def __post_init__(self) -> None:
        if self.role not in {"user", "assistant"} or not self.content:
            raise InvalidIdentifier("AI session message must have a supported role and content")


@dataclass(frozen=True, slots=True)
class AiWorkspaceSession:
    session_id: AiSessionId
    project_id: ProjectId
    preview_content_ref: ContentRef | None
    expires_at: datetime
    messages: tuple[AiSessionMessage, ...] = ()

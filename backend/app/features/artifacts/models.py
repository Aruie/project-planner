"""U2 application DTOs and validation rules."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ArtifactType = Literal["MarkdownDocument", "ExcelDocument"]
SourceKind = Literal["draft", "version"]


class ArtifactMetadata(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=4000)
    artifact_type: ArtifactType
    tags: tuple[str, ...] = ()

    @field_validator("title", "description", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> str:
        return str(value).strip()

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> tuple[str, ...]:
        values = value or ()
        normalized = {str(tag).strip().lower() for tag in values if str(tag).strip()}
        return tuple(sorted(normalized))


class CreateArtifactRequest(BaseModel):
    metadata: ArtifactMetadata
    content: str = ""


class UpdateDraftRequest(BaseModel):
    expected_revision: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=4000)
    tags: tuple[str, ...] = ()
    content: str

    @field_validator("title", "description", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> str:
        return str(value).strip()

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> tuple[str, ...]:
        return ArtifactMetadata.normalize_tags(value)


class DeleteArtifactRequest(BaseModel):
    confirmation_title: str = Field(min_length=1, max_length=500)

    @field_validator("confirmation_title", mode="before")
    @classmethod
    def normalize_confirmation_title(cls, value: object) -> str:
        return str(value).strip()


class ArtifactResponse(BaseModel):
    artifact_id: str
    project_id: str
    public_document_id: str
    artifact_type: ArtifactType
    draft_id: str
    revision: int
    title: str
    description: str
    tags: tuple[str, ...]


class ArtifactDetailResponse(ArtifactResponse):
    content: str


class ConfirmVersionRequest(BaseModel):
    change_summary: str = Field(min_length=1, max_length=2000)

    @field_validator("change_summary", mode="before")
    @classmethod
    def normalize_summary(cls, value: object) -> str:
        return str(value).strip()


class VersionResponse(BaseModel):
    version_id: str
    version_number: int
    source_draft_revision: int
    created_at: datetime
    title: str
    description: str
    tags: tuple[str, ...]
    change_summary: str


class DiffSourceRequest(BaseModel):
    kind: SourceKind
    version_id: str | None = None


class DiffRequest(BaseModel):
    left: DiffSourceRequest
    right: DiffSourceRequest


class MetadataChange(BaseModel):
    field: str
    before: object
    after: object


class LineHunk(BaseModel):
    kind: Literal["added", "removed", "unchanged"]
    before: tuple[str, ...]
    after: tuple[str, ...]


class DiffResult(BaseModel):
    left: DiffSourceRequest
    right: DiffSourceRequest
    metadata_changes: tuple[MetadataChange, ...]
    body_hunks: tuple[LineHunk, ...]
    summary: dict[str, int]


class TraceLinkRequest(BaseModel):
    story_id: str = Field(min_length=1, max_length=200)
    requirement_id: str = Field(min_length=1, max_length=200)
    test_case_id: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=100)

    @field_validator("story_id", "requirement_id", "test_case_id", "status", mode="before")
    @classmethod
    def normalize_required(cls, value: object) -> str:
        return str(value).strip()


class TraceLinkResponse(TraceLinkRequest):
    trace_link_id: str


class TraceGapResult(BaseModel):
    story_ids: tuple[str, ...]
    requirement_ids: tuple[str, ...]
    test_case_ids: tuple[str, ...]


class TraceGapRequest(BaseModel):
    story_ids: tuple[str, ...] = ()
    requirement_ids: tuple[str, ...] = ()
    test_case_ids: tuple[str, ...] = ()


class Page(BaseModel):
    items: tuple[object, ...]
    next_token: str | None


class ApiError(BaseModel):
    code: str
    message: str
    retryable: bool
    current_revision: int | None = None

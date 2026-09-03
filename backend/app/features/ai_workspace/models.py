"""Typed U4 API and application models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AiMessage(BaseModel):
    role: str
    content: str
    created_at: datetime


class AiWorkspaceState(BaseModel):
    session_id: str
    project_id: str
    messages: tuple[AiMessage, ...] = ()
    preview: str | None = None
    expires_at: datetime


class StartSessionRequest(BaseModel):
    session_id: str | None = None


class SendMessageRequest(BaseModel):
    prompt: str = Field(min_length=1)

    @field_validator("prompt", mode="before")
    @classmethod
    def normalize_prompt(cls, value: object) -> str:
        return str(value).strip()


class ReviewedPreviewSaveRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    tags: tuple[str, ...] = ()

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> str:
        return str(value).strip()


class ReviewedPreviewSaveResponse(BaseModel):
    artifact_id: str
    project_id: str
    public_document_id: str
    artifact_type: str
    draft_id: str
    revision: int
    title: str
    description: str
    tags: tuple[str, ...]


class AiApiError(BaseModel):
    code: str
    message: str
    retryable: bool

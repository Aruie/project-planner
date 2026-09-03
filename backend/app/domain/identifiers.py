"""U1 immutable UUID and project-local public document identifiers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Self
from uuid import UUID, uuid4

from app.domain.errors import InvalidIdentifier

_PREFIX_PATTERN = re.compile(r"^[A-Z][A-Z0-9]{1,9}$")
_PUBLIC_DOCUMENT_ID_PATTERN = re.compile(r"^([A-Z][A-Z0-9]{1,9})-([0-9]{3,})$")


@dataclass(frozen=True, slots=True)
class UuidIdentifier:
    value: UUID

    @classmethod
    def new(cls: type[Self]) -> Self:
        return cls(uuid4())

    @classmethod
    def parse(cls: type[Self], raw: str) -> Self:
        try:
            return cls(UUID(raw))
        except (ValueError, AttributeError) as error:
            raise InvalidIdentifier(f"Invalid {cls.__name__}") from error

    def __str__(self) -> str:
        return str(self.value)


class ProjectId(UuidIdentifier):
    pass


class ArtifactId(UuidIdentifier):
    pass


class DraftId(UuidIdentifier):
    pass


class VersionId(UuidIdentifier):
    pass


class AttachmentId(UuidIdentifier):
    pass


class TraceLinkId(UuidIdentifier):
    pass


class AiSessionId(UuidIdentifier):
    pass


@dataclass(frozen=True, slots=True)
class DocumentIdPrefix:
    value: str

    def __post_init__(self) -> None:
        if not _PREFIX_PATTERN.fullmatch(self.value):
            raise InvalidIdentifier(
                "Document ID prefix must be 2-10 uppercase alphanumeric characters"
            )


@dataclass(frozen=True, slots=True)
class PublicDocumentId:
    prefix: DocumentIdPrefix
    sequence: int

    def __post_init__(self) -> None:
        if self.sequence < 1:
            raise InvalidIdentifier("Document ID sequence must be positive")

    def __str__(self) -> str:
        return f"{self.prefix.value}-{self.sequence:03d}"

    @classmethod
    def parse(cls, raw: str) -> Self:
        match = _PUBLIC_DOCUMENT_ID_PATTERN.fullmatch(raw)
        if match is None:
            raise InvalidIdentifier("Invalid public document ID")
        return cls(DocumentIdPrefix(match.group(1)), int(match.group(2)))

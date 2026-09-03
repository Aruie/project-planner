"""Attachment metadata validation independent of binary object storage."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.constants import ALLOWED_ATTACHMENT_MEDIA_TYPES, ATTACHMENT_MAX_BYTES
from app.domain.errors import DomainError

_CHECKSUM_PATTERN = re.compile(r"^[a-f0-9]{64}$")


class AttachmentTypeNotAllowed(DomainError):
    code = "ATTACHMENT_TYPE_NOT_ALLOWED"


class AttachmentTooLarge(DomainError):
    code = "ATTACHMENT_TOO_LARGE"


@dataclass(frozen=True, slots=True)
class AttachmentMediaType:
    value: str

    def __post_init__(self) -> None:
        if self.value not in ALLOWED_ATTACHMENT_MEDIA_TYPES:
            raise AttachmentTypeNotAllowed("Only PNG and JPEG attachments are allowed")


@dataclass(frozen=True, slots=True)
class AttachmentSize:
    value: int

    def __post_init__(self) -> None:
        if not 1 <= self.value <= ATTACHMENT_MAX_BYTES:
            raise AttachmentTooLarge("Attachment size must be between 1 byte and 5 MiB")


@dataclass(frozen=True, slots=True)
class AttachmentObjectRef:
    object_key: str
    byte_size: AttachmentSize
    checksum: str

    def __post_init__(self) -> None:
        if not self.object_key:
            raise ValueError("Attachment object key is required")
        if not _CHECKSUM_PATTERN.fullmatch(self.checksum):
            raise ValueError("Attachment checksum must be a SHA-256 hex digest")

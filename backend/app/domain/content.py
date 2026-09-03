"""Normalized content references with deterministic size and checksum metadata."""

from __future__ import annotations

import re
from dataclasses import dataclass
from hashlib import sha256

from app.domain.constants import INLINE_CONTENT_MAX_BYTES
from app.domain.errors import ContentStorageFailure

_CHECKSUM_PATTERN = re.compile(r"^[a-f0-9]{64}$")


def normalized_content_bytes(content: str) -> bytes:
    return content.encode("utf-8")


def content_checksum(content: str) -> str:
    return sha256(normalized_content_bytes(content)).hexdigest()


@dataclass(frozen=True, slots=True)
class InlineContentRef:
    content: str
    byte_size: int
    checksum: str

    @classmethod
    def from_content(cls, content: str) -> InlineContentRef:
        byte_size = len(normalized_content_bytes(content))
        if byte_size > INLINE_CONTENT_MAX_BYTES:
            raise ContentStorageFailure("Content exceeds inline storage limit")
        return cls(content=content, byte_size=byte_size, checksum=content_checksum(content))

    def __post_init__(self) -> None:
        if self.byte_size != len(normalized_content_bytes(self.content)):
            raise ValueError("Inline content byte size does not match content")
        if self.checksum != content_checksum(self.content):
            raise ValueError("Inline content checksum does not match content")
        if self.byte_size > INLINE_CONTENT_MAX_BYTES:
            raise ValueError("Inline content exceeds storage limit")


@dataclass(frozen=True, slots=True)
class S3ContentRef:
    object_key: str
    byte_size: int
    checksum: str

    def __post_init__(self) -> None:
        if not self.object_key:
            raise ValueError("S3 object key is required")
        if self.byte_size <= INLINE_CONTENT_MAX_BYTES:
            raise ValueError("S3 content must exceed inline storage limit")
        if not _CHECKSUM_PATTERN.fullmatch(self.checksum):
            raise ValueError("S3 content checksum must be a SHA-256 hex digest")


type ContentRef = InlineContentRef | S3ContentRef


def select_content_ref(content: str, *, object_key: str | None = None) -> ContentRef:
    """Select an inline ref or validate a caller-provided S3 target for large content."""

    byte_size = len(normalized_content_bytes(content))
    if byte_size <= INLINE_CONTENT_MAX_BYTES:
        return InlineContentRef.from_content(content)
    if object_key is None:
        raise ContentStorageFailure("Large content requires an S3 object key")
    return S3ContentRef(
        object_key=object_key,
        byte_size=byte_size,
        checksum=content_checksum(content),
    )


def content_ref_to_dict(reference: ContentRef) -> dict[str, object]:
    if isinstance(reference, InlineContentRef):
        return {
            "kind": "inline",
            "content": reference.content,
            "byte_size": reference.byte_size,
            "checksum": reference.checksum,
        }
    return {
        "kind": "s3",
        "object_key": reference.object_key,
        "byte_size": reference.byte_size,
        "checksum": reference.checksum,
    }


def content_ref_from_dict(payload: dict[str, object]) -> ContentRef:
    kind = payload.get("kind")
    if kind == "inline":
        return InlineContentRef(
            content=str(payload["content"]),
            byte_size=int(payload["byte_size"]),
            checksum=str(payload["checksum"]),
        )
    if kind == "s3":
        return S3ContentRef(
            object_key=str(payload["object_key"]),
            byte_size=int(payload["byte_size"]),
            checksum=str(payload["checksum"]),
        )
    raise ValueError("Unknown ContentRef kind")

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from app.domain.attachments import (
    AttachmentMediaType,
    AttachmentSize,
    AttachmentTooLarge,
    AttachmentTypeNotAllowed,
)
from app.domain.constants import ATTACHMENT_MAX_BYTES, INLINE_CONTENT_MAX_BYTES
from app.domain.content import InlineContentRef, S3ContentRef, select_content_ref
from app.domain.entities import DraftRevision, VersionSnapshot
from app.domain.errors import ContentStorageFailure, InvalidIdentifier
from app.domain.identifiers import ArtifactId, DraftId, ProjectId, VersionId


def test_content_at_inline_threshold_uses_inline_reference() -> None:
    content = "a" * INLINE_CONTENT_MAX_BYTES

    reference = select_content_ref(content)

    assert isinstance(reference, InlineContentRef)
    assert reference.byte_size == INLINE_CONTENT_MAX_BYTES


def test_content_above_threshold_requires_and_uses_s3_reference() -> None:
    content = "a" * (INLINE_CONTENT_MAX_BYTES + 1)

    with pytest.raises(ContentStorageFailure):
        select_content_ref(content)

    reference = select_content_ref(content, object_key="content/project/a")
    assert isinstance(reference, S3ContentRef)
    assert reference.byte_size == INLINE_CONTENT_MAX_BYTES + 1


@pytest.mark.parametrize("media_type", ["image/png", "image/jpeg"])
def test_attachment_allows_png_and_jpeg(media_type: str) -> None:
    assert AttachmentMediaType(media_type).value == media_type


def test_attachment_rejects_other_media_types_and_too_large_size() -> None:
    with pytest.raises(AttachmentTypeNotAllowed):
        AttachmentMediaType("image/gif")
    with pytest.raises(AttachmentTooLarge):
        AttachmentSize(ATTACHMENT_MAX_BYTES + 1)


def test_draft_revision_is_positive_and_increments_once() -> None:
    assert DraftRevision(1).next() == DraftRevision(2)
    with pytest.raises(InvalidIdentifier):
        DraftRevision(0)


def test_version_snapshot_is_immutable() -> None:
    snapshot = VersionSnapshot(
        version_id=VersionId.new(),
        artifact_id=ArtifactId.new(),
        version_number=1,
        source_draft_revision=DraftRevision(1),
        content_ref=InlineContentRef.from_content("draft"),
    )

    with pytest.raises(FrozenInstanceError):
        snapshot.version_number = 2  # type: ignore[misc]


def test_project_and_draft_identifiers_remain_typed() -> None:
    assert isinstance(ProjectId.new(), ProjectId)
    assert isinstance(DraftId.new(), DraftId)

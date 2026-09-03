from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.attachments import (
    AttachmentMediaType,
    AttachmentSize,
    AttachmentTooLarge,
    AttachmentTypeNotAllowed,
)
from app.domain.constants import ATTACHMENT_MAX_BYTES, INLINE_CONTENT_MAX_BYTES
from app.domain.content import content_ref_from_dict, content_ref_to_dict, select_content_ref
from app.domain.entities import DraftRevision
from app.domain.errors import ContentStorageFailure
from app.domain.identifiers import PublicDocumentId

from ...support.strategies.u1 import (
    attachment_metadata,
    content_refs,
    draft_revisions,
    public_document_ids,
)


@settings(max_examples=40)
@given(content_refs())
def test_content_ref_serialization_round_trip(reference) -> None:
    assert content_ref_from_dict(content_ref_to_dict(reference)) == reference


@settings(max_examples=40)
@given(public_document_ids())
def test_public_document_id_format_parse_round_trip(document_id: PublicDocumentId) -> None:
    assert PublicDocumentId.parse(str(document_id)) == document_id


@settings(max_examples=30)
@given(draft_revisions())
def test_successful_revision_transition_increments_exactly_once(revision: DraftRevision) -> None:
    assert revision.next().value == revision.value + 1


@settings(max_examples=6)
@given(
    st.sampled_from(
        [INLINE_CONTENT_MAX_BYTES - 1, INLINE_CONTENT_MAX_BYTES, INLINE_CONTENT_MAX_BYTES + 1]
    )
)
def test_storage_threshold_partition(byte_size: int) -> None:
    content = "x" * byte_size
    if byte_size <= INLINE_CONTENT_MAX_BYTES:
        assert select_content_ref(content).__class__.__name__ == "InlineContentRef"
    else:
        reference = select_content_ref(content, object_key="content/property")
        assert reference.__class__.__name__ == "S3ContentRef"
        with pytest.raises(ContentStorageFailure):
            select_content_ref(content)


@settings(max_examples=30)
@given(attachment_metadata())
def test_valid_attachment_metadata_obeys_mime_and_size_invariants(metadata) -> None:
    media_type, size = metadata
    assert media_type.value in {"image/png", "image/jpeg"}
    assert 1 <= size.value <= ATTACHMENT_MAX_BYTES


@given(st.sampled_from(["image/gif", "text/plain"]), st.sampled_from([0, ATTACHMENT_MAX_BYTES + 1]))
def test_invalid_attachment_values_are_rejected(media_type: str, size: int) -> None:
    with pytest.raises(AttachmentTypeNotAllowed):
        AttachmentMediaType(media_type)
    with pytest.raises(AttachmentTooLarge):
        AttachmentSize(size)

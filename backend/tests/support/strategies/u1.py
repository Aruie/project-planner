from __future__ import annotations

from hypothesis import strategies as st

from app.domain.attachments import AttachmentMediaType, AttachmentSize
from app.domain.constants import (
    ALLOWED_ATTACHMENT_MEDIA_TYPES,
    ATTACHMENT_MAX_BYTES,
    INLINE_CONTENT_MAX_BYTES,
)
from app.domain.content import InlineContentRef, S3ContentRef
from app.domain.entities import DraftRevision
from app.domain.identifiers import DocumentIdPrefix, PublicDocumentId


@st.composite
def document_prefixes(draw: st.DrawFn) -> DocumentIdPrefix:
    first = draw(st.sampled_from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))
    suffix = draw(st.text("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=9))
    return DocumentIdPrefix(first + suffix)


@st.composite
def public_document_ids(draw: st.DrawFn) -> PublicDocumentId:
    return PublicDocumentId(
        draw(document_prefixes()),
        draw(st.integers(min_value=1, max_value=1_000_000)),
    )


@st.composite
def content_refs(draw: st.DrawFn):
    kind = draw(st.sampled_from(["inline", "s3"]))
    if kind == "inline":
        return InlineContentRef.from_content(draw(st.text(max_size=200)))
    byte_size = draw(
        st.integers(
            min_value=INLINE_CONTENT_MAX_BYTES + 1,
            max_value=INLINE_CONTENT_MAX_BYTES + 10_000,
        )
    )
    return S3ContentRef("content/property", byte_size, "0" * 64)


def draft_revisions() -> st.SearchStrategy[DraftRevision]:
    return st.integers(min_value=1, max_value=1_000_000).map(DraftRevision)


def attachment_metadata():
    return st.tuples(
        st.sampled_from(sorted(ALLOWED_ATTACHMENT_MEDIA_TYPES)).map(AttachmentMediaType),
        st.integers(min_value=1, max_value=ATTACHMENT_MAX_BYTES).map(AttachmentSize),
    )

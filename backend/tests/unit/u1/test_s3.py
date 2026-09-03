from __future__ import annotations

from hashlib import sha256
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError

from app.domain.attachments import AttachmentMediaType
from app.domain.constants import INLINE_CONTENT_MAX_BYTES
from app.domain.errors import ContentStorageFailure
from app.persistence.s3 import S3ObjectStorageAdapter


def test_put_content_writes_large_object_and_returns_reference() -> None:
    client = Mock()
    content = b"x" * (INLINE_CONTENT_MAX_BYTES + 1)
    adapter = S3ObjectStorageAdapter(client, "bucket")

    reference = adapter.put_content("content/a", content, sha256(content).hexdigest())

    assert reference.object_key == "content/a"
    assert client.put_object.call_args.kwargs == {
        "Bucket": "bucket",
        "Key": "content/a",
        "Body": content,
    }


def test_put_attachment_persists_content_type_and_metadata() -> None:
    client = Mock()
    adapter = S3ObjectStorageAdapter(client, "bucket")

    reference = adapter.put_attachment(
        "attachments/a.png", b"png", AttachmentMediaType("image/png")
    )

    assert reference.byte_size.value == 3
    assert client.put_object.call_args.kwargs["ContentType"] == "image/png"


def test_content_checksum_mismatch_or_read_mismatch_preserves_failure() -> None:
    client = Mock()
    adapter = S3ObjectStorageAdapter(client, "bucket")
    content = b"x" * (INLINE_CONTENT_MAX_BYTES + 1)

    with pytest.raises(ContentStorageFailure):
        adapter.put_content("content/a", content, "0" * 64)


def test_cleanup_ignores_s3_failure() -> None:
    client = Mock()
    client.delete_object.side_effect = ClientError({"Error": {"Code": "NoSuchKey"}}, "DeleteObject")

    S3ObjectStorageAdapter(client, "bucket").delete_unreferenced("content/orphan")

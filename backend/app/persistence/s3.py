"""S3 implementation of U1 object storage with no automatic retries."""

from __future__ import annotations

from hashlib import sha256
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from app.domain.attachments import AttachmentMediaType, AttachmentObjectRef, AttachmentSize
from app.domain.content import S3ContentRef
from app.domain.errors import ContentStorageFailure


class S3ObjectStorageAdapter:
    def __init__(self, client: Any, bucket_name: str) -> None:
        self._client = client
        self._bucket_name = bucket_name

    def put_content(self, object_key: str, content: bytes, checksum: str) -> S3ContentRef:
        computed_checksum = sha256(content).hexdigest()
        if computed_checksum != checksum:
            raise ContentStorageFailure("Content checksum does not match object bytes")
        try:
            self._client.put_object(Bucket=self._bucket_name, Key=object_key, Body=content)
        except (BotoCoreError, ClientError) as error:
            raise ContentStorageFailure("S3 content write failed") from error
        return S3ContentRef(object_key=object_key, byte_size=len(content), checksum=checksum)

    def get_content(self, reference: S3ContentRef) -> bytes:
        content = self._get_bytes(reference.object_key)
        if len(content) != reference.byte_size or sha256(content).hexdigest() != reference.checksum:
            raise ContentStorageFailure("S3 content reference integrity check failed")
        return content

    def put_attachment(
        self, object_key: str, content: bytes, media_type: AttachmentMediaType
    ) -> AttachmentObjectRef:
        checksum = sha256(content).hexdigest()
        try:
            self._client.put_object(
                Bucket=self._bucket_name,
                Key=object_key,
                Body=content,
                ContentType=media_type.value,
            )
        except (BotoCoreError, ClientError) as error:
            raise ContentStorageFailure("S3 attachment write failed") from error
        return AttachmentObjectRef(object_key, AttachmentSize(len(content)), checksum)

    def get_attachment(self, reference: AttachmentObjectRef) -> bytes:
        content = self._get_bytes(reference.object_key)
        if (
            len(content) != reference.byte_size.value
            or sha256(content).hexdigest() != reference.checksum
        ):
            raise ContentStorageFailure("S3 attachment reference integrity check failed")
        return content

    def delete_unreferenced(self, object_key: str) -> None:
        """Best-effort cleanup; cleanup failure must not overwrite a prior domain result."""
        try:
            self._client.delete_object(Bucket=self._bucket_name, Key=object_key)
        except (BotoCoreError, ClientError):
            return None

    def _get_bytes(self, object_key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self._bucket_name, Key=object_key)
            return response["Body"].read()
        except (BotoCoreError, ClientError) as error:
            raise ContentStorageFailure("S3 object read failed") from error

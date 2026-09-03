from __future__ import annotations

from hashlib import sha256

import boto3
from botocore.stub import Stubber

from app.domain.constants import INLINE_CONTENT_MAX_BYTES
from app.domain.identifiers import ProjectId
from app.persistence.dynamodb import DynamoDbProjectRepository, DynamoDbTables
from app.persistence.s3 import S3ObjectStorageAdapter


def _client(service_name: str):
    return boto3.client(
        service_name,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def test_dynamodb_public_id_allocation_contract_uses_atomic_condition() -> None:
    client = _client("dynamodb")
    tables = DynamoDbTables("projects", "artifacts", "versions", "attachments", "links", "sessions")
    project_id = ProjectId.parse("123e4567-e89b-12d3-a456-426614174000")
    expected = {
        "TableName": "projects",
        "Key": {"project_id": {"S": str(project_id)}},
        "UpdateExpression": "SET next_sequence = next_sequence + :one",
        "ConditionExpression": "attribute_exists(project_id)",
        "ExpressionAttributeValues": {":one": {"N": "1"}},
        "ReturnValues": "ALL_OLD",
    }

    with Stubber(client) as stubber:
        stubber.add_response(
            "update_item",
            {"Attributes": {"prefix": {"S": "CKA"}, "next_sequence": {"N": "7"}}},
            expected,
        )
        repository = DynamoDbProjectRepository(client, tables)
        document_id = repository.allocate_public_document_id(project_id)

    assert str(document_id) == "CKA-007"


def test_s3_content_write_contract_uses_bucket_key_and_unchanged_bytes() -> None:
    client = _client("s3")
    content = b"x" * (INLINE_CONTENT_MAX_BYTES + 1)
    checksum = sha256(content).hexdigest()

    with Stubber(client) as stubber:
        stubber.add_response(
            "put_object",
            {},
            {"Bucket": "content-bucket", "Key": "content/project/object", "Body": content},
        )
        reference = S3ObjectStorageAdapter(client, "content-bucket").put_content(
            "content/project/object", content, checksum
        )

    assert reference.checksum == checksum
    assert reference.byte_size == len(content)

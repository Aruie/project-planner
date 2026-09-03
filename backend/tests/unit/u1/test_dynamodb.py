from __future__ import annotations

import json
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError

from app.domain.attachments import AttachmentMediaType, AttachmentObjectRef, AttachmentSize
from app.domain.content import InlineContentRef
from app.domain.entities import Attachment, Draft, DraftRevision, Project, VersionSnapshot
from app.domain.errors import DraftRevisionConflict, ImmutableSnapshotMutation
from app.domain.identifiers import (
    ArtifactId,
    AttachmentId,
    DocumentIdPrefix,
    DraftId,
    ProjectId,
    VersionId,
)
from app.persistence.dynamodb import (
    DynamoDbArtifactRepository,
    DynamoDbAttachmentRepository,
    DynamoDbProjectRepository,
    DynamoDbTables,
    DynamoDbVersionRepository,
)


@pytest.fixture
def tables() -> DynamoDbTables:
    return DynamoDbTables("projects", "artifacts", "versions", "attachments", "links", "sessions")


def conditional_error() -> ClientError:
    return ClientError({"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem")


def test_allocate_document_id_uses_atomic_update_and_previous_sequence(
    tables: DynamoDbTables,
) -> None:
    client = Mock()
    client.update_item.return_value = {
        "Attributes": {"prefix": {"S": "CKA"}, "next_sequence": {"N": "1"}}
    }

    result = DynamoDbProjectRepository(client, tables).allocate_public_document_id(ProjectId.new())

    assert str(result) == "CKA-001"
    assert (
        client.update_item.call_args.kwargs["ConditionExpression"] == "attribute_exists(project_id)"
    )


def test_replace_draft_maps_conditional_failure_to_conflict(tables: DynamoDbTables) -> None:
    client = Mock()
    client.update_item.side_effect = conditional_error()
    artifact_id = ArtifactId.new()
    draft = Draft(
        DraftId.new(), artifact_id, DraftRevision(2), InlineContentRef.from_content("new")
    )

    with pytest.raises(DraftRevisionConflict):
        DynamoDbArtifactRepository(client, tables).replace_draft(
            ProjectId.new(), artifact_id, DraftRevision(1), draft
        )


def test_version_append_rejects_existing_snapshot(tables: DynamoDbTables) -> None:
    client = Mock()
    client.put_item.side_effect = conditional_error()
    snapshot = VersionSnapshot(
        VersionId.new(), ArtifactId.new(), 1, DraftRevision(1), InlineContentRef.from_content("x")
    )

    with pytest.raises(ImmutableSnapshotMutation):
        DynamoDbVersionRepository(client, tables).append(snapshot)


def test_version_append_conditions_artifact_version_number(tables: DynamoDbTables) -> None:
    client = Mock()
    snapshot = VersionSnapshot(
        VersionId.new(), ArtifactId.new(), 1, DraftRevision(1), InlineContentRef.from_content("x")
    )

    DynamoDbVersionRepository(client, tables).append(snapshot)

    assert (
        "attribute_not_exists(version_number)"
        in client.put_item.call_args.kwargs["ConditionExpression"]
    )


def test_project_list_scans_all_pages(tables: DynamoDbTables) -> None:
    client = Mock()
    first = {
        "project_id": {"S": "123e4567-e89b-12d3-a456-426614174000"},
        "name": {"S": "첫째"},
        "prefix": {"S": "ONE"},
        "next_sequence": {"N": "1"},
    }
    second = {
        "project_id": {"S": "123e4567-e89b-12d3-a456-426614174001"},
        "name": {"S": "둘째"},
        "prefix": {"S": "TWO"},
        "next_sequence": {"N": "2"},
    }
    client.scan.side_effect = [
        {"Items": [first], "LastEvaluatedKey": {"project_id": {"S": "next"}}},
        {"Items": [second]},
    ]
    values = DynamoDbProjectRepository(client, tables).list()
    assert [item.name for item in values] == ["첫째", "둘째"]
    assert client.scan.call_count == 2


def test_project_list_defaults_missing_information_fields(tables: DynamoDbTables) -> None:
    client = Mock()
    client.scan.return_value = {
        "Items": [
            {
                "project_id": {"S": "123e4567-e89b-12d3-a456-426614174000"},
                "name": {"S": "기존 프로젝트"},
                "prefix": {"S": "OLD"},
                "next_sequence": {"N": "1"},
            }
        ]
    }

    project = DynamoDbProjectRepository(client, tables).list()[0]

    assert project.task_name == ""
    assert project.contractor_name == ""
    assert project.client_name == ""
    assert project.organization_name == ""


def test_project_update_persists_project_owned_information(tables: DynamoDbTables) -> None:
    client = Mock()
    project = Project(
        ProjectId.new(),
        "프로젝트",
        DocumentIdPrefix("PRJ"),
        task_name="과제",
        contractor_name="수탁기관",
        client_name="발주처",
        organization_name="회사기관",
    )

    result = DynamoDbProjectRepository(client, tables).update(project)

    assert result == project
    values = client.update_item.call_args.kwargs["ExpressionAttributeValues"]
    assert values[":task_name"] == {"S": "과제"}
    assert values[":contractor_name"] == {"S": "수탁기관"}
    assert values[":client_name"] == {"S": "발주처"}
    assert values[":organization_name"] == {"S": "회사기관"}


def test_attachment_read_uses_two_key_schema_and_checks_artifact_ownership(
    tables: DynamoDbTables,
) -> None:
    client = Mock()
    project_id = ProjectId.new()
    artifact_id = ArtifactId.new()
    attachment_id = AttachmentId.new()
    client.get_item.return_value = {
        "Item": {
            "project_id": {"S": str(project_id)},
            "artifact_id": {"S": str(artifact_id)},
            "attachment_id": {"S": str(attachment_id)},
            "payload": {
                "S": json.dumps(
                    {
                        "media_type": "image/png",
                        "object_key": "attachments/object.png",
                        "byte_size": 3,
                        "checksum": "0" * 64,
                    }
                )
            },
        }
    }

    attachment = DynamoDbAttachmentRepository(client, tables).get(
        project_id, artifact_id, attachment_id
    )

    assert attachment == Attachment(
        attachment_id,
        project_id,
        artifact_id,
        AttachmentMediaType("image/png"),
        AttachmentObjectRef("attachments/object.png", AttachmentSize(3), "0" * 64),
    )
    assert client.get_item.call_args.kwargs["Key"] == {
        "project_id": {"S": str(project_id)},
        "attachment_id": {"S": str(attachment_id)},
    }

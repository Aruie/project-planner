import json
from datetime import UTC, datetime

import boto3
from botocore.stub import Stubber

from app.domain.content import InlineContentRef, content_ref_to_dict
from app.domain.entities import AiSessionMessage, AiWorkspaceSession
from app.domain.identifiers import AiSessionId, ProjectId
from app.persistence.dynamodb import DynamoDbAiSessionRepository, DynamoDbTables


def test_ai_session_save_contract_persists_scoped_payload_and_ttl_epoch() -> None:
    client = boto3.client(
        "dynamodb",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    project_id, session_id = ProjectId.new(), AiSessionId.new()
    expires_at = datetime(2026, 9, 4, tzinfo=UTC)
    preview = InlineContentRef.from_content("# preview")
    session = AiWorkspaceSession(
        session_id,
        project_id,
        preview,
        expires_at,
        (AiSessionMessage("user", "요구사항", datetime(2026, 9, 3, tzinfo=UTC)),),
    )
    payload = {
        "preview_content_ref": content_ref_to_dict(preview),
        "messages": [
            {"role": "user", "content": "요구사항", "created_at": "2026-09-03T00:00:00+00:00"}
        ],
    }
    expected = {
        "TableName": "sessions",
        "Item": {
            "session_id": {"S": str(session_id)},
            "project_id": {"S": str(project_id)},
            "expires_at_epoch": {"N": str(int(expires_at.timestamp()))},
            "payload": {"S": json.dumps(payload, sort_keys=True)},
        },
    }
    tables = DynamoDbTables("p", "a", "v", "a2", "t", "sessions")
    with Stubber(client) as stubber:
        stubber.add_response("put_item", {}, expected)
        assert DynamoDbAiSessionRepository(client, tables).save(session) == session


def test_ai_session_get_contract_round_trips_payload_and_scope_key() -> None:
    client = boto3.client(
        "dynamodb",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    project_id, session_id = ProjectId.new(), AiSessionId.new()
    expires_at = datetime(2026, 9, 4, tzinfo=UTC)
    payload = {"preview_content_ref": None, "messages": []}
    tables = DynamoDbTables("p", "a", "v", "a2", "t", "sessions")
    with Stubber(client) as stubber:
        stubber.add_response(
            "get_item",
            {
                "Item": {
                    "session_id": {"S": str(session_id)},
                    "project_id": {"S": str(project_id)},
                    "expires_at_epoch": {"N": str(int(expires_at.timestamp()))},
                    "payload": {"S": json.dumps(payload)},
                }
            },
            {"TableName": "sessions", "Key": {"session_id": {"S": str(session_id)}}},
        )
        restored = DynamoDbAiSessionRepository(client, tables).get(project_id, session_id)
    assert restored.expires_at == expires_at
    assert restored.project_id == project_id

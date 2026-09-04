"""DynamoDB adapters using injected low-level clients and U1 domain errors."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from botocore.exceptions import ClientError

from app.domain.content import content_ref_from_dict, content_ref_to_dict
from app.domain.entities import Draft, DraftRevision, Project, TraceLink, VersionSnapshot
from app.domain.errors import (
    ArtifactNotFound,
    DraftRevisionConflict,
    DuplicateProjectDocumentId,
    ImmutableSnapshotMutation,
    PersistenceOutcomeUnknown,
    ProjectNotFound,
    VersionNotFound,
)
from app.domain.identifiers import (
    ArtifactId,
    DocumentIdPrefix,
    DraftId,
    ProjectId,
    PublicDocumentId,
    TraceLinkId,
    VersionId,
)


@dataclass(frozen=True, slots=True)
class DynamoDbTables:
    projects: str
    artifacts: str
    artifact_versions: str
    attachments: str
    trace_links: str
    ai_workspace_sessions: str


def _error_code(error: ClientError) -> str:
    return error.response.get("Error", {}).get("Code", "Unknown")


def _item_string(item: dict[str, Any], name: str) -> str:
    return item[name]["S"]


def _optional_item_string(item: dict[str, Any], name: str) -> str:
    value = item.get(name)
    return str(value["S"]) if value and "S" in value else ""


def _payload(item: dict[str, Any]) -> dict[str, object]:
    return json.loads(item["payload"]["S"])


def _content_payload(reference: object) -> dict[str, object]:
    return content_ref_to_dict(reference)  # type: ignore[arg-type]


class DynamoDbProjectRepository:
    def __init__(self, client: Any, tables: DynamoDbTables) -> None:
        self._client, self._tables = client, tables

    def create(self, project: Project) -> Project:
        try:
            self._client.put_item(
                TableName=self._tables.projects,
                Item={
                    "project_id": {"S": str(project.project_id)},
                    "name": {"S": project.name},
                    "prefix": {"S": project.document_id_prefix.value},
                    "next_sequence": {"N": str(project.next_document_sequence)},
                    "task_name": {"S": project.task_name},
                    "contractor_name": {"S": project.contractor_name},
                    "client_name": {"S": project.client_name},
                    "organization_name": {"S": project.organization_name},
                },
                ConditionExpression="attribute_not_exists(project_id)",
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise DuplicateProjectDocumentId("Project already exists") from error
            raise PersistenceOutcomeUnknown("Project create outcome is unknown") from error
        return project

    def get(self, project_id: ProjectId) -> Project:
        try:
            result = self._client.get_item(
                TableName=self._tables.projects, Key={"project_id": {"S": str(project_id)}}
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Project read outcome is unknown") from error
        item = result.get("Item")
        if item is None:
            raise ProjectNotFound("Project does not exist")
        return Project(
            project_id,
            _item_string(item, "name"),
            DocumentIdPrefix(_item_string(item, "prefix")),
            int(item["next_sequence"]["N"]),
            task_name=_optional_item_string(item, "task_name"),
            contractor_name=_optional_item_string(item, "contractor_name"),
            client_name=_optional_item_string(item, "client_name"),
            organization_name=_optional_item_string(item, "organization_name"),
        )

    def list(self) -> tuple[Project, ...]:
        items: list[dict[str, Any]] = []
        start_key: dict[str, Any] | None = None
        try:
            while True:
                request: dict[str, Any] = {"TableName": self._tables.projects}
                if start_key is not None:
                    request["ExclusiveStartKey"] = start_key
                response = self._client.scan(**request)
                items.extend(response.get("Items", []))
                start_key = response.get("LastEvaluatedKey")
                if start_key is None:
                    break
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Project list outcome is unknown") from error
        return tuple(
            Project(
                ProjectId.parse(_item_string(item, "project_id")),
                _item_string(item, "name"),
                DocumentIdPrefix(_item_string(item, "prefix")),
                int(item["next_sequence"]["N"]),
                task_name=_optional_item_string(item, "task_name"),
                contractor_name=_optional_item_string(item, "contractor_name"),
                client_name=_optional_item_string(item, "client_name"),
                organization_name=_optional_item_string(item, "organization_name"),
            )
            for item in items
        )

    def update(self, project: Project) -> Project:
        try:
            self._client.update_item(
                TableName=self._tables.projects,
                Key={"project_id": {"S": str(project.project_id)}},
                UpdateExpression=(
                    "SET #name = :name, task_name = :task_name, "
                    "contractor_name = :contractor_name, client_name = :client_name, "
                    "organization_name = :organization_name"
                ),
                ConditionExpression="attribute_exists(project_id)",
                ExpressionAttributeNames={"#name": "name"},
                ExpressionAttributeValues={
                    ":name": {"S": project.name},
                    ":task_name": {"S": project.task_name},
                    ":contractor_name": {"S": project.contractor_name},
                    ":client_name": {"S": project.client_name},
                    ":organization_name": {"S": project.organization_name},
                },
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ProjectNotFound("Project does not exist") from error
            raise PersistenceOutcomeUnknown("Project update outcome is unknown") from error
        return project

    def allocate_public_document_id(self, project_id: ProjectId) -> PublicDocumentId:
        try:
            response = self._client.update_item(
                TableName=self._tables.projects,
                Key={"project_id": {"S": str(project_id)}},
                UpdateExpression="SET next_sequence = next_sequence + :one",
                ConditionExpression="attribute_exists(project_id)",
                ExpressionAttributeValues={":one": {"N": "1"}},
                ReturnValues="ALL_OLD",
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ProjectNotFound("Project does not exist") from error
            raise PersistenceOutcomeUnknown("Document ID allocation outcome is unknown") from error
        attributes = response["Attributes"]
        return PublicDocumentId.parse(
            f"{_item_string(attributes, 'prefix')}-{int(attributes['next_sequence']['N']):03d}"
        )


class DynamoDbArtifactRepository:
    def __init__(self, client: Any, tables: DynamoDbTables) -> None:
        self._client, self._tables = client, tables

    def create(self, artifact, draft: Draft):
        item = self._item(artifact, draft)
        try:
            self._client.put_item(
                TableName=self._tables.artifacts,
                Item=item,
                ConditionExpression="attribute_not_exists(artifact_id)",
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ImmutableSnapshotMutation("Artifact already exists") from error
            raise PersistenceOutcomeUnknown("Artifact create outcome is unknown") from error
        return artifact

    def get(self, project_id: ProjectId, artifact_id: ArtifactId):
        item = self._read(project_id, artifact_id)
        return self._artifact(item)

    def get_draft(self, project_id: ProjectId, artifact_id: ArtifactId) -> Draft:
        return self._draft(self._read(project_id, artifact_id))

    def list_for_project(self, project_id: ProjectId):
        try:
            response = self._client.query(
                TableName=self._tables.artifacts,
                KeyConditionExpression="project_id = :project_id",
                ExpressionAttributeValues={":project_id": {"S": str(project_id)}},
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Artifact list outcome is unknown") from error
        return tuple(self._artifact(item) for item in response.get("Items", []))

    def delete(self, project_id: ProjectId, artifact_id: ArtifactId) -> None:
        try:
            self._client.delete_item(
                TableName=self._tables.artifacts,
                Key={"project_id": {"S": str(project_id)}, "artifact_id": {"S": str(artifact_id)}},
                ConditionExpression="attribute_exists(artifact_id)",
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ArtifactNotFound("Artifact does not exist") from error
            raise PersistenceOutcomeUnknown("Artifact delete outcome is unknown") from error

    def replace_draft(self, project_id, artifact_id, expected_revision, replacement):
        if replacement.revision != expected_revision.next():
            raise ValueError("Replacement Draft revision must increment expected revision by one")
        values = {
            ":payload": {"S": json.dumps(self._draft_payload(replacement), sort_keys=True)},
            ":revision": {"N": str(replacement.revision.value)},
            ":expected": {"N": str(expected_revision.value)},
        }
        try:
            self._client.update_item(
                TableName=self._tables.artifacts,
                Key={"project_id": {"S": str(project_id)}, "artifact_id": {"S": str(artifact_id)}},
                UpdateExpression="SET draft_payload = :payload, draft_revision = :revision",
                ConditionExpression="draft_revision = :expected AND attribute_exists(artifact_id)",
                ExpressionAttributeValues=values,
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise DraftRevisionConflict(expected_revision.value) from error
            raise PersistenceOutcomeUnknown("Draft replacement outcome is unknown") from error
        return replacement

    def _read(self, project_id: ProjectId, artifact_id: ArtifactId) -> dict[str, Any]:
        try:
            result = self._client.get_item(
                TableName=self._tables.artifacts,
                Key={"project_id": {"S": str(project_id)}, "artifact_id": {"S": str(artifact_id)}},
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Artifact read outcome is unknown") from error
        if (item := result.get("Item")) is None:
            raise ArtifactNotFound("Artifact does not exist")
        return item

    def _item(self, artifact, draft: Draft) -> dict[str, Any]:
        return {
            "project_id": {"S": str(artifact.project_id)},
            "artifact_id": {"S": str(artifact.artifact_id)},
            "payload": {
                "S": json.dumps(
                    {
                        "public_document_id": str(artifact.public_document_id),
                        "artifact_type": artifact.artifact_type,
                        "draft_id": str(artifact.current_draft_id),
                    },
                    sort_keys=True,
                )
            },
            "draft_payload": {"S": json.dumps(self._draft_payload(draft), sort_keys=True)},
            "draft_revision": {"N": str(draft.revision.value)},
        }

    def _artifact(self, item: dict[str, Any]):
        from app.domain.entities import Artifact

        payload = _payload(item)
        return Artifact(
            ArtifactId.parse(_item_string(item, "artifact_id")),
            ProjectId.parse(_item_string(item, "project_id")),
            PublicDocumentId.parse(str(payload["public_document_id"])),
            str(payload["artifact_type"]),
            DraftId.parse(str(payload["draft_id"])),
        )

    def _draft_payload(self, draft: Draft) -> dict[str, object]:
        return {
            "draft_id": str(draft.draft_id),
            "content_ref": _content_payload(draft.content_ref),
            "attachment_ids": [str(value) for value in draft.attachment_ids],
            "title": draft.title,
            "description": draft.description,
            "tags": list(draft.tags),
        }

    def _draft(self, item: dict[str, Any]) -> Draft:
        data = json.loads(item["draft_payload"]["S"])
        return Draft(
            DraftId.parse(data["draft_id"]),
            ArtifactId.parse(_item_string(item, "artifact_id")),
            DraftRevision(int(item["draft_revision"]["N"])),
            content_ref_from_dict(data["content_ref"]),
            title=data["title"],
            description=data["description"],
            tags=tuple(data["tags"]),
        )


class DynamoDbVersionRepository:
    def __init__(self, client: Any, tables: DynamoDbTables) -> None:
        self._client, self._tables = client, tables

    def append(self, snapshot: VersionSnapshot) -> VersionSnapshot:
        payload = {
            "source_draft_revision": snapshot.source_draft_revision.value,
            "created_at": snapshot.created_at.isoformat(),
            "content_ref": _content_payload(snapshot.content_ref),
            "title": snapshot.title,
            "description": snapshot.description,
            "artifact_type": snapshot.artifact_type,
            "tags": list(snapshot.tags),
            "change_summary": snapshot.change_summary,
        }
        try:
            self._client.put_item(
                TableName=self._tables.artifact_versions,
                Item={
                    "artifact_id": {"S": str(snapshot.artifact_id)},
                    "version_number": {"N": str(snapshot.version_number)},
                    "version_id": {"S": str(snapshot.version_id)},
                    "payload": {"S": json.dumps(payload, sort_keys=True)},
                },
                ConditionExpression=(
                    "attribute_not_exists(version_id) AND attribute_not_exists(version_number)"
                ),
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ImmutableSnapshotMutation("VersionSnapshot already exists") from error
            raise PersistenceOutcomeUnknown("Version append outcome is unknown") from error
        return snapshot

    def get(self, artifact_id: ArtifactId, version_id: VersionId) -> VersionSnapshot:
        for version in self.list_for_artifact(artifact_id):
            if version.version_id == version_id:
                return version
        raise VersionNotFound("Version does not exist")

    def list_for_artifact(self, artifact_id: ArtifactId):
        try:
            response = self._client.query(
                TableName=self._tables.artifact_versions,
                KeyConditionExpression="artifact_id = :artifact_id",
                ExpressionAttributeValues={":artifact_id": {"S": str(artifact_id)}},
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Version list outcome is unknown") from error
        return tuple(self._version(item) for item in response.get("Items", []))

    def delete_for_artifact(self, artifact_id: ArtifactId) -> None:
        for snapshot in self.list_for_artifact(artifact_id):
            try:
                self._client.delete_item(
                    TableName=self._tables.artifact_versions,
                    Key={
                        "artifact_id": {"S": str(artifact_id)},
                        "version_number": {"N": str(snapshot.version_number)},
                    },
                )
            except ClientError as error:
                raise PersistenceOutcomeUnknown("Version delete outcome is unknown") from error

    def _version(self, item: dict[str, Any]) -> VersionSnapshot:
        data = _payload(item)
        return VersionSnapshot(
            VersionId.parse(_item_string(item, "version_id")),
            ArtifactId.parse(_item_string(item, "artifact_id")),
            int(item["version_number"]["N"]),
            DraftRevision(int(data["source_draft_revision"])),
            content_ref_from_dict(data["content_ref"]),
            created_at=(
                datetime.fromisoformat(str(data["created_at"]))
                if data.get("created_at")
                else datetime.fromtimestamp(0, UTC)
            ),
            title=str(data["title"]),
            description=str(data["description"]),
            artifact_type=str(data["artifact_type"]),
            tags=tuple(data["tags"]),
            change_summary=str(data.get("change_summary", "")),
        )


class DynamoDbMetadataRepository:
    def __init__(self, client: Any, tables: DynamoDbTables) -> None:
        self._client, self._tables = client, tables

    def save(self, link: TraceLink) -> TraceLink:
        try:
            self._client.put_item(
                TableName=self._tables.trace_links,
                Item={
                    "project_id": {"S": str(link.project_id)},
                    "trace_link_id": {"S": str(link.trace_link_id)},
                    "payload": {
                        "S": json.dumps(
                            {
                                "story_id": link.story_id,
                                "requirement_id": link.requirement_id,
                                "test_case_id": link.test_case_id,
                                "status": link.status,
                            },
                            sort_keys=True,
                        )
                    },
                },
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Trace link persistence outcome is unknown") from error
        return link

    def list_for_project(self, project_id: ProjectId):
        try:
            response = self._client.query(
                TableName=self._tables.trace_links,
                KeyConditionExpression="project_id = :project_id",
                ExpressionAttributeValues={":project_id": {"S": str(project_id)}},
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Trace link list outcome is unknown") from error
        return tuple(self._link(item) for item in response.get("Items", []))

    def get(self, project_id: ProjectId, trace_link_id: TraceLinkId) -> TraceLink:
        try:
            response = self._client.get_item(
                TableName=self._tables.trace_links,
                Key={
                    "project_id": {"S": str(project_id)},
                    "trace_link_id": {"S": str(trace_link_id)},
                },
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Trace link read outcome is unknown") from error
        if (item := response.get("Item")) is None:
            raise ArtifactNotFound("Trace link does not exist")
        return self._link(item)

    def _link(self, item: dict[str, Any]) -> TraceLink:
        data = _payload(item)
        return TraceLink(
            TraceLinkId.parse(_item_string(item, "trace_link_id")),
            ProjectId.parse(_item_string(item, "project_id")),
            str(data["story_id"]),
            str(data["requirement_id"]),
            str(data["test_case_id"]),
            str(data["status"]),
        )


class DynamoDbAttachmentRepository:
    def __init__(self, client: Any, tables: DynamoDbTables) -> None:
        self._client, self._tables = client, tables

    def save(self, attachment):
        try:
            self._client.put_item(
                TableName=self._tables.attachments,
                Item={
                    "project_id": {"S": str(attachment.project_id)},
                    "artifact_id": {"S": str(attachment.artifact_id)},
                    "attachment_id": {"S": str(attachment.attachment_id)},
                    "payload": {
                        "S": json.dumps(
                            {
                                "media_type": attachment.media_type.value,
                                "object_key": attachment.object_ref.object_key,
                                "byte_size": attachment.object_ref.byte_size.value,
                                "checksum": attachment.object_ref.checksum,
                                "filename": attachment.filename,
                                "markdown_path": attachment.markdown_path,
                                "thumbnail_media_type": (
                                    attachment.thumbnail_media_type.value
                                    if attachment.thumbnail_media_type
                                    else None
                                ),
                                "thumbnail_object_key": (
                                    attachment.thumbnail_ref.object_key
                                    if attachment.thumbnail_ref
                                    else None
                                ),
                                "thumbnail_byte_size": (
                                    attachment.thumbnail_ref.byte_size.value
                                    if attachment.thumbnail_ref
                                    else None
                                ),
                                "thumbnail_checksum": (
                                    attachment.thumbnail_ref.checksum
                                    if attachment.thumbnail_ref
                                    else None
                                ),
                            },
                            sort_keys=True,
                        )
                    },
                },
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Attachment persistence outcome is unknown") from error
        return attachment

    def get(self, project_id, artifact_id, attachment_id):
        from app.domain.attachments import AttachmentMediaType, AttachmentObjectRef, AttachmentSize
        from app.domain.entities import Attachment
        from app.domain.identifiers import AttachmentId

        try:
            response = self._client.get_item(
                TableName=self._tables.attachments,
                Key={
                    "project_id": {"S": str(project_id)},
                    "attachment_id": {"S": str(attachment_id)},
                },
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Attachment read outcome is unknown") from error
        if (item := response.get("Item")) is None or _item_string(item, "artifact_id") != str(
            artifact_id
        ):
            raise ArtifactNotFound("Attachment does not exist")
        data = _payload(item)
        thumbnail_key = data.get("thumbnail_object_key")
        thumbnail_ref = (
            AttachmentObjectRef(
                str(thumbnail_key),
                AttachmentSize(int(data["thumbnail_byte_size"])),
                str(data["thumbnail_checksum"]),
            )
            if thumbnail_key
            else None
        )
        thumbnail_media_type = (
            AttachmentMediaType(str(data["thumbnail_media_type"]))
            if data.get("thumbnail_media_type")
            else None
        )
        return Attachment(
            AttachmentId.parse(_item_string(item, "attachment_id")),
            project_id,
            artifact_id,
            AttachmentMediaType(str(data["media_type"])),
            AttachmentObjectRef(
                str(data["object_key"]),
                AttachmentSize(int(data["byte_size"])),
                str(data["checksum"]),
            ),
            filename=str(data.get("filename", "")),
            markdown_path=str(data.get("markdown_path", "")),
            thumbnail_media_type=thumbnail_media_type,
            thumbnail_ref=thumbnail_ref,
        )

    def list_for_artifact(self, project_id: ProjectId, artifact_id: ArtifactId):
        from app.domain.identifiers import AttachmentId

        try:
            response = self._client.query(
                TableName=self._tables.attachments,
                KeyConditionExpression="project_id = :project_id",
                ExpressionAttributeValues={":project_id": {"S": str(project_id)}},
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("Attachment list outcome is unknown") from error
        return tuple(
            self.get(
                project_id,
                artifact_id,
                AttachmentId.parse(_item_string(item, "attachment_id")),
            )
            for item in response.get("Items", [])
            if _item_string(item, "artifact_id") == str(artifact_id)
        )

    def delete_for_artifact(self, project_id: ProjectId, artifact_id: ArtifactId) -> None:
        for attachment in self.list_for_artifact(project_id, artifact_id):
            try:
                self._client.delete_item(
                    TableName=self._tables.attachments,
                    Key={
                        "project_id": {"S": str(project_id)},
                        "attachment_id": {"S": str(attachment.attachment_id)},
                    },
                )
            except ClientError as error:
                raise PersistenceOutcomeUnknown("Attachment delete outcome is unknown") from error


class DynamoDbAiSessionRepository:
    """Temporary U4 session snapshots stored with a DynamoDB TTL epoch attribute."""

    def __init__(self, client: Any, tables: DynamoDbTables) -> None:
        self._client, self._tables = client, tables

    def save(self, session) -> Any:
        from app.domain.entities import AiWorkspaceSession

        if not isinstance(session, AiWorkspaceSession):
            raise TypeError("AiWorkspaceSession is required")
        payload = {
            "preview_content_ref": (
                _content_payload(session.preview_content_ref)
                if session.preview_content_ref is not None
                else None
            ),
            "messages": [
                {
                    "role": message.role,
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                }
                for message in session.messages
            ],
            "proposal_target_artifact_id": (
                str(session.proposal_target_artifact_id)
                if session.proposal_target_artifact_id is not None
                else None
            ),
            "proposal_target_title": session.proposal_target_title,
            "proposal_changes": session.proposal_changes,
        }
        try:
            self._client.put_item(
                TableName=self._tables.ai_workspace_sessions,
                Item={
                    "session_id": {"S": str(session.session_id)},
                    "project_id": {"S": str(session.project_id)},
                    "expires_at_epoch": {"N": str(int(session.expires_at.timestamp()))},
                    "payload": {"S": json.dumps(payload, sort_keys=True)},
                },
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("AI session save outcome is unknown") from error
        return session

    def get(self, project_id, session_id):
        from datetime import UTC, datetime

        from app.domain.entities import AiSessionMessage, AiWorkspaceSession
        from app.domain.errors import AiSessionNotFound
        from app.domain.identifiers import ArtifactId, ProjectId

        try:
            response = self._client.get_item(
                TableName=self._tables.ai_workspace_sessions,
                Key={"session_id": {"S": str(session_id)}},
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("AI session read outcome is unknown") from error
        if (item := response.get("Item")) is None or _item_string(item, "project_id") != str(
            project_id
        ):
            raise AiSessionNotFound("AI session does not exist for the project")
        payload = _payload(item)
        preview = payload.get("preview_content_ref")
        messages = tuple(
            AiSessionMessage(
                role=str(message["role"]),
                content=str(message["content"]),
                created_at=datetime.fromisoformat(str(message["created_at"])),
            )
            for message in payload.get("messages", [])
        )
        target_artifact_id = payload.get("proposal_target_artifact_id")
        return AiWorkspaceSession(
            session_id=session_id,
            project_id=ProjectId.parse(_item_string(item, "project_id")),
            preview_content_ref=(
                content_ref_from_dict(preview) if isinstance(preview, dict) else None
            ),
            expires_at=datetime.fromtimestamp(int(item["expires_at_epoch"]["N"]), tz=UTC),
            messages=messages,
            proposal_target_artifact_id=(
                ArtifactId.parse(str(target_artifact_id)) if target_artifact_id else None
            ),
            proposal_target_title=str(payload.get("proposal_target_title", "")),
            proposal_changes=str(payload.get("proposal_changes", "")),
        )

    def expires_at(self, session_id):
        from datetime import UTC, datetime

        from app.domain.errors import AiSessionNotFound

        try:
            response = self._client.get_item(
                TableName=self._tables.ai_workspace_sessions,
                Key={"session_id": {"S": str(session_id)}},
                ProjectionExpression="expires_at_epoch",
            )
        except ClientError as error:
            raise PersistenceOutcomeUnknown("AI session expiry read outcome is unknown") from error
        if (item := response.get("Item")) is None:
            raise AiSessionNotFound("AI session does not exist")
        return datetime.fromtimestamp(int(item["expires_at_epoch"]["N"]), tz=UTC)

"""U3 attachment storage service using U1 ports only."""

from __future__ import annotations

from app.domain.attachments import AttachmentMediaType
from app.domain.entities import Attachment
from app.domain.identifiers import ArtifactId, AttachmentId, ProjectId
from app.domain.ports import AttachmentRepository, ObjectStoragePort

from .errors import ATTACHMENT_SCOPE_MISMATCH


class AttachmentService:
    def __init__(self, repository: AttachmentRepository, storage: ObjectStoragePort) -> None:
        self._repository, self._storage = repository, storage

    def upload(
        self, project_id: ProjectId, artifact_id: ArtifactId, media_type: str, content: bytes
    ) -> Attachment:
        attachment_id = AttachmentId.new()
        reference = self._storage.put_attachment(
            f"attachments/{project_id}/{artifact_id}/{attachment_id}",
            content,
            AttachmentMediaType(media_type),
        )
        attachment = Attachment(
            attachment_id, project_id, artifact_id, AttachmentMediaType(media_type), reference
        )
        try:
            return self._repository.save(attachment)
        except Exception:
            self._storage.delete_unreferenced(reference.object_key)
            raise

    def resolve(
        self, project_id: ProjectId, artifact_id: ArtifactId, attachment_id: AttachmentId
    ) -> tuple[Attachment, bytes]:
        attachment = self._repository.get(project_id, artifact_id, attachment_id)
        if attachment.project_id != project_id or attachment.artifact_id != artifact_id:
            raise ATTACHMENT_SCOPE_MISMATCH
        return attachment, self._storage.get_attachment(attachment.object_ref)

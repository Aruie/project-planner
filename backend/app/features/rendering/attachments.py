"""U3 image attachment storage using existing S3 and DynamoDB ports."""

from __future__ import annotations

import re
from pathlib import PurePath

from app.domain.attachments import AttachmentMediaType
from app.domain.entities import Attachment
from app.domain.identifiers import ArtifactId, AttachmentId, ProjectId
from app.domain.ports import AttachmentRepository, ObjectStoragePort

from .errors import ATTACHMENT_SCOPE_MISMATCH


def _safe_filename(filename: str, media_type: str, attachment_id: AttachmentId) -> str:
    suffix = ".png" if media_type == "image/png" else ".jpg"
    name = PurePath(filename.replace("\\", "/")).name.strip()
    name = re.sub(r"[^\w.()\-]", "_", name, flags=re.UNICODE)
    name = re.sub(r"_+", "_", name).strip("_.")
    if not name:
        return f"{attachment_id}{suffix}"
    if not name.lower().endswith((".png", ".jpg", ".jpeg")):
        return f"{name}{suffix}"
    return name


class AttachmentService:
    def __init__(self, repository: AttachmentRepository, storage: ObjectStoragePort) -> None:
        self._repository, self._storage = repository, storage

    def upload(
        self,
        project_id: ProjectId,
        artifact_id: ArtifactId,
        media_type: str,
        content: bytes,
        filename: str = "",
        thumbnail_media_type: str | None = None,
        thumbnail_content: bytes | None = None,
    ) -> Attachment:
        attachment_id = AttachmentId.new()
        original_type = AttachmentMediaType(media_type)
        safe_filename = _safe_filename(filename, media_type, attachment_id)
        markdown_path = f"assets/{safe_filename}"
        used_paths = {
            item.markdown_path
            for item in self._repository.list_for_artifact(project_id, artifact_id)
            if item.markdown_path
        }
        if markdown_path in used_paths:
            markdown_path = f"assets/{attachment_id}_{safe_filename}"

        object_key = f"attachments/{project_id}/{artifact_id}/{attachment_id}"
        original_ref = self._storage.put_attachment(object_key, content, original_type)
        thumbnail_ref = None
        thumbnail_type = None
        try:
            if thumbnail_content:
                thumbnail_type = AttachmentMediaType(thumbnail_media_type or media_type)
                thumbnail_ref = self._storage.put_attachment(
                    f"{object_key}/thumbnail", thumbnail_content, thumbnail_type
                )
            attachment = Attachment(
                attachment_id=attachment_id,
                project_id=project_id,
                artifact_id=artifact_id,
                media_type=original_type,
                object_ref=original_ref,
                filename=safe_filename,
                markdown_path=markdown_path,
                thumbnail_media_type=thumbnail_type,
                thumbnail_ref=thumbnail_ref,
            )
            return self._repository.save(attachment)
        except Exception:
            self._storage.delete_unreferenced(original_ref.object_key)
            if thumbnail_ref is not None:
                self._storage.delete_unreferenced(thumbnail_ref.object_key)
            raise

    def list(self, project_id: ProjectId, artifact_id: ArtifactId) -> tuple[Attachment, ...]:
        return self._repository.list_for_artifact(project_id, artifact_id)

    def resolve(
        self, project_id: ProjectId, artifact_id: ArtifactId, attachment_id: AttachmentId
    ) -> tuple[Attachment, bytes]:
        attachment = self._repository.get(project_id, artifact_id, attachment_id)
        if attachment.project_id != project_id or attachment.artifact_id != artifact_id:
            raise ATTACHMENT_SCOPE_MISMATCH
        return attachment, self._storage.get_attachment(attachment.object_ref)

    def resolve_thumbnail(self, attachment: Attachment) -> bytes | None:
        if attachment.thumbnail_ref is None:
            return None
        return self._storage.get_attachment(attachment.thumbnail_ref)

    def content(self, attachment: Attachment) -> bytes:
        return self._storage.get_attachment(attachment.object_ref)

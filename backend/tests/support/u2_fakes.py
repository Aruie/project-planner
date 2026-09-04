from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.content import S3ContentRef
from app.domain.entities import Artifact, Attachment, Draft, Project, TraceLink, VersionSnapshot
from app.domain.errors import (
    ArtifactNotFound,
    DraftRevisionConflict,
    ProjectNotFound,
    VersionNotFound,
)
from app.domain.identifiers import (
    ArtifactId,
    AttachmentId,
    ProjectId,
    PublicDocumentId,
    TraceLinkId,
    VersionId,
)


@dataclass
class FakeProjectRepository:
    project: Project

    def get(self, project_id: ProjectId) -> Project:
        if project_id != self.project.project_id:
            raise ProjectNotFound("missing")
        return self.project

    def update(self, project: Project) -> Project:
        self.project = project
        return project

    def allocate_public_document_id(self, project_id: ProjectId) -> PublicDocumentId:
        return self.get(project_id).allocate_document_id()


@dataclass
class FakeArtifactRepository:
    artifacts: dict[ArtifactId, Artifact] = field(default_factory=dict)
    drafts: dict[ArtifactId, Draft] = field(default_factory=dict)

    def create(self, artifact: Artifact, draft: Draft) -> Artifact:
        self.artifacts[artifact.artifact_id] = artifact
        self.drafts[artifact.artifact_id] = draft
        return artifact

    def get(self, project_id: ProjectId, artifact_id: ArtifactId) -> Artifact:
        artifact = self.artifacts.get(artifact_id)
        if artifact is None or artifact.project_id != project_id:
            raise ArtifactNotFound("missing")
        return artifact

    def get_draft(self, project_id: ProjectId, artifact_id: ArtifactId) -> Draft:
        self.get(project_id, artifact_id)
        return self.drafts[artifact_id]

    def list_for_project(self, project_id: ProjectId) -> tuple[Artifact, ...]:
        return tuple(item for item in self.artifacts.values() if item.project_id == project_id)

    def delete(self, project_id: ProjectId, artifact_id: ArtifactId) -> None:
        self.get(project_id, artifact_id)
        del self.artifacts[artifact_id]
        del self.drafts[artifact_id]

    def replace_draft(
        self, project_id: ProjectId, artifact_id: ArtifactId, expected, replacement: Draft
    ) -> Draft:
        current = self.get_draft(project_id, artifact_id)
        if current.revision != expected:
            raise DraftRevisionConflict(current.revision.value)
        self.drafts[artifact_id] = replacement
        return replacement


@dataclass
class FakeVersionRepository:
    values: dict[ArtifactId, list[VersionSnapshot]] = field(default_factory=dict)

    def append(self, snapshot: VersionSnapshot) -> VersionSnapshot:
        values = self.values.setdefault(snapshot.artifact_id, [])
        if any(item.version_number == snapshot.version_number for item in values):
            raise ValueError("duplicate version")
        values.append(snapshot)
        return snapshot

    def get(self, artifact_id: ArtifactId, version_id: VersionId) -> VersionSnapshot:
        for item in self.values.get(artifact_id, []):
            if item.version_id == version_id:
                return item
        raise VersionNotFound("missing")

    def list_for_artifact(self, artifact_id: ArtifactId) -> tuple[VersionSnapshot, ...]:
        return tuple(self.values.get(artifact_id, []))

    def delete_for_artifact(self, artifact_id: ArtifactId) -> None:
        self.values.pop(artifact_id, None)


@dataclass
class FakeAttachmentRepository:
    values: dict[AttachmentId, Attachment] = field(default_factory=dict)

    def save(self, attachment: Attachment) -> Attachment:
        self.values[attachment.attachment_id] = attachment
        return attachment

    def get(
        self, project_id: ProjectId, artifact_id: ArtifactId, attachment_id: AttachmentId
    ) -> Attachment:
        attachment = self.values[attachment_id]
        if attachment.project_id != project_id or attachment.artifact_id != artifact_id:
            raise KeyError(attachment_id)
        return attachment

    def list_for_artifact(
        self, project_id: ProjectId, artifact_id: ArtifactId
    ) -> tuple[Attachment, ...]:
        return tuple(
            item
            for item in self.values.values()
            if item.project_id == project_id and item.artifact_id == artifact_id
        )

    def delete_for_artifact(self, project_id: ProjectId, artifact_id: ArtifactId) -> None:
        self.values = {
            key: item
            for key, item in self.values.items()
            if item.project_id != project_id or item.artifact_id != artifact_id
        }


@dataclass
class FakeStorage:
    objects: dict[str, bytes] = field(default_factory=dict)

    def put_content(self, key: str, content: bytes, checksum: str) -> S3ContentRef:
        self.objects[key] = content
        return S3ContentRef(key, len(content), checksum)

    def put_attachment(self, key, content, media_type):
        from hashlib import sha256

        from app.domain.attachments import AttachmentObjectRef, AttachmentSize

        self.objects[key] = content
        return AttachmentObjectRef(key, AttachmentSize(len(content)), sha256(content).hexdigest())

    def get_attachment(self, reference):
        return self.objects[reference.object_key]

    def get_content(self, reference: S3ContentRef) -> bytes:
        return self.objects[reference.object_key]

    def delete_unreferenced(self, key: str) -> None:
        self.objects.pop(key, None)


@dataclass
class FakeTraceRepository:
    values: dict[TraceLinkId, TraceLink] = field(default_factory=dict)

    def save(self, link: TraceLink) -> TraceLink:
        self.values[link.trace_link_id] = link
        return link

    def list_for_project(self, project_id: ProjectId) -> tuple[TraceLink, ...]:
        return tuple(item for item in self.values.values() if item.project_id == project_id)

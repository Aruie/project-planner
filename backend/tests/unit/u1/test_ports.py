from __future__ import annotations

from typing import get_type_hints

from app.domain.attachments import AttachmentMediaType, AttachmentObjectRef, AttachmentSize
from app.domain.content import S3ContentRef
from app.domain.entities import Draft, DraftRevision, Project
from app.domain.identifiers import ArtifactId, DocumentIdPrefix, ProjectId, PublicDocumentId
from app.domain.ports import ArtifactRepository, ObjectStoragePort, ProjectRepository


class ProjectRepositoryFake:
    def create(self, project: Project) -> Project:
        return project

    def get(self, project_id: ProjectId) -> Project:
        return Project(project_id, "test", DocumentIdPrefix("TST"))

    def list(self) -> tuple[Project, ...]:
        return ()

    def update(self, project: Project) -> Project:
        return project

    def allocate_public_document_id(self, project_id: ProjectId) -> PublicDocumentId:
        return PublicDocumentId(DocumentIdPrefix("TST"), 1)


class ObjectStorageFake:
    def put_content(self, object_key: str, content: bytes, checksum: str) -> S3ContentRef:
        return S3ContentRef(object_key, len(content), checksum)

    def get_content(self, reference: S3ContentRef) -> bytes:
        return b"x" * reference.byte_size

    def put_attachment(
        self, object_key: str, content: bytes, media_type: AttachmentMediaType
    ) -> AttachmentObjectRef:
        return AttachmentObjectRef(object_key, AttachmentSize(len(content)), "0" * 64)

    def get_attachment(self, reference: AttachmentObjectRef) -> bytes:
        return b"x" * reference.byte_size.value

    def delete_unreferenced(self, object_key: str) -> None:
        return None


def test_project_repository_contract_is_runtime_checkable() -> None:
    assert isinstance(ProjectRepositoryFake(), ProjectRepository)


def test_object_storage_port_contract_is_runtime_checkable() -> None:
    assert isinstance(ObjectStorageFake(), ObjectStoragePort)


def test_artifact_repository_contract_exposes_conditional_replacement() -> None:
    hints = get_type_hints(ArtifactRepository.replace_draft)
    assert hints["expected_revision"] is DraftRevision
    assert hints["artifact_id"] is ArtifactId
    assert hints["replacement"] is Draft

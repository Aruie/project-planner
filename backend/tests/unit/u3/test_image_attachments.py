from dataclasses import dataclass, field
from hashlib import sha256

from app.domain.attachments import AttachmentMediaType, AttachmentObjectRef, AttachmentSize
from app.domain.identifiers import ArtifactId, ProjectId
from app.features.rendering.attachments import AttachmentService
from tests.support.u2_fakes import FakeAttachmentRepository


@dataclass
class AttachmentStorage:
    objects: dict[str, bytes] = field(default_factory=dict)

    def put_attachment(
        self, key: str, content: bytes, media_type: AttachmentMediaType
    ) -> AttachmentObjectRef:
        self.objects[key] = content
        return AttachmentObjectRef(key, AttachmentSize(len(content)), sha256(content).hexdigest())

    def get_attachment(self, reference: AttachmentObjectRef) -> bytes:
        return self.objects[reference.object_key]

    def delete_unreferenced(self, key: str) -> None:
        self.objects.pop(key, None)


def test_upload_stores_browser_thumbnail_separately_and_returns_markdown_path() -> None:
    repository = FakeAttachmentRepository()
    storage = AttachmentStorage()
    service = AttachmentService(repository, storage)

    attachment = service.upload(
        ProjectId.new(),
        ArtifactId.new(),
        "image/png",
        b"original-image",
        filename="20 기술검증서 img 109.png",
        thumbnail_media_type="image/png",
        thumbnail_content=b"small-thumbnail",
    )

    assert attachment.markdown_path == "assets/20_기술검증서_img_109.png"
    assert attachment.thumbnail_ref is not None
    assert storage.objects[attachment.object_ref.object_key] == b"original-image"
    assert storage.objects[attachment.thumbnail_ref.object_key] == b"small-thumbnail"
    assert service.resolve_thumbnail(attachment) == b"small-thumbnail"


def test_upload_remains_compatible_with_legacy_callers_without_thumbnail() -> None:
    repository = FakeAttachmentRepository()
    storage = AttachmentStorage()
    service = AttachmentService(repository, storage)

    attachment = service.upload(ProjectId.new(), ArtifactId.new(), "image/jpeg", b"jpeg")

    assert attachment.filename.endswith(".jpg")
    assert attachment.markdown_path.startswith("assets/")
    assert attachment.thumbnail_ref is None


def test_duplicate_filename_gets_unique_markdown_path() -> None:
    repository = FakeAttachmentRepository()
    storage = AttachmentStorage()
    service = AttachmentService(repository, storage)
    project_id, artifact_id = ProjectId.new(), ArtifactId.new()

    first = service.upload(
        project_id, artifact_id, "image/png", b"first", filename="result.png"
    )
    second = service.upload(
        project_id, artifact_id, "image/png", b"second", filename="result.png"
    )

    assert first.markdown_path == "assets/result.png"
    assert second.markdown_path != first.markdown_path
    assert second.markdown_path.endswith("_result.png")

"""Idempotently seed the local AIDLC AWS development dataset."""

from __future__ import annotations

from base64 import b64decode
from dataclasses import dataclass

import boto3

from app.core.config import load_settings
from app.domain.attachments import AttachmentMediaType
from app.domain.content import InlineContentRef
from app.domain.entities import (
    Artifact,
    Attachment,
    Draft,
    DraftRevision,
    TraceLink,
    VersionSnapshot,
)
from app.domain.errors import ArtifactNotFound
from app.domain.identifiers import (
    ArtifactId,
    AttachmentId,
    DraftId,
    ProjectId,
    TraceLinkId,
    VersionId,
)
from app.persistence.dynamodb import (
    DynamoDbArtifactRepository,
    DynamoDbAttachmentRepository,
    DynamoDbMetadataRepository,
    DynamoDbProjectRepository,
    DynamoDbTables,
    DynamoDbVersionRepository,
)
from app.persistence.s3 import S3ObjectStorageAdapter

PROJECT_ID = ProjectId.parse("52a478d8-1d6c-4a2d-a429-0d2befb3bdf1")
REQUIREMENTS_ARTIFACT_ID = ArtifactId.parse("8fd6c982-5c66-4d1b-9d20-b17d3d62c271")
TRACE_ARTIFACT_ID = ArtifactId.parse("1b270f94-6071-4b8f-bfa3-4018f1c2f553")
REQUIREMENTS_DRAFT_ID = DraftId.parse("7aa4b4f2-63ce-4e59-a68e-a98e82307ad2")
TRACE_DRAFT_ID = DraftId.parse("8e32393e-46bb-4130-bbc9-a61b361c8063")
REQUIREMENTS_V1_ID = VersionId.parse("9470ac45-d7b1-4570-bafb-2b3ba82d65b1")
TRACE_V1_ID = VersionId.parse("c7d4885f-033d-4623-b05a-a733a9c66388")
ATTACHMENT_ID = AttachmentId.parse("35d51d0a-85fa-4c81-b86b-526f6878ca3c")
TRACE_LINK_1_ID = TraceLinkId.parse("cc1ed3e7-dcd6-4b8a-b657-fb5e2a561a45")
TRACE_LINK_2_ID = TraceLinkId.parse("77daab34-12bf-441c-b2c5-4db10e45877e")

REQUIREMENTS_V1 = (
    "# AIDLC 샘플 요구사항 정의서\n\n"
    "## 목적\n"
    "개발 산출물을 버전별로 관리한다.\n\n"
    "## 요구사항\n"
    "- REQ-001: 관리자는 Markdown 산출물을 저장할 수 있다.\n"
    "- REQ-002: 관리자는 버전 간 변경사항을 확인할 수 있다.\n"
)
REQUIREMENTS_V2 = (
    "# AIDLC 샘플 요구사항 정의서\n\n"
    "## 목적\n"
    "개발 산출물을 버전별로 관리하고 추적성을 확인한다.\n\n"
    "## 요구사항\n"
    "- REQ-001: 관리자는 Markdown 산출물을 저장할 수 있다.\n"
    "- REQ-002: 관리자는 버전 간 변경사항을 줄 단위로 확인할 수 있다.\n"
    "- REQ-003: 관리자는 요구사항과 테스트 케이스의 추적 누락을 확인할 수 있다.\n\n"
    "## 검토 메모\n"
    "첨부된 PNG는 로컬 샘플 이미지다.\n"
)
TRACE_MATRIX = (
    "# AIDLC 샘플 추적표\n\n"
    "| Story | Requirement | Test Case | Status |\n"
    "| --- | --- | --- | --- |\n"
    "| STORY-001 | REQ-001 | TC-001 | PASS |\n"
    "| STORY-002 | REQ-002 | TC-002 | PASS |\n"
)
PNG_BYTES = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/"
    "oA1N0QAAAABJRU5ErkJggg=="
)


@dataclass(frozen=True, slots=True)
class SeedRepositories:
    projects: DynamoDbProjectRepository
    artifacts: DynamoDbArtifactRepository
    versions: DynamoDbVersionRepository
    traces: DynamoDbMetadataRepository
    attachments: DynamoDbAttachmentRepository
    storage: S3ObjectStorageAdapter


def _tables(prefix: str) -> DynamoDbTables:
    return DynamoDbTables(
        f"{prefix}-projects",
        f"{prefix}-artifacts",
        f"{prefix}-versions",
        f"{prefix}-attachments",
        f"{prefix}-trace-links",
        f"{prefix}-ai-sessions",
    )


def _existing_or_create(
    repositories: SeedRepositories,
    artifact_id: ArtifactId,
    draft_id: DraftId,
    artifact_type: str,
    title: str,
    description: str,
    tags: tuple[str, ...],
    content: str,
) -> tuple[Artifact, bool]:
    try:
        return repositories.artifacts.get(PROJECT_ID, artifact_id), False
    except ArtifactNotFound:
        document_id = repositories.projects.allocate_public_document_id(PROJECT_ID)
        artifact = Artifact(artifact_id, PROJECT_ID, document_id, artifact_type, draft_id)
        draft = Draft(
            draft_id,
            artifact_id,
            DraftRevision(1),
            InlineContentRef.from_content(content),
            title=title,
            description=description,
            tags=tags,
        )
        repositories.artifacts.create(artifact, draft)
        return artifact, True


def _ensure_version(
    repositories: SeedRepositories,
    version_id: VersionId,
    artifact: Artifact,
    content: str,
    title: str,
    description: str,
    tags: tuple[str, ...],
) -> None:
    if any(
        item.version_id == version_id
        for item in repositories.versions.list_for_artifact(artifact.artifact_id)
    ):
        return
    repositories.versions.append(
        VersionSnapshot(
            version_id,
            artifact.artifact_id,
            1,
            DraftRevision(1),
            InlineContentRef.from_content(content),
            title=title,
            description=description,
            artifact_type=artifact.artifact_type,
            tags=tags,
        )
    )


def _seed_requirements(repositories: SeedRepositories) -> Artifact:
    artifact, _ = _existing_or_create(
        repositories,
        REQUIREMENTS_ARTIFACT_ID,
        REQUIREMENTS_DRAFT_ID,
        "MarkdownDocument",
        "AIDLC 샘플 요구사항 정의서",
        "버전 비교와 추적성 확인을 위한 샘플 요구사항입니다.",
        ("sample", "requirements"),
        REQUIREMENTS_V1,
    )
    _ensure_version(
        repositories,
        REQUIREMENTS_V1_ID,
        artifact,
        REQUIREMENTS_V1,
        "AIDLC 샘플 요구사항 정의서",
        "초기 승인 버전입니다.",
        ("sample", "requirements"),
    )
    current = repositories.artifacts.get_draft(PROJECT_ID, artifact.artifact_id)
    if current.revision.value == 1:
        repositories.artifacts.replace_draft(
            PROJECT_ID,
            artifact.artifact_id,
            current.revision,
            Draft(
                current.draft_id,
                artifact.artifact_id,
                current.revision.next(),
                InlineContentRef.from_content(REQUIREMENTS_V2),
                title="AIDLC 샘플 요구사항 정의서 (검토 중)",
                description="REQ-003과 검토 메모가 추가된 수정 중 초안입니다.",
                tags=("draft", "requirements", "sample"),
            ),
        )
    return artifact


def _seed_trace_matrix(repositories: SeedRepositories) -> Artifact:
    artifact, _ = _existing_or_create(
        repositories,
        TRACE_ARTIFACT_ID,
        TRACE_DRAFT_ID,
        "ExcelDocument",
        "AIDLC 샘플 추적표",
        "추적 link 및 XLSX export 확인용 샘플입니다.",
        ("sample", "trace"),
        TRACE_MATRIX,
    )
    _ensure_version(
        repositories,
        TRACE_V1_ID,
        artifact,
        TRACE_MATRIX,
        "AIDLC 샘플 추적표",
        "초기 추적표 버전입니다.",
        ("sample", "trace"),
    )
    return artifact


def _seed_attachment(repositories: SeedRepositories, artifact: Artifact) -> None:
    object_key = f"attachments/{PROJECT_ID}/{artifact.artifact_id}/{ATTACHMENT_ID}"
    reference = repositories.storage.put_attachment(
        object_key, PNG_BYTES, AttachmentMediaType("image/png")
    )
    repositories.attachments.save(
        Attachment(
            ATTACHMENT_ID,
            PROJECT_ID,
            artifact.artifact_id,
            AttachmentMediaType("image/png"),
            reference,
        )
    )


def _seed_trace_links(repositories: SeedRepositories) -> None:
    for link in (
        TraceLink(TRACE_LINK_1_ID, PROJECT_ID, "STORY-001", "REQ-001", "TC-001", "PASS"),
        TraceLink(TRACE_LINK_2_ID, PROJECT_ID, "STORY-002", "REQ-002", "TC-002", "PASS"),
    ):
        repositories.traces.save(link)


def main() -> None:
    settings = load_settings()
    client = boto3.client("dynamodb", region_name=settings.aws_region)
    repositories = SeedRepositories(
        DynamoDbProjectRepository(client, _tables(settings.dynamodb_table_prefix)),
        DynamoDbArtifactRepository(client, _tables(settings.dynamodb_table_prefix)),
        DynamoDbVersionRepository(client, _tables(settings.dynamodb_table_prefix)),
        DynamoDbMetadataRepository(client, _tables(settings.dynamodb_table_prefix)),
        DynamoDbAttachmentRepository(client, _tables(settings.dynamodb_table_prefix)),
        S3ObjectStorageAdapter(
            boto3.client("s3", region_name=settings.aws_region), settings.s3_bucket_name
        ),
    )
    repositories.projects.get(PROJECT_ID)
    requirements = _seed_requirements(repositories)
    trace_matrix = _seed_trace_matrix(repositories)
    _seed_attachment(repositories, requirements)
    _seed_trace_links(repositories)
    print("Seeded AIDLC local sample data")
    print(f"project_id={PROJECT_ID}")
    print(f"requirements_artifact_id={requirements.artifact_id}")
    print(f"requirements_version_id={REQUIREMENTS_V1_ID}")
    print(f"trace_matrix_artifact_id={trace_matrix.artifact_id}")
    print(f"trace_matrix_version_id={TRACE_V1_ID}")
    print(f"attachment_id={ATTACHMENT_ID}")


if __name__ == "__main__":
    main()

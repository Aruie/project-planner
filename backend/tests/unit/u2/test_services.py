from app.domain.entities import Project
from app.domain.errors import ArtifactNotFound
from app.domain.identifiers import ArtifactId, DocumentIdPrefix, ProjectId
from app.features.artifacts.errors import ApiProblem
from app.features.artifacts.models import (
    ArtifactMetadata,
    DeleteArtifactRequest,
    DiffRequest,
    DiffSourceRequest,
    TraceLinkRequest,
    UpdateDraftRequest,
)
from app.features.artifacts.services import (
    DiffService,
    LifecycleService,
    TraceabilityService,
    VersionConfirmationService,
)

from ...support.u2_fakes import (
    FakeArtifactRepository,
    FakeAttachmentRepository,
    FakeProjectRepository,
    FakeStorage,
    FakeTraceRepository,
    FakeVersionRepository,
)


def _services():
    project = Project(ProjectId.new(), "project", DocumentIdPrefix("PRJ"))
    projects, artifacts, storage = (
        FakeProjectRepository(project),
        FakeArtifactRepository(),
        FakeStorage(),
    )
    versions, traces = FakeVersionRepository(), FakeTraceRepository()
    return (
        project,
        LifecycleService(projects, artifacts, storage),
        VersionConfirmationService(projects, artifacts, versions),
        DiffService(projects, artifacts, versions, storage),
        TraceabilityService(projects, artifacts, traces),
    )


def test_lifecycle_revision_version_diff_and_trace_gap() -> None:
    project, lifecycle, version_service, diff_service, trace_service = _services()
    created = lifecycle.create(
        project.project_id,
        ArtifactMetadata(title="초안", artifact_type="MarkdownDocument", tags=("A", "a")),
        "one\ntwo",
    )
    artifact_id = created.artifact_id
    updated = lifecycle.update(
        project.project_id,
        ArtifactId.parse(artifact_id),
        UpdateDraftRequest(expected_revision=1, title="확정", content="one\nthree"),
    )
    assert updated.revision == 2 and updated.tags == ()
    snapshot = version_service.confirm(project.project_id, ArtifactId.parse(artifact_id))
    assert snapshot.version_number == 1 and snapshot.source_draft_revision == 2
    result = diff_service.compare(
        project.project_id,
        ArtifactId.parse(artifact_id),
        DiffRequest(
            left=DiffSourceRequest(kind="version", version_id=snapshot.version_id),
            right=DiffSourceRequest(kind="draft"),
        ),
    )
    assert result.summary["unchanged"] == 2
    trace_service.create(
        project.project_id,
        TraceLinkRequest(story_id="S1", requirement_id="R1", test_case_id="T1", status="ok"),
    )
    gaps = trace_service.gaps(project.project_id, ("S1", "S2"), ("R1",), ("T1", "T2"))
    assert gaps.story_ids == ("S2",) and gaps.test_case_ids == ("T2",)


def test_draft_conflict_preserves_current_draft() -> None:
    project, lifecycle, *_ = _services()
    created = lifecycle.create(
        project.project_id, ArtifactMetadata(title="x", artifact_type="MarkdownDocument"), "body"
    )
    artifact_id = ArtifactId.parse(created.artifact_id)
    lifecycle.update(
        project.project_id,
        artifact_id,
        UpdateDraftRequest(expected_revision=1, title="y", content="next"),
    )
    try:
        lifecycle.update(
            project.project_id,
            artifact_id,
            UpdateDraftRequest(expected_revision=1, title="z", content="bad"),
        )
    except ApiProblem as error:
        assert error.code == "DRAFT_REVISION_CONFLICT" and error.current_revision == 2
    else:
        raise AssertionError("conflict expected")


def test_delete_requires_exact_title_and_preserves_data_on_mismatch() -> None:
    project = Project(ProjectId.new(), "project", DocumentIdPrefix("PRJ"))
    projects = FakeProjectRepository(project)
    artifacts = FakeArtifactRepository()
    versions = FakeVersionRepository()
    lifecycle = LifecycleService(
        projects, artifacts, FakeStorage(), versions, FakeAttachmentRepository()
    )
    version_service = VersionConfirmationService(projects, artifacts, versions)
    created = lifecycle.create(
        project.project_id,
        ArtifactMetadata(title="삭제 확인 문서", artifact_type="MarkdownDocument"),
        "body",
    )
    artifact_id = ArtifactId.parse(created.artifact_id)
    version_service.confirm(project.project_id, artifact_id)

    try:
        lifecycle.delete(
            project.project_id,
            artifact_id,
            DeleteArtifactRequest(confirmation_title="다른 제목"),
        )
    except ApiProblem as error:
        assert error.code == "ARTIFACT_DELETE_CONFIRMATION_MISMATCH"
        assert error.status_code == 400
    else:
        raise AssertionError("confirmation mismatch expected")

    assert artifacts.get(project.project_id, artifact_id).artifact_id == artifact_id
    assert len(versions.list_for_artifact(artifact_id)) == 1


def test_delete_removes_artifact_and_all_versions() -> None:
    project = Project(ProjectId.new(), "project", DocumentIdPrefix("PRJ"))
    projects = FakeProjectRepository(project)
    artifacts = FakeArtifactRepository()
    versions = FakeVersionRepository()
    lifecycle = LifecycleService(
        projects, artifacts, FakeStorage(), versions, FakeAttachmentRepository()
    )
    version_service = VersionConfirmationService(projects, artifacts, versions)
    created = lifecycle.create(
        project.project_id,
        ArtifactMetadata(title="영구 삭제 문서", artifact_type="MarkdownDocument"),
        "body",
    )
    artifact_id = ArtifactId.parse(created.artifact_id)
    version_service.confirm(project.project_id, artifact_id)

    lifecycle.delete(
        project.project_id,
        artifact_id,
        DeleteArtifactRequest(confirmation_title="영구 삭제 문서"),
    )

    assert versions.list_for_artifact(artifact_id) == ()
    try:
        artifacts.get(project.project_id, artifact_id)
    except ArtifactNotFound:
        pass
    else:
        raise AssertionError("artifact should be deleted")

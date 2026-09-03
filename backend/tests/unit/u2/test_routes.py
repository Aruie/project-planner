from fastapi.testclient import TestClient

from app.core.auth import AdminPrincipal, require_admin
from app.domain.entities import Project
from app.domain.identifiers import DocumentIdPrefix, ProjectId
from app.features.artifacts.dependencies import get_services
from app.features.artifacts.services import (
    DiffService,
    LifecycleService,
    TraceabilityService,
    VersionConfirmationService,
)
from app.main import app

from ...support.u2_fakes import (
    FakeArtifactRepository,
    FakeProjectRepository,
    FakeStorage,
    FakeTraceRepository,
    FakeVersionRepository,
)


def test_create_artifact_route_uses_auth_and_response_schema() -> None:
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    projects, artifacts, storage = (
        FakeProjectRepository(project),
        FakeArtifactRepository(),
        FakeStorage(),
    )
    versions, traces = FakeVersionRepository(), FakeTraceRepository()
    services = (
        LifecycleService(projects, artifacts, storage),
        VersionConfirmationService(projects, artifacts, versions),
        DiffService(projects, artifacts, versions, storage),
        TraceabilityService(projects, artifacts, traces),
    )
    app.dependency_overrides[get_services] = lambda: services
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    try:
        response = TestClient(app).post(
            f"/projects/{project.project_id}/artifacts",
            json={
                "metadata": {"title": "문서", "artifact_type": "MarkdownDocument"},
                "content": "body",
            },
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["revision"] == 1


def test_list_artifacts_route_returns_project_scoped_artifacts() -> None:
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    projects, artifacts, storage = (
        FakeProjectRepository(project),
        FakeArtifactRepository(),
        FakeStorage(),
    )
    versions, traces = FakeVersionRepository(), FakeTraceRepository()
    services = (
        LifecycleService(projects, artifacts, storage),
        VersionConfirmationService(projects, artifacts, versions),
        DiffService(projects, artifacts, versions, storage),
        TraceabilityService(projects, artifacts, traces),
    )
    app.dependency_overrides[get_services] = lambda: services
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    try:
        client = TestClient(app)
        created = client.post(
            f"/projects/{project.project_id}/artifacts",
            json={
                "metadata": {"title": "샘플", "artifact_type": "MarkdownDocument"},
                "content": "body",
            },
        )
        response = client.get(f"/projects/{project.project_id}/artifacts")
    finally:
        app.dependency_overrides.clear()
    assert created.status_code == 200
    assert response.status_code == 200
    assert response.json() == [created.json()]

from fastapi.testclient import TestClient

from app.core.auth import AdminPrincipal, require_admin
from app.domain.entities import Project
from app.domain.identifiers import DocumentIdPrefix, ProjectId
from app.features.ai_workspace.dependencies import get_ai_workspace_service
from app.features.ai_workspace.services import AiWorkspaceService
from app.main import app

from ...support.u2_fakes import FakeStorage
from ...support.u4_fakes import (
    FakeAiSessionRepository,
    FakeBedrock,
    FakeProjects,
    FakeReviewedCreate,
    fixed_now,
)


def test_session_routes_require_auth_and_return_safe_state() -> None:
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    service = AiWorkspaceService(
        FakeProjects(project),
        FakeAiSessionRepository(),
        FakeStorage(),
        FakeBedrock(),
        FakeReviewedCreate(project),
        fixed_now,
    )
    app.dependency_overrides[get_ai_workspace_service] = lambda: service
    try:
        unauthorized = TestClient(app).post(f"/projects/{project.project_id}/ai-sessions", json={})
        assert unauthorized.status_code == 401
        app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
        client = TestClient(app)
        started = client.post(f"/projects/{project.project_id}/ai-sessions", json={})
        assert started.status_code == 200
        session_id = started.json()["session_id"]
        message = client.post(
            f"/projects/{project.project_id}/ai-sessions/{session_id}/messages",
            json={"prompt": "요구사항 생성"},
        )
        assert message.status_code == 200
        assert message.json()["preview"] == "# 요구사항\n내용"
        saved = client.post(
            f"/projects/{project.project_id}/ai-sessions/{session_id}/reviewed-saves",
            json={"title": "요구사항"},
        )
    finally:
        app.dependency_overrides.clear()
    assert saved.status_code == 200
    assert saved.json()["revision"] == 1

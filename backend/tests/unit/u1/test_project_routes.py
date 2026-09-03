from fastapi.testclient import TestClient

from app.core.auth import AdminPrincipal, require_admin
from app.domain.entities import Project
from app.domain.identifiers import DocumentIdPrefix, ProjectId
from app.features.projects.routes import get_project_repository
from app.main import app


class Projects:
    def __init__(self, values):
        self.values = values

    def list(self):
        return tuple(self.values)


def test_auth_me_and_project_list_require_admin_and_return_summaries() -> None:
    project = Project(ProjectId.new(), "테스트 프로젝트", DocumentIdPrefix("TEST"))
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    app.dependency_overrides[get_project_repository] = lambda: Projects([project])
    try:
        client = TestClient(app)
        assert client.get("/auth/me").json() == {"username": "admin"}
        response = client.get("/projects")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == [
        {
            "project_id": str(project.project_id),
            "name": "테스트 프로젝트",
            "document_id_prefix": "TEST",
        }
    ]

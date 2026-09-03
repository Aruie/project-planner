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

    def get(self, project_id):
        return next(project for project in self.values if project.project_id == project_id)

    def update(self, project):
        self.values = [
            project if value.project_id == project.project_id else value for value in self.values
        ]
        return project


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
            "task_name": "",
            "contractor_name": "",
            "client_name": "",
            "organization_name": "",
        }
    ]


def test_project_information_can_be_updated() -> None:
    project = Project(ProjectId.new(), "기존 프로젝트", DocumentIdPrefix("TEST"))
    projects = Projects([project])
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    app.dependency_overrides[get_project_repository] = lambda: projects
    try:
        response = TestClient(app).put(
            f"/projects/{project.project_id}",
            json={
                "name": "차세대 프로젝트",
                "task_name": "차세대 업무시스템 구축",
                "contractor_name": "수탁기관 A",
                "client_name": "발주처 B",
                "organization_name": "회사 C",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "project_id": str(project.project_id),
        "name": "차세대 프로젝트",
        "document_id_prefix": "TEST",
        "task_name": "차세대 업무시스템 구축",
        "contractor_name": "수탁기관 A",
        "client_name": "발주처 B",
        "organization_name": "회사 C",
    }
    assert projects.values[0].task_name == "차세대 업무시스템 구축"

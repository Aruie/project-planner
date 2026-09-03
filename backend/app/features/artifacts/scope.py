"""Project ownership validation for all U2 resource access."""

from __future__ import annotations

from app.domain.entities import Artifact
from app.domain.errors import ArtifactNotFound
from app.domain.identifiers import ArtifactId, ProjectId
from app.domain.ports import ArtifactRepository, ProjectRepository

from .errors import ApiProblem, map_domain_error


class ProjectScopeGuard:
    def __init__(self, projects: ProjectRepository, artifacts: ArtifactRepository) -> None:
        self._projects = projects
        self._artifacts = artifacts

    def require_project(self, project_id: ProjectId) -> None:
        try:
            self._projects.get(project_id)
        except Exception as error:
            raise map_domain_error(error) from error

    def require_artifact(self, project_id: ProjectId, artifact_id: ArtifactId) -> Artifact:
        self.require_project(project_id)
        try:
            artifact = self._artifacts.get(project_id, artifact_id)
        except Exception as error:
            raise map_domain_error(error) from error
        if artifact.project_id != project_id:
            raise ApiProblem(
                "ARTIFACT_SCOPE_MISMATCH", "프로젝트 범위가 일치하지 않습니다.", status_code=404
            )
        if not artifact:
            raise map_domain_error(ArtifactNotFound("Artifact does not exist"))
        return artifact

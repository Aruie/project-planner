"""Project summary REST boundary consumed by the post-login U5 sidebar."""

from __future__ import annotations

from typing import Annotated

import boto3
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AdminPrincipal, require_admin
from app.core.config import Settings, get_settings
from app.domain.ports import ProjectRepository
from app.persistence.dynamodb import DynamoDbProjectRepository, DynamoDbTables

router = APIRouter(tags=["projects"])


class ProjectSummary(BaseModel):
    project_id: str
    name: str
    document_id_prefix: str


def get_project_repository(
    settings: Settings = Depends(get_settings),
) -> ProjectRepository:
    prefix = settings.dynamodb_table_prefix
    tables = DynamoDbTables(
        f"{prefix}-projects",
        f"{prefix}-artifacts",
        f"{prefix}-versions",
        f"{prefix}-attachments",
        f"{prefix}-trace-links",
        f"{prefix}-ai-sessions",
    )
    return DynamoDbProjectRepository(
        boto3.client("dynamodb", region_name=settings.aws_region), tables
    )


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
) -> tuple[ProjectSummary, ...]:
    return tuple(
        ProjectSummary(
            project_id=str(project.project_id),
            name=project.name,
            document_id_prefix=project.document_id_prefix.value,
        )
        for project in projects.list()
    )

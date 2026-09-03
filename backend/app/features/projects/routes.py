"""Project summary REST boundary consumed by the post-login U5 sidebar."""

from __future__ import annotations

from dataclasses import replace
from typing import Annotated

import boto3
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.core.auth import AdminPrincipal, require_admin
from app.core.config import Settings, get_settings
from app.domain.identifiers import ProjectId
from app.domain.ports import ProjectRepository
from app.persistence.dynamodb import DynamoDbProjectRepository, DynamoDbTables

router = APIRouter(tags=["projects"])


class ProjectSummary(BaseModel):
    project_id: str
    name: str
    document_id_prefix: str
    task_name: str
    contractor_name: str
    client_name: str
    organization_name: str


class UpdateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    task_name: str = Field(default="", max_length=500)
    contractor_name: str = Field(default="", max_length=500)
    client_name: str = Field(default="", max_length=500)
    organization_name: str = Field(default="", max_length=500)

    @field_validator(
        "name",
        "task_name",
        "contractor_name",
        "client_name",
        "organization_name",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value: object) -> str:
        return str(value).strip()


def _summary(project) -> ProjectSummary:
    return ProjectSummary(
        project_id=str(project.project_id),
        name=project.name,
        document_id_prefix=project.document_id_prefix.value,
        task_name=project.task_name,
        contractor_name=project.contractor_name,
        client_name=project.client_name,
        organization_name=project.organization_name,
    )


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
    return tuple(_summary(project) for project in projects.list())


@router.put("/projects/{project_id}", response_model=ProjectSummary)
def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    projects: Annotated[ProjectRepository, Depends(get_project_repository)],
) -> ProjectSummary:
    current = projects.get(ProjectId.parse(project_id))
    updated = replace(
        current,
        name=request.name,
        task_name=request.task_name,
        contractor_name=request.contractor_name,
        client_name=request.client_name,
        organization_name=request.organization_name,
    )
    return _summary(projects.update(updated))

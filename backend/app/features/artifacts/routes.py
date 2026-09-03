"""REST routes for U2 document lifecycle."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.core.auth import AdminPrincipal, require_admin
from app.domain.identifiers import ArtifactId, ProjectId

from .dependencies import get_services
from .models import (
    ApiError,
    ArtifactDetailResponse,
    ArtifactResponse,
    ConfirmVersionRequest,
    CreateArtifactRequest,
    DeleteArtifactRequest,
    DiffRequest,
    DiffResult,
    TraceGapRequest,
    TraceGapResult,
    TraceLinkRequest,
    TraceLinkResponse,
    UpdateDraftRequest,
    VersionResponse,
)
from .services import DiffService, LifecycleService, TraceabilityService, VersionConfirmationService

router = APIRouter(prefix="/projects/{project_id}", tags=["artifacts"])
Services = tuple[LifecycleService, VersionConfirmationService, DiffService, TraceabilityService]


def _services(value: Annotated[Services, Depends(get_services)]) -> Services:
    return value


@router.post("/artifacts", response_model=ArtifactResponse, responses={400: {"model": ApiError}})
def create_artifact(
    project_id: str,
    request: CreateArtifactRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> ArtifactResponse:
    return services[0].create(ProjectId.parse(project_id), request.metadata, request.content)


@router.get("/artifacts", response_model=list[ArtifactResponse])
def list_artifacts(
    project_id: str,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> tuple[ArtifactResponse, ...]:
    return services[0].list_artifacts(ProjectId.parse(project_id))


@router.get(
    "/artifacts/{artifact_id}",
    response_model=ArtifactDetailResponse,
    responses={404: {"model": ApiError}},
)
def get_artifact(
    project_id: str,
    artifact_id: str,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> ArtifactDetailResponse:
    return services[0].get(ProjectId.parse(project_id), ArtifactId.parse(artifact_id))


@router.put(
    "/artifacts/{artifact_id}/draft",
    response_model=ArtifactResponse,
    responses={400: {"model": ApiError}, 409: {"model": ApiError}},
)
def update_draft(
    project_id: str,
    artifact_id: str,
    request: UpdateDraftRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> ArtifactResponse:
    return services[0].update(ProjectId.parse(project_id), ArtifactId.parse(artifact_id), request)


@router.delete(
    "/artifacts/{artifact_id}",
    status_code=204,
    responses={400: {"model": ApiError}, 404: {"model": ApiError}},
)
def delete_artifact(
    project_id: str,
    artifact_id: str,
    request: DeleteArtifactRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> Response:
    services[0].delete(ProjectId.parse(project_id), ArtifactId.parse(artifact_id), request)
    return Response(status_code=204)


@router.post("/artifacts/{artifact_id}/versions", response_model=VersionResponse)
def confirm_version(
    project_id: str,
    artifact_id: str,
    request: ConfirmVersionRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> VersionResponse:
    return services[1].confirm(ProjectId.parse(project_id), ArtifactId.parse(artifact_id), request)


@router.get("/artifacts/{artifact_id}/versions", response_model=list[VersionResponse])
def list_versions(
    project_id: str,
    artifact_id: str,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> tuple[VersionResponse, ...]:
    return services[1].list_versions(ProjectId.parse(project_id), ArtifactId.parse(artifact_id))


@router.post("/artifacts/{artifact_id}/diff", response_model=DiffResult)
def diff(
    project_id: str,
    artifact_id: str,
    request: DiffRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> DiffResult:
    return services[2].compare(ProjectId.parse(project_id), ArtifactId.parse(artifact_id), request)


@router.post("/trace-links", response_model=TraceLinkResponse)
def create_trace_link(
    project_id: str,
    request: TraceLinkRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> TraceLinkResponse:
    return services[3].create(ProjectId.parse(project_id), request)


@router.post("/trace-gaps", response_model=TraceGapResult)
def trace_gaps(
    project_id: str,
    request: TraceGapRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    services: Annotated[Services, Depends(_services)],
) -> TraceGapResult:
    return services[3].gaps(
        ProjectId.parse(project_id),
        request.story_ids,
        request.requirement_ids,
        request.test_case_ids,
    )

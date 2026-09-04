"""REST boundary for temporary U4 AI workspace state."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import AdminPrincipal, require_admin
from app.domain.identifiers import AiSessionId, ProjectId

from .dependencies import get_ai_workspace_service
from .models import (
    AiApiError,
    AiWorkspaceState,
    ReviewedPreviewSaveRequest,
    ReviewedPreviewSaveResponse,
    SendMessageRequest,
    StartSessionRequest,
)
from .services import AiWorkspaceService

router = APIRouter(prefix="/projects/{project_id}/ai-sessions", tags=["ai-workspace"])
Errors = {
    400: {"model": AiApiError},
    403: {"model": AiApiError},
    404: {"model": AiApiError},
    502: {"model": AiApiError},
}


def _service(
    value: Annotated[AiWorkspaceService, Depends(get_ai_workspace_service)],
) -> AiWorkspaceService:
    return value


@router.post("", response_model=AiWorkspaceState, responses=Errors)
def start_session(
    project_id: str,
    request: StartSessionRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    service: Annotated[AiWorkspaceService, Depends(_service)],
) -> AiWorkspaceState:
    session_id = AiSessionId.parse(request.session_id) if request.session_id else None
    return service.start(ProjectId.parse(project_id), session_id)


@router.get("/{session_id}", response_model=AiWorkspaceState, responses=Errors)
def get_session(
    project_id: str,
    session_id: str,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    service: Annotated[AiWorkspaceService, Depends(_service)],
) -> AiWorkspaceState:
    return service.get(ProjectId.parse(project_id), AiSessionId.parse(session_id))


@router.post("/{session_id}/messages", response_model=AiWorkspaceState, responses=Errors)
def send_message(
    project_id: str,
    session_id: str,
    request: SendMessageRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    service: Annotated[AiWorkspaceService, Depends(_service)],
) -> AiWorkspaceState:
    return service.send(
        ProjectId.parse(project_id),
        AiSessionId.parse(session_id),
        request.prompt,
        request.active_artifact_id,
    )


@router.post(
    "/{session_id}/reviewed-saves", response_model=ReviewedPreviewSaveResponse, responses=Errors
)
def save_reviewed_preview(
    project_id: str,
    session_id: str,
    request: ReviewedPreviewSaveRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    service: Annotated[AiWorkspaceService, Depends(_service)],
) -> ReviewedPreviewSaveResponse:
    return service.save_reviewed(
        ProjectId.parse(project_id), AiSessionId.parse(session_id), request.title, request.tags
    )

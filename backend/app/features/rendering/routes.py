from base64 import b64decode, b64encode
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

import boto3
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.core.auth import AdminPrincipal, require_admin
from app.core.config import Settings, get_settings
from app.domain.identifiers import ArtifactId, AttachmentId, ProjectId
from app.persistence.dynamodb import DynamoDbAttachmentRepository, DynamoDbTables
from app.persistence.s3 import S3ObjectStorageAdapter

from .attachments import AttachmentService
from .docx import docx_export
from .models import RenderModel
from .renderers import xlsx_export


def _download_disposition(filename: str) -> str:
    clean = Path(filename.replace("\\", "/")).name.replace("\r", "").replace("\n", "")
    if not clean:
        clean = "document"
    if clean.isascii():
        return f'attachment; filename="{clean.replace(chr(34), "")}"'
    fallback = f"document{Path(clean).suffix}"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"


router = APIRouter(prefix="/projects/{project_id}/artifacts/{artifact_id}", tags=["rendering"])


class AttachmentUpload(BaseModel):
    media_type: str
    content_base64: str


class AttachmentResponse(BaseModel):
    attachment_id: str
    media_type: str
    content_base64: str | None = None


def get_attachment_service(
    settings: Settings = Depends(get_settings),
) -> AttachmentService:
    prefix = settings.dynamodb_table_prefix
    tables = DynamoDbTables(
        f"{prefix}-projects",
        f"{prefix}-artifacts",
        f"{prefix}-versions",
        f"{prefix}-attachments",
        f"{prefix}-trace-links",
        f"{prefix}-ai-sessions",
    )
    return AttachmentService(
        DynamoDbAttachmentRepository(
            boto3.client("dynamodb", region_name=settings.aws_region), tables
        ),
        S3ObjectStorageAdapter(
            boto3.client("s3", region_name=settings.aws_region), settings.s3_bucket_name
        ),
    )


@router.post("/attachments", response_model=AttachmentResponse)
def upload(
    project_id: str,
    artifact_id: str,
    request: AttachmentUpload,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    service: Annotated[AttachmentService, Depends(get_attachment_service)],
) -> AttachmentResponse:
    attachment = service.upload(
        ProjectId.parse(project_id),
        ArtifactId.parse(artifact_id),
        request.media_type,
        b64decode(request.content_base64, validate=True),
    )
    return AttachmentResponse(
        attachment_id=str(attachment.attachment_id), media_type=attachment.media_type.value
    )


@router.get("/attachments/{attachment_id}", response_model=AttachmentResponse)
def resolve(
    project_id: str,
    artifact_id: str,
    attachment_id: str,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
    service: Annotated[AttachmentService, Depends(get_attachment_service)],
) -> AttachmentResponse:
    attachment, content = service.resolve(
        ProjectId.parse(project_id),
        ArtifactId.parse(artifact_id),
        AttachmentId.parse(attachment_id),
    )
    return AttachmentResponse(
        attachment_id=str(attachment.attachment_id),
        media_type=attachment.media_type.value,
        content_base64=b64encode(content).decode(),
    )


class XlsxRequest(BaseModel):
    model: RenderModel
    template_kind: str


class DocxRequest(BaseModel):
    markdown: str
    filename: str = "document.docx"


@router.post("/preview", response_model=RenderModel)
def preview(
    project_id: str,
    artifact_id: str,
    model: RenderModel,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
) -> RenderModel:
    ProjectId.parse(project_id)
    ArtifactId.parse(artifact_id)
    return model


@router.post("/exports/xlsx")
def export_xlsx(
    project_id: str,
    artifact_id: str,
    request: XlsxRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
) -> Response:
    ProjectId.parse(project_id)
    ArtifactId.parse(artifact_id)
    result = xlsx_export(request.model, request.template_kind)
    return Response(
        content=result.content,
        media_type=result.content_type,
        headers={"Content-Disposition": _download_disposition(result.filename)},
    )


@router.post("/exports/docx")
def export_docx(
    project_id: str,
    artifact_id: str,
    request: DocxRequest,
    _: Annotated[AdminPrincipal, Depends(require_admin)],
) -> Response:
    ProjectId.parse(project_id)
    ArtifactId.parse(artifact_id)
    result = docx_export(request.markdown, request.filename)
    return Response(
        content=result.content,
        media_type=result.content_type,
        headers={"Content-Disposition": _download_disposition(result.filename)},
    )

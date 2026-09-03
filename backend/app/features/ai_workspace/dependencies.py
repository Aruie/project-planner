"""Production composition for U4; boto3 stays outside U4 application services."""

from __future__ import annotations

import boto3
from fastapi import Depends

from app.core.config import Settings, get_settings
from app.features.artifacts.services import LifecycleService
from app.persistence.dynamodb import (
    DynamoDbAiSessionRepository,
    DynamoDbArtifactRepository,
    DynamoDbProjectRepository,
    DynamoDbTables,
)
from app.persistence.s3 import S3ObjectStorageAdapter

from .bedrock import BedrockConverseAdapter
from .services import AiWorkspaceService


def _tables(settings: Settings) -> DynamoDbTables:
    prefix = settings.dynamodb_table_prefix
    return DynamoDbTables(
        f"{prefix}-projects",
        f"{prefix}-artifacts",
        f"{prefix}-versions",
        f"{prefix}-attachments",
        f"{prefix}-trace-links",
        f"{prefix}-ai-sessions",
    )


def get_ai_workspace_service(
    settings: Settings = Depends(get_settings),
) -> AiWorkspaceService:
    dynamodb = boto3.client("dynamodb", region_name=settings.aws_region)
    storage = S3ObjectStorageAdapter(
        boto3.client("s3", region_name=settings.aws_region), settings.s3_bucket_name
    )
    tables = _tables(settings)
    projects = DynamoDbProjectRepository(dynamodb, tables)
    lifecycle = LifecycleService(projects, DynamoDbArtifactRepository(dynamodb, tables), storage)
    return AiWorkspaceService(
        projects,
        DynamoDbAiSessionRepository(dynamodb, tables),
        storage,
        BedrockConverseAdapter(boto3.client("bedrock-runtime", region_name=settings.aws_region)),
        lifecycle,
    )

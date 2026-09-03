"""FastAPI dependencies composing U1 adapters with U2 services."""

from __future__ import annotations

import boto3
from fastapi import Depends

from app.core.config import Settings, get_settings
from app.persistence.dynamodb import (
    DynamoDbArtifactRepository,
    DynamoDbAttachmentRepository,
    DynamoDbMetadataRepository,
    DynamoDbProjectRepository,
    DynamoDbTables,
    DynamoDbVersionRepository,
)
from app.persistence.s3 import S3ObjectStorageAdapter

from .services import DiffService, LifecycleService, TraceabilityService, VersionConfirmationService


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


def get_services(
    settings: Settings = Depends(get_settings),
) -> tuple[LifecycleService, VersionConfirmationService, DiffService, TraceabilityService]:
    client = boto3.client("dynamodb", region_name=settings.aws_region)
    storage = S3ObjectStorageAdapter(
        boto3.client("s3", region_name=settings.aws_region), settings.s3_bucket_name
    )
    tables = _tables(settings)
    projects = DynamoDbProjectRepository(client, tables)
    artifacts = DynamoDbArtifactRepository(client, tables)
    versions = DynamoDbVersionRepository(client, tables)
    attachments = DynamoDbAttachmentRepository(client, tables)
    traces = DynamoDbMetadataRepository(client, tables)
    return (
        LifecycleService(projects, artifacts, storage, versions, attachments),
        VersionConfirmationService(projects, artifacts, versions),
        DiffService(projects, artifacts, versions, storage),
        TraceabilityService(projects, artifacts, traces),
    )

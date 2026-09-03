"""Environment-backed configuration for the application boundary."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from os import environ


class ConfigurationError(ValueError):
    """Raised when required application configuration is absent or invalid."""


@dataclass(frozen=True, slots=True)
class Settings:
    """Configuration owned by the FastAPI boundary and persistence adapters."""

    admin_username: str
    admin_password: str
    aws_region: str
    dynamodb_table_prefix: str
    s3_bucket_name: str


def _required(values: Mapping[str, str], name: str) -> str:
    value = values.get(name, "").strip()
    if not value:
        raise ConfigurationError(f"Missing required environment variable: {name}")
    return value


def load_settings(values: Mapping[str, str] | None = None) -> Settings:
    """Load settings without providing credential defaults in source code."""

    source = environ if values is None else values
    return Settings(
        admin_username=_required(source, "AIDLC_ADMIN_USERNAME"),
        admin_password=_required(source, "AIDLC_ADMIN_PASSWORD"),
        aws_region=_required(source, "AWS_REGION"),
        dynamodb_table_prefix=_required(source, "AIDLC_DYNAMODB_TABLE_PREFIX"),
        s3_bucket_name=_required(source, "AIDLC_S3_BUCKET_NAME"),
    )


def get_settings() -> Settings:
    """FastAPI dependency that reads the current process environment."""

    return load_settings()


@dataclass(frozen=True, slots=True)
class AuthSettings:
    """Only the temporary administrator values required for login verification."""

    admin_username: str
    admin_password: str


def load_auth_settings(values: Mapping[str, str] | None = None) -> AuthSettings:
    source = environ if values is None else values
    return AuthSettings(
        admin_username=_required(source, "AIDLC_ADMIN_USERNAME"),
        admin_password=_required(source, "AIDLC_ADMIN_PASSWORD"),
    )


def get_auth_settings() -> AuthSettings:
    return load_auth_settings()

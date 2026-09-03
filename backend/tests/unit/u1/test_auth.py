from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPBasicCredentials

from app.core.auth import require_admin
from app.core.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        admin_username="admin",
        admin_password="admin1234",
        aws_region="ap-northeast-2",
        dynamodb_table_prefix="aidlc-dev",
        s3_bucket_name="aidlc-content",
    )


def test_require_admin_accepts_configured_credentials(settings: Settings) -> None:
    principal = require_admin(
        HTTPBasicCredentials(username="admin", password="admin1234"), settings
    )

    assert principal.username == "admin"


def test_require_admin_rejects_invalid_credentials(settings: Settings) -> None:
    with pytest.raises(HTTPException) as raised:
        require_admin(HTTPBasicCredentials(username="admin", password="wrong"), settings)

    assert raised.value.status_code == 401
    assert raised.value.headers == {"WWW-Authenticate": "Basic"}


def test_load_auth_settings_does_not_require_aws_configuration() -> None:
    from app.core.config import load_auth_settings

    settings = load_auth_settings(
        {"AIDLC_ADMIN_USERNAME": "admin", "AIDLC_ADMIN_PASSWORD": "local"}
    )

    assert settings.admin_username == "admin"
    assert settings.admin_password == "local"

from __future__ import annotations

import pytest

from app.core.config import ConfigurationError, load_settings


def test_load_settings_reads_required_environment_values() -> None:
    settings = load_settings(
        {
            "AIDLC_ADMIN_USERNAME": "admin",
            "AIDLC_ADMIN_PASSWORD": "admin1234",
            "AWS_REGION": "ap-northeast-2",
            "AIDLC_DYNAMODB_TABLE_PREFIX": "aidlc-dev",
            "AIDLC_S3_BUCKET_NAME": "aidlc-content",
        }
    )

    assert settings.admin_username == "admin"
    assert settings.aws_region == "ap-northeast-2"


def test_load_settings_rejects_missing_admin_password() -> None:
    with pytest.raises(ConfigurationError, match="AIDLC_ADMIN_PASSWORD"):
        load_settings(
            {
                "AIDLC_ADMIN_USERNAME": "admin",
                "AWS_REGION": "ap-northeast-2",
                "AIDLC_DYNAMODB_TABLE_PREFIX": "aidlc-dev",
                "AIDLC_S3_BUCKET_NAME": "aidlc-content",
            }
        )

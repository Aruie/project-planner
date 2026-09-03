from datetime import UTC, datetime

import boto3
import pytest
from botocore.stub import Stubber

from app.domain.entities import AiSessionMessage
from app.features.ai_workspace.bedrock import MODEL_ID, BedrockConverseAdapter


def _client():
    return boto3.client(
        "bedrock-runtime",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def test_converse_uses_exact_global_model_and_normalizes_text() -> None:
    client = _client()
    expected = {
        "modelId": MODEL_ID,
        "system": [
            {
                "text": (
                    "한국어 개발 산출물 요구사항 Markdown 초안을 생성하세요. "
                    "다른 프로젝트 정보를 사용하지 마세요."
                )
            }
        ],
        "messages": [{"role": "user", "content": [{"text": "요구사항"}]}],
    }
    with Stubber(client) as stubber:
        stubber.add_response(
            "converse",
            {
                "output": {"message": {"role": "assistant", "content": [{"text": "# 초안"}]}},
                "stopReason": "end_turn",
                "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
                "metrics": {"latencyMs": 1},
            },
            expected,
        )
        result = BedrockConverseAdapter(client).converse((), "요구사항")
    assert result.assistant_message == "# 초안"
    assert result.preview_markdown == "# 초안"


def test_converse_propagates_provider_failure_to_service_boundary() -> None:
    client = _client()
    with Stubber(client) as stubber:
        stubber.add_client_error("converse", service_error_code="InternalServerException")
        with pytest.raises(Exception):
            BedrockConverseAdapter(client).converse(
                (AiSessionMessage("user", "prior", datetime.now(UTC)),), "새 요청"
            )

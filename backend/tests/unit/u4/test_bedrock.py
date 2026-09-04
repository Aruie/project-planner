from datetime import UTC, datetime

import boto3
import pytest
from botocore.stub import Stubber

from app.domain.entities import AiSessionMessage
from app.features.ai_workspace.bedrock import _SYSTEM_GUIDANCE, MODEL_ID, BedrockConverseAdapter


def _client():
    return boto3.client(
        "bedrock-runtime",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def _expected(prompt: str):
    return {
        "modelId": MODEL_ID,
        "system": [{"text": _SYSTEM_GUIDANCE}],
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
    }


def _response(text: str):
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": text}]}},
        "stopReason": "end_turn",
        "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
        "metrics": {"latencyMs": 1},
    }


def test_converse_parses_normal_project_answer() -> None:
    client = _client()
    with Stubber(client) as stubber:
        stubber.add_response(
            "converse",
            _response(
                "<response_type>answer</response_type>"
                "<message>프로젝트에는 요구사항 문서가 있습니다.</message>"
            ),
            _expected("요약해줘"),
        )
        result = BedrockConverseAdapter(client).converse((), "요약해줘")

    assert result.response_type == "answer"
    assert result.assistant_message == "프로젝트에는 요구사항 문서가 있습니다."
    assert result.preview_markdown is None


def test_converse_parses_targeted_document_proposal() -> None:
    client = _client()
    target = "123e4567-e89b-12d3-a456-426614174001"
    with Stubber(client) as stubber:
        stubber.add_response(
            "converse",
            _response(
                "<response_type>proposal</response_type>"
                "<message>승인 절차를 추가했습니다.</message>"
                f"<target_artifact_id>{target}</target_artifact_id>"
                "<document># 요구사항 정의서\n\n## 승인 절차\n승인자를 지정합니다.</document>"
            ),
            _expected("수정해줘"),
        )
        result = BedrockConverseAdapter(client).converse((), "수정해줘")

    assert result.response_type == "proposal"
    assert result.target_artifact_id == target
    assert result.preview_markdown and "승인 절차" in result.preview_markdown


def test_converse_propagates_provider_failure_to_service_boundary() -> None:
    client = _client()
    with Stubber(client) as stubber:
        stubber.add_client_error("converse", service_error_code="InternalServerException")
        with pytest.raises(Exception):
            BedrockConverseAdapter(client).converse(
                (AiSessionMessage("user", "prior", datetime.now(UTC)),), "새 요청"
            )

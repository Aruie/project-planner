from datetime import UTC, datetime

import boto3
from botocore.stub import Stubber

from app.domain.entities import AiSessionMessage
from app.features.ai_workspace.bedrock import MODEL_ID, BedrockConverseAdapter


def test_bedrock_converse_contract_preserves_successful_history_order() -> None:
    client = boto3.client(
        "bedrock-runtime",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    prior = AiSessionMessage("assistant", "이전 성공", datetime(2026, 9, 3, tzinfo=UTC))
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
        "messages": [
            {"role": "assistant", "content": [{"text": "이전 성공"}]},
            {"role": "user", "content": [{"text": "새 요구사항"}]},
        ],
    }
    with Stubber(client) as stubber:
        stubber.add_response(
            "converse",
            {
                "output": {"message": {"role": "assistant", "content": [{"text": "# 새 초안"}]}},
                "stopReason": "end_turn",
                "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
                "metrics": {"latencyMs": 1},
            },
            expected,
        )
        result = BedrockConverseAdapter(client).converse((prior,), "새 요구사항")
    assert result.preview_markdown == "# 새 초안"

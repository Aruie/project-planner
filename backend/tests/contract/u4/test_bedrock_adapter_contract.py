from datetime import UTC, datetime

import boto3
from botocore.stub import Stubber

from app.domain.entities import AiSessionMessage
from app.features.ai_workspace.bedrock import _SYSTEM_GUIDANCE, MODEL_ID, BedrockConverseAdapter


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
        "system": [{"text": _SYSTEM_GUIDANCE}],
        "messages": [
            {"role": "assistant", "content": [{"text": "이전 성공"}]},
            {"role": "user", "content": [{"text": "새 요구사항"}]},
        ],
    }
    with Stubber(client) as stubber:
        stubber.add_response(
            "converse",
            {
                "output": {
                    "message": {
                        "role": "assistant",
                        "content": [
                            {
                                "text": (
                                    "<response_type>answer</response_type>"
                                    "<message>프로젝트 답변</message>"
                                )
                            }
                        ],
                    }
                },
                "stopReason": "end_turn",
                "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
                "metrics": {"latencyMs": 1},
            },
            expected,
        )
        result = BedrockConverseAdapter(client).converse((prior,), "새 요구사항")
    assert result.response_type == "answer"
    assert result.assistant_message == "프로젝트 답변"

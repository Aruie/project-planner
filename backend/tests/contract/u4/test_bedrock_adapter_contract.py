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
                    "당신은 현재 열린 개발 산출물을 수정하는 한국어 문서 편집 도우미입니다. "
                    "사용자가 제공한 current_document만 기준으로 요청된 변경을 "
                    "반영하고 기존 문서 형식을 보존하세요. "
                    "새 문서를 임의로 만들거나 다른 프로젝트 정보를 사용하지 마세요. "
                    "응답은 반드시 <summary>변경 요약</summary><document>"
                    "수정된 전체 원문</document> 형식으로만 작성하세요."
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

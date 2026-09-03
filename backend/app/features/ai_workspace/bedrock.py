"""boto3-only Bedrock Converse adapter for U4."""

from __future__ import annotations

from typing import Any

from app.domain.entities import AiSessionMessage

from .ports import BedrockConversationResult

MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
_SYSTEM_GUIDANCE = (
    "한국어 개발 산출물 요구사항 Markdown 초안을 생성하세요. 다른 프로젝트 정보를 사용하지 마세요."
)


class BedrockConverseAdapter:
    def __init__(self, client: Any) -> None:
        self._client = client

    def converse(
        self, messages: tuple[AiSessionMessage, ...], prompt: str
    ) -> BedrockConversationResult:
        request_messages = [
            {"role": item.role, "content": [{"text": item.content}]} for item in messages
        ]
        request_messages.append({"role": "user", "content": [{"text": prompt}]})
        response = self._client.converse(
            modelId=MODEL_ID,
            system=[{"text": _SYSTEM_GUIDANCE}],
            messages=request_messages,
        )
        text = "".join(
            str(block.get("text", "")) for block in response["output"]["message"]["content"]
        ).strip()
        if not text:
            raise ValueError("Bedrock response did not contain text")
        return BedrockConversationResult(assistant_message=text, preview_markdown=text)

"""boto3-only Bedrock Converse adapter for U4."""

from __future__ import annotations

import re
from typing import Any

from app.domain.entities import AiSessionMessage

from .ports import BedrockConversationResult

MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
_SYSTEM_GUIDANCE = (
    "당신은 현재 열린 개발 산출물을 수정하는 한국어 문서 편집 도우미입니다. "
    "사용자가 제공한 current_document만 기준으로 요청된 변경을 "
    "반영하고 기존 문서 형식을 보존하세요. "
    "새 문서를 임의로 만들거나 다른 프로젝트 정보를 사용하지 마세요. "
    "응답은 반드시 <summary>변경 요약</summary><document>"
    "수정된 전체 원문</document> 형식으로만 작성하세요."
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
        summary = re.search(r"<summary>\s*([\s\S]*?)\s*</summary>", text)
        document = re.search(r"<document>\s*([\s\S]*?)\s*</document>", text)
        if summary and document:
            return BedrockConversationResult(
                assistant_message=summary.group(1).strip(),
                preview_markdown=document.group(1).strip(),
            )
        return BedrockConversationResult(assistant_message=text, preview_markdown=text)

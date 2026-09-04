"""boto3-only Bedrock Converse adapter for project-wide conversational assistance."""

from __future__ import annotations

import re
from typing import Any

from app.domain.entities import AiSessionMessage

from .ports import BedrockConversationResult

MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
_SYSTEM_GUIDANCE = (
    "당신은 현재 프로젝트의 개발 산출물 전체를 읽고 답하는 한국어 프로젝트 도우미입니다. "
    "project 컨텍스트 밖의 사실을 만들지 말고 웹 검색을 하지 마세요. "
    "요약, 내용 검색, 비교, 질문에는 일반 답변을 제공하세요. "
    "사용자가 문서의 추가·수정·삭제를 명시적으로 요청한 경우에만 proposal을 만드세요. "
    "proposal은 반드시 artifact_catalog에 있는 정확한 문서 ID 하나를 대상으로 하고 "
    "기존 형식을 보존한 수정 후 전체 원문을 반환하세요. "
    "일반 답변 형식: <response_type>answer</response_type><message>답변</message>. "
    "변경안 형식: <response_type>proposal</response_type><message>변경 요약</message>"
    "<target_artifact_id>정확한 문서 UUID</target_artifact_id>"
    "<document>수정된 전체 원문</document>."
)


def _tag(text: str, name: str) -> str | None:
    match = re.search(rf"<{name}>\s*([\s\S]*?)\s*</{name}>", text)
    return match.group(1).strip() if match else None


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

        response_type = _tag(text, "response_type")
        message = _tag(text, "message")
        if response_type == "proposal":
            target = _tag(text, "target_artifact_id")
            document = _tag(text, "document")
            if not message or not target or not document:
                raise ValueError("Bedrock proposal response was incomplete")
            return BedrockConversationResult(message, "proposal", document, target)
        if response_type == "answer" and message:
            return BedrockConversationResult(message, "answer")

        # Backward-compatible parsing for an in-flight response from the former editor prompt.
        summary = _tag(text, "summary")
        document = _tag(text, "document")
        if summary and document:
            return BedrockConversationResult(summary, "proposal", document)
        return BedrockConversationResult(text, "answer")

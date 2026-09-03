"""Safe U4 errors that deliberately exclude Bedrock/AWS internals."""

from __future__ import annotations


class AiWorkspaceProblem(Exception):
    def __init__(
        self, code: str, message: str, status_code: int, *, retryable: bool = False
    ) -> None:
        self.code, self.message = code, message
        self.status_code, self.retryable = status_code, retryable
        super().__init__(message)


def session_expired() -> AiWorkspaceProblem:
    return AiWorkspaceProblem(
        "AI_SESSION_EXPIRED", "AI 세션이 만료되었거나 존재하지 않습니다.", 404
    )


def scope_mismatch() -> AiWorkspaceProblem:
    return AiWorkspaceProblem(
        "AI_SESSION_SCOPE_MISMATCH", "프로젝트와 AI 세션의 범위가 일치하지 않습니다.", 403
    )


def input_too_large() -> AiWorkspaceProblem:
    return AiWorkspaceProblem(
        "AI_INPUT_TOO_LARGE", "AI 입력 또는 미리보기 크기가 제한을 초과했습니다.", 400
    )


def preview_required() -> AiWorkspaceProblem:
    return AiWorkspaceProblem("AI_PREVIEW_REQUIRED", "저장할 AI 미리보기가 필요합니다.", 400)


def invocation_failed() -> AiWorkspaceProblem:
    return AiWorkspaceProblem(
        "BEDROCK_INVOCATION_FAILED",
        "AI 응답 생성에 실패했습니다. 내용을 수정해 다시 요청하세요.",
        502,
        retryable=True,
    )

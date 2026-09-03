"""Safe Korean API errors for U2."""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.errors import (
    ArtifactNotFound,
    ContentStorageFailure,
    DomainError,
    DraftRevisionConflict,
    PersistenceOutcomeUnknown,
    ProjectNotFound,
    VersionConfirmationConflict,
    VersionNotFound,
)


@dataclass(slots=True)
class ApiProblem(Exception):
    code: str
    message: str
    retryable: bool = False
    current_revision: int | None = None
    status_code: int = 400


_MESSAGES = {
    "PROJECT_NOT_FOUND": "프로젝트를 찾을 수 없습니다.",
    "ARTIFACT_NOT_FOUND": "산출물을 찾을 수 없습니다.",
    "VERSION_NOT_FOUND": "버전을 찾을 수 없습니다.",
    "DRAFT_REVISION_CONFLICT": "최신 Draft를 다시 조회한 뒤 수정해주세요.",
    "VERSION_CONFIRMATION_CONFLICT": "최신 버전 이력을 다시 조회한 뒤 확정해주세요.",
    "PERSISTENCE_OUTCOME_UNKNOWN": "저장 결과를 확인할 수 없습니다. 최신 정보를 다시 조회해주세요.",
    "CONTENT_STORAGE_FAILURE": "본문 저장 또는 조회에 실패했습니다.",
}


def map_domain_error(error: Exception) -> ApiProblem:
    if isinstance(error, DraftRevisionConflict):
        return ApiProblem(error.code, _MESSAGES[error.code], False, error.current_revision, 409)
    if isinstance(error, ProjectNotFound | ArtifactNotFound | VersionNotFound):
        return ApiProblem(error.code, _MESSAGES[error.code], False, status_code=404)
    if isinstance(error, VersionConfirmationConflict):
        return ApiProblem(error.code, _MESSAGES[error.code], False, status_code=409)
    if isinstance(error, PersistenceOutcomeUnknown):
        return ApiProblem(error.code, _MESSAGES[error.code], False, status_code=503)
    if isinstance(error, ContentStorageFailure):
        return ApiProblem(error.code, _MESSAGES[error.code], True, status_code=502)
    if isinstance(error, DomainError):
        return ApiProblem(error.code, "요청을 처리할 수 없습니다.", error.retryable)
    return ApiProblem(
        "INTERNAL_ERROR", "요청을 처리하는 중 오류가 발생했습니다.", False, status_code=500
    )

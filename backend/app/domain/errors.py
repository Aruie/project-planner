"""Typed U1 domain errors that never expose adapter internals."""

from __future__ import annotations


class DomainError(Exception):
    code = "DOMAIN_ERROR"
    retryable = False

    def __init__(self, message: str) -> None:
        super().__init__(message)


class InvalidIdentifier(DomainError):
    code = "INVALID_IDENTIFIER"


class ProjectNotFound(DomainError):
    code = "PROJECT_NOT_FOUND"


class ArtifactNotFound(DomainError):
    code = "ARTIFACT_NOT_FOUND"


class AiSessionNotFound(DomainError):
    code = "AI_SESSION_NOT_FOUND"


class VersionNotFound(DomainError):
    code = "VERSION_NOT_FOUND"


class DuplicateProjectDocumentId(DomainError):
    code = "DUPLICATE_PROJECT_DOCUMENT_ID"


class DraftRevisionConflict(DomainError):
    code = "DRAFT_REVISION_CONFLICT"

    def __init__(self, current_revision: int) -> None:
        self.current_revision = current_revision
        super().__init__("Draft revision conflict; reload the current draft")


class VersionConfirmationConflict(DomainError):
    code = "VERSION_CONFIRMATION_CONFLICT"


class ContentStorageFailure(DomainError):
    code = "CONTENT_STORAGE_FAILURE"
    retryable = True


class PersistenceOutcomeUnknown(DomainError):
    code = "PERSISTENCE_OUTCOME_UNKNOWN"


class ImmutableSnapshotMutation(DomainError):
    code = "IMMUTABLE_SNAPSHOT_MUTATION"

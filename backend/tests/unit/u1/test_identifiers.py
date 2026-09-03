from __future__ import annotations

from uuid import UUID

import pytest

from app.domain.errors import DraftRevisionConflict, InvalidIdentifier
from app.domain.identifiers import DocumentIdPrefix, ProjectId, PublicDocumentId


def test_project_id_round_trips_a_uuid_string() -> None:
    project_id = ProjectId.parse("123e4567-e89b-12d3-a456-426614174000")

    assert project_id.value == UUID("123e4567-e89b-12d3-a456-426614174000")
    assert str(project_id) == "123e4567-e89b-12d3-a456-426614174000"


@pytest.mark.parametrize("value", ["cka", "C", "CKA-1", "TOO-LONG-ID1", "CK A"])
def test_document_prefix_rejects_invalid_values(value: str) -> None:
    with pytest.raises(InvalidIdentifier):
        DocumentIdPrefix(value)


def test_public_document_id_is_project_local_display_format() -> None:
    document_id = PublicDocumentId(DocumentIdPrefix("CKA"), 1)

    assert str(document_id) == "CKA-001"
    assert PublicDocumentId.parse("CKA-001") == document_id


@pytest.mark.parametrize("value", ["CKA-0", "CKA-01", "cka-001", "CKA-ABC"])
def test_public_document_id_rejects_invalid_format(value: str) -> None:
    with pytest.raises(InvalidIdentifier):
        PublicDocumentId.parse(value)


def test_draft_revision_conflict_requires_reload_and_is_not_retryable() -> None:
    error = DraftRevisionConflict(current_revision=2)

    assert error.code == "DRAFT_REVISION_CONFLICT"
    assert error.current_revision == 2
    assert error.retryable is False

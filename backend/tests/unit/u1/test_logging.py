from __future__ import annotations

import json
from io import StringIO

from app.core.logging import ErrorLogContext, configure_error_logger, log_error


def test_log_error_emits_only_approved_error_fields() -> None:
    output = StringIO()
    logger = configure_error_logger("tests.error_logger", output)

    log_error(
        logger,
        ErrorLogContext(
            request_id="request-1",
            project_id="project-1",
            artifact_id="artifact-1",
            operation="draft_update",
            error_code="DRAFT_REVISION_CONFLICT",
            error_class="DraftRevisionConflict",
            retryable=False,
        ),
    )

    payload = json.loads(output.getvalue())
    assert payload == {
        "artifact_id": "artifact-1",
        "error_class": "DraftRevisionConflict",
        "error_code": "DRAFT_REVISION_CONFLICT",
        "event": "domain_error",
        "level": "ERROR",
        "operation": "draft_update",
        "project_id": "project-1",
        "request_id": "request-1",
        "retryable": False,
    }
    assert "password" not in output.getvalue()
    assert "duration" not in output.getvalue()

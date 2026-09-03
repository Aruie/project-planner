"""Error-only structured logging that excludes sensitive payloads."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from typing import TextIO


@dataclass(frozen=True, slots=True)
class ErrorLogContext:
    request_id: str
    operation: str
    error_code: str
    error_class: str
    retryable: bool
    project_id: str | None = None
    artifact_id: str | None = None

    def to_log_fields(self) -> dict[str, object]:
        return {key: value for key, value in asdict(self).items() if value is not None}


class JsonErrorFormatter(logging.Formatter):
    """Formats only approved error context fields as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "level": record.levelname,
            "event": record.getMessage(),
        }
        payload.update(getattr(record, "error_context", {}))
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def configure_error_logger(
    name: str = "aidlc.errors", stream: TextIO | None = None
) -> logging.Logger:
    """Create a non-propagating logger intended solely for error events."""

    logger = logging.getLogger(name)
    logger.setLevel(logging.ERROR)
    logger.propagate = False
    logger.handlers.clear()

    handler = logging.StreamHandler(stream)
    handler.setLevel(logging.ERROR)
    handler.setFormatter(JsonErrorFormatter())
    logger.addHandler(handler)
    return logger


def log_error(logger: logging.Logger, context: ErrorLogContext) -> None:
    """Emit an approved error event without content, credentials, or timing data."""

    logger.error("domain_error", extra={"error_context": context.to_log_fields()})

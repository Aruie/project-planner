"""Opaque, project-scoped pagination tokens for U2 resources."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any


class PaginationError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True, slots=True)
class DecodedPageToken:
    resource_kind: str
    project_id: str
    cursor: dict[str, Any]


class PaginationCodec:
    default_page_size = 50
    max_page_size = 100

    def page_size(self, requested: int | None) -> int:
        if requested is None:
            return self.default_page_size
        if requested < 1:
            raise PaginationError("PAGINATION_PAGE_SIZE_INVALID")
        return min(requested, self.max_page_size)

    def encode(self, resource_kind: str, project_id: str, cursor: dict[str, Any]) -> str:
        payload = {"kind": resource_kind, "project_id": project_id, "cursor": cursor}
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    def decode(self, token: str, resource_kind: str, project_id: str) -> DecodedPageToken:
        try:
            padded = token + "=" * (-len(token) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
            decoded = DecodedPageToken(
                resource_kind=str(payload["kind"]),
                project_id=str(payload["project_id"]),
                cursor=dict(payload["cursor"]),
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise PaginationError("PAGINATION_TOKEN_INVALID") from error
        if decoded.resource_kind != resource_kind or decoded.project_id != project_id:
            raise PaginationError("PAGINATION_TOKEN_SCOPE_MISMATCH")
        return decoded

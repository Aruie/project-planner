"""Temporary private-network administrator authentication boundary."""

from __future__ import annotations

from dataclasses import dataclass
from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import AuthSettings, get_auth_settings

_security = HTTPBasic(auto_error=True)


@dataclass(frozen=True, slots=True)
class AdminPrincipal:
    username: str


def require_admin(
    credentials: Annotated[HTTPBasicCredentials, Depends(_security)],
    settings: Annotated[AuthSettings, Depends(get_auth_settings)],
) -> AdminPrincipal:
    """Authenticate the configured temporary administrator at the API boundary."""

    username_matches = compare_digest(credentials.username, settings.admin_username)
    password_matches = compare_digest(credentials.password, settings.admin_password)
    if not (username_matches and password_matches):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return AdminPrincipal(username=settings.admin_username)

"""Read-only verification endpoint for the temporary Basic administrator."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AdminPrincipal, require_admin

router = APIRouter(tags=["auth"])


class AuthMeResponse(BaseModel):
    username: str


@router.get("/auth/me", response_model=AuthMeResponse)
def auth_me(principal: Annotated[AdminPrincipal, Depends(require_admin)]) -> AuthMeResponse:
    return AuthMeResponse(username=principal.username)

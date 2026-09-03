from datetime import timedelta

import pytest

from app.domain.entities import AiWorkspaceSession, Project
from app.domain.identifiers import AiSessionId, DocumentIdPrefix, ProjectId
from app.features.ai_workspace.errors import AiWorkspaceProblem
from app.features.ai_workspace.services import PROMPT_MAX_BYTES, SESSION_TTL, AiWorkspaceService

from ...support.u2_fakes import FakeStorage
from ...support.u4_fakes import (
    FakeAiSessionRepository,
    FakeBedrock,
    FakeProjects,
    FakeReviewedCreate,
    fixed_now,
)


def _service():
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    sessions, bedrock = FakeAiSessionRepository(), FakeBedrock()
    service = AiWorkspaceService(
        FakeProjects(project),
        sessions,
        FakeStorage(),
        bedrock,
        FakeReviewedCreate(project),
        fixed_now,
    )
    return service, project, sessions, bedrock


def test_success_only_refreshes_ttl_and_preserves_history() -> None:
    service, project, sessions, bedrock = _service()
    started = service.start(project.project_id)
    assert started.expires_at == fixed_now() + SESSION_TTL
    updated = service.send(project.project_id, AiSessionId.parse(started.session_id), "요구사항")
    assert updated.preview == "# 요구사항\n내용"
    assert len(updated.messages) == 2
    assert updated.expires_at == fixed_now() + SESSION_TTL
    assert sessions.saves == 2
    assert bedrock.calls == 1


def test_failure_preserves_last_success_without_persisting_prompt() -> None:
    service, project, sessions, bedrock = _service()
    started = service.start(project.project_id)
    service.send(project.project_id, AiSessionId.parse(started.session_id), "성공")
    saved = sessions.sessions[next(iter(sessions.sessions))]
    bedrock.error = RuntimeError("provider detail")
    with pytest.raises(AiWorkspaceProblem, match="AI 응답") as error:
        service.send(project.project_id, AiSessionId.parse(started.session_id), "실패")
    assert error.value.code == "BEDROCK_INVOCATION_FAILED"
    assert sessions.saves == 2
    assert sessions.sessions[saved.session_id] == saved
    assert bedrock.calls == 2


def test_expired_and_oversized_prompt_are_rejected_before_invocation() -> None:
    service, project, sessions, bedrock = _service()
    expired = AiWorkspaceSession(
        session_id=AiSessionId.new(),
        project_id=project.project_id,
        preview_content_ref=None,
        expires_at=fixed_now() - timedelta(seconds=1),
    )
    sessions.save(expired)
    with pytest.raises(AiWorkspaceProblem) as expiry:
        service.get(project.project_id, expired.session_id)
    assert expiry.value.code == "AI_SESSION_EXPIRED"
    started = service.start(project.project_id)
    with pytest.raises(AiWorkspaceProblem) as size:
        service.send(
            project.project_id, AiSessionId.parse(started.session_id), "가" * (PROMPT_MAX_BYTES + 1)
        )
    assert size.value.code == "AI_INPUT_TOO_LARGE"
    assert bedrock.calls == 0


def test_reviewed_save_requires_preview_and_uses_explicit_u2_port() -> None:
    service, project, _, _ = _service()
    started = service.start(project.project_id)
    with pytest.raises(AiWorkspaceProblem) as missing:
        service.save_reviewed(project.project_id, AiSessionId.parse(started.session_id), "문서", ())
    assert missing.value.code == "AI_PREVIEW_REQUIRED"
    service.send(project.project_id, AiSessionId.parse(started.session_id), "생성")
    saved = service.save_reviewed(
        project.project_id, AiSessionId.parse(started.session_id), "문서", ("AI",)
    )
    assert saved.revision == 1
    assert "requirements-definition" in saved.tags


def test_oversized_preview_is_rejected_without_success_snapshot() -> None:
    service, project, sessions, bedrock = _service()
    started = service.start(project.project_id)
    bedrock.result = type(bedrock.result)("응답", "가" * ((300 * 1024) + 1))
    with pytest.raises(AiWorkspaceProblem) as size:
        service.send(project.project_id, AiSessionId.parse(started.session_id), "생성")
    assert size.value.code == "AI_INPUT_TOO_LARGE"
    assert sessions.saves == 1


def test_project_session_scope_mismatch_is_rejected() -> None:
    service, project, _, _ = _service()
    started = service.start(project.project_id)
    with pytest.raises(AiWorkspaceProblem) as mismatch:
        service.get(ProjectId.new(), AiSessionId.parse(started.session_id))
    assert mismatch.value.code == "AI_SESSION_SCOPE_MISMATCH"

from datetime import UTC, datetime

from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.entities import Project
from app.domain.identifiers import AiSessionId, DocumentIdPrefix, ProjectId
from app.features.ai_workspace.models import AiApiError, AiMessage, AiWorkspaceState
from app.features.ai_workspace.services import (
    CONTEXT_MAX_MESSAGES,
    PROMPT_MAX_BYTES,
    AiWorkspaceService,
)

from ...support.u2_fakes import FakeStorage
from ...support.u4_fakes import (
    FakeAiSessionRepository,
    FakeBedrock,
    FakeProjects,
    FakeReviewedCreate,
)


def _fixed_now() -> datetime:
    return datetime(2026, 9, 3, tzinfo=UTC)


@settings(max_examples=25)
@given(st.text(max_size=200), st.text(max_size=200))
def test_ai_state_serialization_round_trip(prompt: str, preview: str) -> None:
    state = AiWorkspaceState(
        session_id="123e4567-e89b-12d3-a456-426614174000",
        project_id="123e4567-e89b-12d3-a456-426614174001",
        messages=(AiMessage(role="user", content=prompt or "x", created_at=datetime.now(UTC)),),
        preview=preview or None,
        expires_at=datetime.now(UTC),
    )
    assert AiWorkspaceState.model_validate_json(state.model_dump_json()) == state
    error = AiApiError(code="AI_SESSION_EXPIRED", message="만료", retryable=False)
    assert AiApiError.model_validate_json(error.model_dump_json()) == error


@settings(max_examples=15)
@given(st.lists(st.text(min_size=1, max_size=30), min_size=1, max_size=25))
def test_success_context_remains_bounded(prompts: list[str]) -> None:
    now = _fixed_now
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    service = AiWorkspaceService(
        FakeProjects(project),
        FakeAiSessionRepository(),
        FakeStorage(),
        FakeBedrock(),
        FakeReviewedCreate(project),
        now,
    )
    state = service.start(project.project_id)
    for prompt in prompts:
        state = service.send(project.project_id, AiSessionId.parse(state.session_id), prompt)
    assert len(state.messages) <= CONTEXT_MAX_MESSAGES


@settings(max_examples=10)
@given(st.text(min_size=1, max_size=100))
def test_input_limit_rejects_before_port_call(prefix: str) -> None:
    now = _fixed_now
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    bedrock = FakeBedrock()
    service = AiWorkspaceService(
        FakeProjects(project),
        FakeAiSessionRepository(),
        FakeStorage(),
        bedrock,
        FakeReviewedCreate(project),
        now,
    )
    state = service.start(project.project_id)
    try:
        service.send(
            project.project_id,
            AiSessionId.parse(state.session_id),
            prefix + ("가" * PROMPT_MAX_BYTES),
        )
    except Exception:
        pass
    assert bedrock.calls == 0


@settings(max_examples=10)
@given(st.text(min_size=1, max_size=100), st.text(min_size=1, max_size=100))
def test_failure_preserves_successful_state(first_prompt: str, failed_prompt: str) -> None:
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    sessions, bedrock = FakeAiSessionRepository(), FakeBedrock()
    service = AiWorkspaceService(
        FakeProjects(project),
        sessions,
        FakeStorage(),
        bedrock,
        FakeReviewedCreate(project),
        _fixed_now,
    )
    state = service.start(project.project_id)
    state = service.send(project.project_id, AiSessionId.parse(state.session_id), first_prompt)
    before = sessions.sessions[AiSessionId.parse(state.session_id)]
    bedrock.error = RuntimeError("provider failure")
    try:
        service.send(project.project_id, AiSessionId.parse(state.session_id), failed_prompt)
    except Exception:
        pass
    assert sessions.sessions[before.session_id] == before

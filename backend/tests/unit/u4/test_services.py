from datetime import timedelta

import pytest

from app.domain.content import InlineContentRef
from app.domain.entities import AiWorkspaceSession, Artifact, Draft, DraftRevision, Project
from app.domain.identifiers import AiSessionId, ArtifactId, DocumentIdPrefix, DraftId, ProjectId
from app.features.ai_workspace.errors import AiWorkspaceProblem
from app.features.ai_workspace.ports import BedrockConversationResult
from app.features.ai_workspace.services import PROMPT_MAX_BYTES, SESSION_TTL, AiWorkspaceService

from ...support.u2_fakes import FakeArtifactRepository, FakeStorage
from ...support.u4_fakes import (
    FakeAiSessionRepository,
    FakeBedrock,
    FakeProjects,
    FakeReviewedCreate,
    fixed_now,
)


def _service():
    project = Project(ProjectId.new(), "프로젝트", DocumentIdPrefix("PRJ"), task_name="차세대 구축")
    sessions, bedrock = FakeAiSessionRepository(), FakeBedrock()
    artifacts = FakeArtifactRepository()
    artifact_id, draft_id = ArtifactId.new(), DraftId.new()
    artifact = Artifact(
        artifact_id,
        project.project_id,
        project.allocate_document_id(),
        "MarkdownDocument",
        draft_id,
    )
    artifacts.create(
        artifact,
        Draft(
            draft_id,
            artifact_id,
            DraftRevision(1),
            InlineContentRef.from_content("# 요구사항 정의서\n\n## 기존 내용\n원문입니다."),
            title="요구사항 정의서",
        ),
    )
    service = AiWorkspaceService(
        FakeProjects(project),
        sessions,
        FakeStorage(),
        bedrock,
        FakeReviewedCreate(project),
        fixed_now,
        artifacts,
    )
    return service, project, sessions, bedrock, artifact


def test_answer_reads_project_context_and_does_not_create_preview() -> None:
    service, project, sessions, bedrock, artifact = _service()
    started = service.start(project.project_id)

    updated = service.send(
        project.project_id,
        AiSessionId.parse(started.session_id),
        "프로젝트 내용을 요약해줘",
        str(artifact.artifact_id),
    )

    assert updated.response_type == "answer"
    assert updated.preview is None
    assert len(updated.messages) == 2
    assert updated.messages[0].content == "프로젝트 내용을 요약해줘"
    assert "프로젝트명: 프로젝트" in bedrock.prompts[0]
    assert "제목: 요구사항 정의서" in bedrock.prompts[0]
    assert "## 기존 내용" in bedrock.prompts[0]
    assert updated.expires_at == fixed_now() + SESSION_TTL
    assert sessions.saves == 2


def test_proposal_validates_target_and_computes_changed_parts() -> None:
    service, project, _, bedrock, artifact = _service()
    started = service.start(project.project_id)
    bedrock.result = BedrockConversationResult(
        "승인 절차를 추가했습니다.",
        "proposal",
        "# 요구사항 정의서\n\n## 기존 내용\n원문입니다.\n\n## 승인 절차\n승인자를 지정합니다.",
        str(artifact.artifact_id),
    )

    updated = service.send(project.project_id, AiSessionId.parse(started.session_id), "추가해줘")

    assert updated.response_type == "proposal"
    assert updated.proposal_target_artifact_id == str(artifact.artifact_id)
    assert updated.proposal_target_title == "요구사항 정의서"
    assert "+## 승인 절차" in (updated.proposal_changes or "")
    assert updated.preview and "승인자를 지정합니다." in updated.preview


def test_failure_preserves_last_success_without_persisting_prompt() -> None:
    service, project, sessions, bedrock, _ = _service()
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
    service, project, sessions, bedrock, _ = _service()
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


def test_reviewed_save_requires_proposal_and_uses_explicit_u2_port() -> None:
    service, project, _, bedrock, artifact = _service()
    started = service.start(project.project_id)
    with pytest.raises(AiWorkspaceProblem) as missing:
        service.save_reviewed(project.project_id, AiSessionId.parse(started.session_id), "문서", ())
    assert missing.value.code == "AI_PREVIEW_REQUIRED"
    bedrock.result = BedrockConversationResult(
        "변경", "proposal", "# 변경 문서", str(artifact.artifact_id)
    )
    service.send(project.project_id, AiSessionId.parse(started.session_id), "변경")
    saved = service.save_reviewed(
        project.project_id, AiSessionId.parse(started.session_id), "문서", ("AI",)
    )
    assert saved.revision == 1
    assert "requirements-definition" in saved.tags


def test_oversized_proposal_is_rejected_without_success_snapshot() -> None:
    service, project, sessions, bedrock, artifact = _service()
    started = service.start(project.project_id)
    bedrock.result = BedrockConversationResult(
        "응답",
        "proposal",
        "가" * ((300 * 1024) + 1),
        str(artifact.artifact_id),
    )
    with pytest.raises(AiWorkspaceProblem) as size:
        service.send(project.project_id, AiSessionId.parse(started.session_id), "생성")
    assert size.value.code == "AI_INPUT_TOO_LARGE"
    assert sessions.saves == 1


def test_project_session_scope_mismatch_is_rejected() -> None:
    service, project, _, _, _ = _service()
    started = service.start(project.project_id)
    with pytest.raises(AiWorkspaceProblem) as mismatch:
        service.get(ProjectId.new(), AiSessionId.parse(started.session_id))
    assert mismatch.value.code == "AI_SESSION_SCOPE_MISMATCH"

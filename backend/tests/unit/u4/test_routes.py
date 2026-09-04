from fastapi.testclient import TestClient

from app.core.auth import AdminPrincipal, require_admin
from app.domain.content import InlineContentRef
from app.domain.entities import Artifact, Draft, DraftRevision, Project
from app.domain.identifiers import ArtifactId, DocumentIdPrefix, DraftId, ProjectId
from app.features.ai_workspace.dependencies import get_ai_workspace_service
from app.features.ai_workspace.ports import BedrockConversationResult
from app.features.ai_workspace.services import AiWorkspaceService
from app.main import app

from ...support.u2_fakes import FakeArtifactRepository, FakeStorage
from ...support.u4_fakes import (
    FakeAiSessionRepository,
    FakeBedrock,
    FakeProjects,
    FakeReviewedCreate,
    fixed_now,
)


def test_session_routes_require_auth_and_return_typed_state() -> None:
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    target_id = ArtifactId.new()
    draft_id = DraftId.new()
    artifacts = FakeArtifactRepository()
    artifact = Artifact(
        target_id,
        project.project_id,
        project.allocate_document_id(),
        "MarkdownDocument",
        draft_id,
    )
    artifacts.create(
        artifact,
        Draft(
            draft_id,
            target_id,
            DraftRevision(1),
            InlineContentRef.from_content("# 원문"),
            title="요구사항",
        ),
    )
    bedrock = FakeBedrock()
    service = AiWorkspaceService(
        FakeProjects(project),
        FakeAiSessionRepository(),
        FakeStorage(),
        bedrock,
        FakeReviewedCreate(project),
        fixed_now,
        artifacts,
    )
    app.dependency_overrides[get_ai_workspace_service] = lambda: service
    try:
        unauthorized = TestClient(app).post(f"/projects/{project.project_id}/ai-sessions", json={})
        assert unauthorized.status_code == 401
        app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
        client = TestClient(app)
        started = client.post(f"/projects/{project.project_id}/ai-sessions", json={})
        assert started.status_code == 200
        session_id = started.json()["session_id"]
        message = client.post(
            f"/projects/{project.project_id}/ai-sessions/{session_id}/messages",
            json={"prompt": "프로젝트 요약", "active_artifact_id": str(target_id)},
        )
        assert message.status_code == 200
        assert message.json()["response_type"] == "answer"
        assert message.json()["preview"] is None

        bedrock.result = BedrockConversationResult(
            "수정했습니다.", "proposal", "# 수정안", str(target_id)
        )
        proposal = client.post(
            f"/projects/{project.project_id}/ai-sessions/{session_id}/messages",
            json={"prompt": "문서를 수정해줘", "active_artifact_id": str(target_id)},
        )
        assert proposal.status_code == 200
        assert proposal.json()["proposal_target_artifact_id"] == str(target_id)
        saved = client.post(
            f"/projects/{project.project_id}/ai-sessions/{session_id}/reviewed-saves",
            json={"title": "요구사항"},
        )
    finally:
        app.dependency_overrides.clear()
    assert saved.status_code == 200
    assert saved.json()["revision"] == 1

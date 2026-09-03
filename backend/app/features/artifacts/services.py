"""U2 lifecycle, immutable version, diff, and traceability services."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from app.domain.content import InlineContentRef, S3ContentRef, content_checksum, select_content_ref
from app.domain.entities import Artifact, Draft, DraftRevision, TraceLink, VersionSnapshot
from app.domain.errors import PersistenceOutcomeUnknown, VersionConfirmationConflict
from app.domain.identifiers import ArtifactId, DraftId, ProjectId, TraceLinkId, VersionId
from app.domain.ports import (
    ArtifactRepository,
    AttachmentRepository,
    ObjectStoragePort,
    ProjectRepository,
    TraceLinkRepository,
    VersionRepository,
)

from .errors import ApiProblem, map_domain_error
from .models import (
    ArtifactDetailResponse,
    ArtifactMetadata,
    ArtifactResponse,
    ConfirmVersionRequest,
    DeleteArtifactRequest,
    DiffRequest,
    DiffResult,
    DiffSourceRequest,
    LineHunk,
    MetadataChange,
    TraceGapResult,
    TraceLinkRequest,
    TraceLinkResponse,
    UpdateDraftRequest,
    VersionResponse,
)
from .scope import ProjectScopeGuard

_FRONT_MATTER = re.compile(r"\A\s*---\s*\r?\n[\s\S]*?\r?\n---(?:\s*\r?\n|$)")


def _editable_markdown(source: str) -> str:
    return _FRONT_MATTER.sub("", source, count=1)


def _artifact_response(artifact: Artifact, draft: Draft) -> ArtifactResponse:
    return ArtifactResponse(
        artifact_id=str(artifact.artifact_id),
        project_id=str(artifact.project_id),
        public_document_id=str(artifact.public_document_id),
        artifact_type=artifact.artifact_type,
        draft_id=str(draft.draft_id),
        revision=draft.revision.value,
        title=draft.title,
        description=draft.description,
        tags=draft.tags,
    )


def _version_response(version: VersionSnapshot) -> VersionResponse:
    return VersionResponse(
        version_id=str(version.version_id),
        version_number=version.version_number,
        source_draft_revision=version.source_draft_revision.value,
        created_at=version.created_at,
        title=version.title,
        description=version.description,
        tags=version.tags,
        change_summary=version.change_summary,
    )


class LifecycleService:
    def __init__(
        self,
        projects: ProjectRepository,
        artifacts: ArtifactRepository,
        storage: ObjectStoragePort,
        versions: VersionRepository | None = None,
        attachments: AttachmentRepository | None = None,
    ) -> None:
        self._projects = projects
        self._artifacts = artifacts
        self._storage = storage
        self._versions = versions
        self._attachments = attachments
        self._scope = ProjectScopeGuard(projects, artifacts)

    def create(
        self, project_id: ProjectId, metadata: ArtifactMetadata, content: str
    ) -> ArtifactResponse:
        self._scope.require_project(project_id)
        try:
            document_id = self._projects.allocate_public_document_id(project_id)
            artifact_id, draft_id = ArtifactId.new(), DraftId.new()
            stored_content = (
                _editable_markdown(content)
                if metadata.artifact_type == "MarkdownDocument"
                else content
            )
            ref = self._store_content(project_id, artifact_id, stored_content)
            draft = Draft(
                draft_id,
                artifact_id,
                DraftRevision(1),
                ref,
                title=metadata.title,
                description=metadata.description,
                tags=metadata.tags,
            )
            artifact = Artifact(
                artifact_id, project_id, document_id, metadata.artifact_type, draft_id
            )
            self._artifacts.create(artifact, draft)
            return _artifact_response(artifact, draft)
        except ApiProblem:
            raise
        except Exception as error:
            raise map_domain_error(error) from error

    def get(self, project_id: ProjectId, artifact_id: ArtifactId) -> ArtifactDetailResponse:
        artifact = self._scope.require_artifact(project_id, artifact_id)
        try:
            draft = self._artifacts.get_draft(project_id, artifact_id)
            response = _artifact_response(artifact, draft)
            return ArtifactDetailResponse(
                **response.model_dump(),
                content=self._read_content(draft.content_ref),
            )
        except Exception as error:
            raise map_domain_error(error) from error

    def update(
        self, project_id: ProjectId, artifact_id: ArtifactId, request: UpdateDraftRequest
    ) -> ArtifactResponse:
        artifact = self._scope.require_artifact(project_id, artifact_id)
        try:
            current = self._artifacts.get_draft(project_id, artifact_id)
            expected = DraftRevision(request.expected_revision)
            stored_content = (
                _editable_markdown(request.content)
                if artifact.artifact_type == "MarkdownDocument"
                else request.content
            )
            replacement = Draft(
                current.draft_id,
                current.artifact_id,
                expected.next(),
                self._store_content(project_id, artifact_id, stored_content),
                current.attachment_ids,
                request.title,
                request.description,
                request.tags,
            )
            saved = self._artifacts.replace_draft(project_id, artifact_id, expected, replacement)
            return _artifact_response(artifact, saved)
        except ApiProblem:
            raise
        except Exception as error:
            raise map_domain_error(error) from error

    def delete(
        self, project_id: ProjectId, artifact_id: ArtifactId, request: DeleteArtifactRequest
    ) -> None:
        self._scope.require_artifact(project_id, artifact_id)
        try:
            draft = self._artifacts.get_draft(project_id, artifact_id)
            if request.confirmation_title != draft.title:
                raise ApiProblem(
                    "ARTIFACT_DELETE_CONFIRMATION_MISMATCH",
                    "문서 제목이 일치하지 않습니다.",
                    status_code=400,
                )

            versions = (
                self._versions.list_for_artifact(artifact_id) if self._versions is not None else ()
            )
            attachments = (
                self._attachments.list_for_artifact(project_id, artifact_id)
                if self._attachments is not None
                else ()
            )
            object_keys = {
                reference.object_key
                for reference in (draft.content_ref, *(item.content_ref for item in versions))
                if isinstance(reference, S3ContentRef)
            }
            object_keys.update(item.object_ref.object_key for item in attachments)

            if self._versions is not None:
                self._versions.delete_for_artifact(artifact_id)
            if self._attachments is not None:
                self._attachments.delete_for_artifact(project_id, artifact_id)
            self._artifacts.delete(project_id, artifact_id)

            for object_key in object_keys:
                try:
                    self._storage.delete_unreferenced(object_key)
                except Exception:
                    # Database deletion is authoritative; orphan cleanup can be retried later.
                    pass
        except ApiProblem:
            raise
        except Exception as error:
            raise map_domain_error(error) from error

    def list_artifacts(self, project_id: ProjectId) -> tuple[ArtifactResponse, ...]:
        self._scope.require_project(project_id)
        try:
            return tuple(
                _artifact_response(item, self._artifacts.get_draft(project_id, item.artifact_id))
                for item in self._artifacts.list_for_project(project_id)
            )
        except Exception as error:
            raise map_domain_error(error) from error

    def _read_content(self, reference: InlineContentRef | S3ContentRef) -> str:
        if isinstance(reference, InlineContentRef):
            return reference.content
        return self._storage.get_content(reference).decode()

    def _store_content(self, project_id: ProjectId, artifact_id: ArtifactId, content: str):
        object_key = f"content/{project_id}/{artifact_id}/{content_checksum(content)}"
        reference = select_content_ref(content, object_key=object_key)
        if isinstance(reference, S3ContentRef):
            return self._storage.put_content(object_key, content.encode(), reference.checksum)
        return reference


class VersionConfirmationService:
    def __init__(
        self,
        projects: ProjectRepository,
        artifacts: ArtifactRepository,
        versions: VersionRepository,
    ) -> None:
        self._artifacts, self._versions = artifacts, versions
        self._scope = ProjectScopeGuard(projects, artifacts)

    def confirm(
        self,
        project_id: ProjectId,
        artifact_id: ArtifactId,
        request: ConfirmVersionRequest | None = None,
    ) -> VersionResponse:
        artifact = self._scope.require_artifact(project_id, artifact_id)
        try:
            draft = self._artifacts.get_draft(project_id, artifact_id)
            number = len(self._versions.list_for_artifact(artifact_id)) + 1
            snapshot = VersionSnapshot(
                VersionId.new(),
                artifact_id,
                number,
                draft.revision,
                draft.content_ref,
                attachment_ids=draft.attachment_ids,
                title=draft.title,
                description=draft.description,
                artifact_type=artifact.artifact_type,
                tags=draft.tags,
                change_summary=request.change_summary if request else "",
            )
            return _version_response(self._versions.append(snapshot))
        except ApiProblem:
            raise
        except (PersistenceOutcomeUnknown, VersionConfirmationConflict) as error:
            raise map_domain_error(error) from error
        except Exception as error:
            raise map_domain_error(error) from error

    def list_versions(
        self, project_id: ProjectId, artifact_id: ArtifactId
    ) -> tuple[VersionResponse, ...]:
        self._scope.require_artifact(project_id, artifact_id)
        try:
            return tuple(
                _version_response(item) for item in self._versions.list_for_artifact(artifact_id)
            )
        except Exception as error:
            raise map_domain_error(error) from error


class DiffService:
    def __init__(
        self,
        projects: ProjectRepository,
        artifacts: ArtifactRepository,
        versions: VersionRepository,
        storage: ObjectStoragePort,
    ) -> None:
        self._artifacts, self._versions, self._storage = artifacts, versions, storage
        self._scope = ProjectScopeGuard(projects, artifacts)

    def compare(
        self, project_id: ProjectId, artifact_id: ArtifactId, request: DiffRequest
    ) -> DiffResult:
        artifact = self._scope.require_artifact(project_id, artifact_id)
        try:
            left = self._source(project_id, artifact_id, artifact.artifact_type, request.left)
            right = self._source(project_id, artifact_id, artifact.artifact_type, request.right)
            metadata = tuple(
                MetadataChange(field=name, before=left[name], after=right[name])
                for name in ("title", "description", "artifact_type", "tags")
                if left[name] != right[name]
            )
            before = self._content(left["content_ref"])
            after = self._content(right["content_ref"])
            if artifact.artifact_type == "MarkdownDocument":
                before = _editable_markdown(before)
                after = _editable_markdown(after)
            hunks, summary = self._hunks(before, after)
            return DiffResult(
                left=request.left,
                right=request.right,
                metadata_changes=metadata,
                body_hunks=hunks,
                summary=summary,
            )
        except ApiProblem:
            raise
        except Exception as error:
            raise map_domain_error(error) from error

    def _source(
        self,
        project_id: ProjectId,
        artifact_id: ArtifactId,
        artifact_type: str,
        source: DiffSourceRequest,
    ) -> dict[str, object]:
        if source.kind == "draft":
            draft = self._artifacts.get_draft(project_id, artifact_id)
            return {
                "title": draft.title,
                "description": draft.description,
                "tags": draft.tags,
                "artifact_type": artifact_type,
                "content_ref": draft.content_ref,
            }
        if not source.version_id:
            raise ApiProblem("VERSION_ID_REQUIRED", "버전 ID가 필요합니다.")
        version = self._versions.get(artifact_id, VersionId.parse(source.version_id))
        return {
            "title": version.title,
            "description": version.description,
            "tags": version.tags,
            "artifact_type": version.artifact_type,
            "content_ref": version.content_ref,
        }

    def _content(self, reference: InlineContentRef | S3ContentRef) -> str:
        if isinstance(reference, InlineContentRef):
            return reference.content
        return self._storage.get_content(reference).decode()

    def _hunks(self, before: str, after: str) -> tuple[tuple[LineHunk, ...], dict[str, int]]:
        left, right = before.splitlines(), after.splitlines()
        result: list[LineHunk] = []
        counts = {"added": 0, "removed": 0, "unchanged": 0}
        for tag, i1, i2, j1, j2 in SequenceMatcher(a=left, b=right).get_opcodes():
            if tag in {"delete", "replace"}:
                lines = tuple(left[i1:i2])
                result.append(LineHunk(kind="removed", before=lines, after=()))
                counts["removed"] += len(lines)
            if tag in {"insert", "replace"}:
                lines = tuple(right[j1:j2])
                result.append(LineHunk(kind="added", before=(), after=lines))
                counts["added"] += len(lines)
            if tag == "equal":
                old, new = tuple(left[i1:i2]), tuple(right[j1:j2])
                result.append(LineHunk(kind="unchanged", before=old, after=new))
                counts["unchanged"] += len(old)
        return tuple(result), counts


class TraceabilityService:
    def __init__(
        self,
        projects: ProjectRepository,
        artifacts: ArtifactRepository,
        traces: TraceLinkRepository,
    ) -> None:
        self._traces = traces
        self._scope = ProjectScopeGuard(projects, artifacts)

    def create(self, project_id: ProjectId, request: TraceLinkRequest) -> TraceLinkResponse:
        self._scope.require_project(project_id)
        try:
            link = TraceLink(
                TraceLinkId.new(),
                project_id,
                request.story_id,
                request.requirement_id,
                request.test_case_id,
                request.status,
            )
            saved = self._traces.save(link)
            return TraceLinkResponse(
                trace_link_id=str(saved.trace_link_id),
                story_id=saved.story_id,
                requirement_id=saved.requirement_id,
                test_case_id=saved.test_case_id,
                status=saved.status,
            )
        except Exception as error:
            raise map_domain_error(error) from error

    def gaps(
        self,
        project_id: ProjectId,
        story_ids: tuple[str, ...],
        requirement_ids: tuple[str, ...],
        test_case_ids: tuple[str, ...],
    ) -> TraceGapResult:
        self._scope.require_project(project_id)
        try:
            links = self._traces.list_for_project(project_id)
            return TraceGapResult(
                story_ids=tuple(
                    item for item in story_ids if not any(link.story_id == item for link in links)
                ),
                requirement_ids=tuple(
                    item
                    for item in requirement_ids
                    if not any(link.requirement_id == item for link in links)
                ),
                test_case_ids=tuple(
                    item
                    for item in test_case_ids
                    if not any(link.test_case_id == item for link in links)
                ),
            )
        except Exception as error:
            raise map_domain_error(error) from error

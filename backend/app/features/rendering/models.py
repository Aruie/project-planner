"""U3 normalized render and export models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel


class BodyBlock(BaseModel):
    kind: Literal["paragraph", "table", "image", "code"]
    content: str = ""
    rows: tuple[tuple[str, ...], ...] = ()


class CoverModel(BaseModel):
    public_document_id: str
    title: str
    description: str
    artifact_type: str
    task_name: str = ""
    contractor_name: str = ""
    client_name: str = ""
    organization_name: str = ""


class ChangeHistoryEntry(BaseModel):
    version_number: int
    source_draft_revision: int


class RenderModel(BaseModel):
    cover: CoverModel
    change_history: tuple[ChangeHistoryEntry, ...]
    body_blocks: tuple[BodyBlock, ...]
    attachment_ids: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class TemplateDefinition:
    kind: str
    body_sheet: str
    columns: tuple[str, ...]


TEMPLATES = {
    "RequirementsDefinition": TemplateDefinition(
        "RequirementsDefinition",
        "Requirements",
        ("requirement_id", "title", "description", "priority", "source"),
    ),
    "TraceMatrix": TemplateDefinition(
        "TraceMatrix",
        "Traceability",
        ("story_id", "requirement_id", "test_case_id", "status", "gap"),
    ),
    "TestScenarioResult": TemplateDefinition(
        "TestScenarioResult",
        "TestResults",
        ("test_case_id", "scenario", "precondition", "result", "status"),
    ),
    "GenericExcel": TemplateDefinition(
        "GenericExcel", "Data", ("row_id", "category", "title", "description", "note")
    ),
}


class ExportResult(BaseModel):
    filename: str
    content_type: str
    content: bytes

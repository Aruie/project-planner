from io import BytesIO

from openpyxl import load_workbook

from app.domain.content import InlineContentRef
from app.domain.entities import Artifact, Draft, DraftRevision, Project
from app.domain.identifiers import ArtifactId, DocumentIdPrefix, DraftId, ProjectId
from app.features.rendering.renderers import render_model, xlsx_export


def test_xlsx_export_has_fixed_cover_history_and_body_sheets() -> None:
    project = Project(ProjectId.new(), "p", DocumentIdPrefix("PRJ"))
    artifact_id, draft_id = ArtifactId.new(), DraftId.new()
    artifact = Artifact(
        artifact_id, project.project_id, project.allocate_document_id(), "ExcelDocument", draft_id
    )
    draft = Draft(
        draft_id,
        artifact_id,
        DraftRevision(1),
        InlineContentRef.from_content("body"),
        title="Title",
    )
    model = render_model(artifact, draft, (), "hello\n\n| a | b |\n|---|---|\n| 1 | 2 |")
    model.cover.task_name = "과제"
    model.cover.contractor_name = "수탁기관"
    model.cover.client_name = "발주처"
    model.cover.organization_name = "회사기관"
    result = xlsx_export(model, "GenericExcel")
    workbook = load_workbook(BytesIO(result.content))
    assert workbook.sheetnames == ["Cover", "ChangeHistory", "Data"]
    assert tuple(cell.value for cell in workbook["Data"][1]) == (
        "row_id",
        "category",
        "title",
        "description",
        "note",
    )

    cover_values = {
        row[0].value: row[1].value for row in workbook["Cover"].iter_rows(min_col=1, max_col=2)
    }
    assert cover_values["Title"] == "Title"
    assert cover_values["Task Name"] == "과제"
    assert cover_values["Contractor"] == "수탁기관"
    assert cover_values["Client"] == "발주처"
    assert cover_values["Organization"] == "회사기관"

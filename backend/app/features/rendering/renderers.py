"""U3 Markdown RenderModel factory and fixed XLSX export."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook

from app.domain.entities import Artifact, Draft, VersionSnapshot

from .errors import RENDERER_NOT_SUPPORTED, XLSX_EXPORT_FAILED, RenderProblem
from .models import TEMPLATES, BodyBlock, ChangeHistoryEntry, CoverModel, ExportResult, RenderModel


def markdown_blocks(content: str) -> tuple[BodyBlock, ...]:
    blocks: list[BodyBlock] = []
    for value in content.split("\n\n"):
        value = value.strip()
        if not value:
            continue
        lines = value.splitlines()
        if len(lines) >= 2 and all(line.startswith("|") for line in lines):
            rows = tuple(
                tuple(cell.strip() for cell in line.strip("|").split("|"))
                for line in lines
                if "---" not in line
            )
            blocks.append(BodyBlock(kind="table", rows=rows))
        elif value.startswith("```"):
            blocks.append(BodyBlock(kind="code", content=value.strip("`\n")))
        elif value.startswith("![]("):
            blocks.append(BodyBlock(kind="image", content=value[4:-1]))
        else:
            blocks.append(BodyBlock(kind="paragraph", content=value))
    return tuple(blocks)


def render_model(
    artifact: Artifact, draft: Draft, versions: tuple[VersionSnapshot, ...], content: str
) -> RenderModel:
    return RenderModel(
        cover=CoverModel(
            public_document_id=str(artifact.public_document_id),
            title=draft.title,
            description=draft.description,
            artifact_type=artifact.artifact_type,
        ),
        change_history=tuple(
            ChangeHistoryEntry(
                version_number=item.version_number,
                source_draft_revision=item.source_draft_revision.value,
            )
            for item in versions
        ),
        body_blocks=markdown_blocks(content),
        attachment_ids=tuple(str(item) for item in draft.attachment_ids),
    )


def xlsx_export(model: RenderModel, template_kind: str) -> ExportResult:
    template = TEMPLATES.get(template_kind)
    if template is None:
        raise RENDERER_NOT_SUPPORTED
    try:
        workbook = Workbook()
        cover = workbook.active
        cover.title = "Cover"
        cover.append(("Document ID", model.cover.public_document_id))
        cover.append(("Title", model.cover.title))
        cover.append(("Description", model.cover.description))
        cover.append(("Task Name", model.cover.task_name))
        cover.append(("Contractor", model.cover.contractor_name))
        cover.append(("Client", model.cover.client_name))
        cover.append(("Organization", model.cover.organization_name))
        cover.append(("Type", model.cover.artifact_type))
        history = workbook.create_sheet("ChangeHistory")
        history.append(("Version", "Draft Revision"))
        for entry in model.change_history:
            history.append((entry.version_number, entry.source_draft_revision))
        body = workbook.create_sheet(template.body_sheet)
        body.append(template.columns)
        for index, block in enumerate(model.body_blocks, 1):
            if block.kind == "table":
                for row in block.rows:
                    body.append(row)
            else:
                body.append((index, block.kind, block.content))
        stream = BytesIO()
        workbook.save(stream)
        return ExportResult(
            filename=f"{model.cover.public_document_id}.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            content=stream.getvalue(),
        )
    except RenderProblem:
        raise
    except Exception as error:
        raise XLSX_EXPORT_FAILED from error

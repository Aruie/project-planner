"""A4 PDF export that mirrors the managed document preview structure."""

from __future__ import annotations

import re
from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .errors import PDF_EXPORT_FAILED, RenderProblem
from .models import BodyBlock, ExportResult, RenderModel

_BODY_FONT = "HYSMyeongJo-Medium"
_HEADING_FONT = "HYGothic-Medium"


def _register_fonts() -> None:
    for name in (_BODY_FONT, _HEADING_FONT):
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(UnicodeCIDFont(name))


def _styles() -> dict[str, ParagraphStyle]:
    defaults = getSampleStyleSheet()
    return {
        "cover_label": ParagraphStyle(
            "cover_label",
            parent=defaults["Normal"],
            fontName=_HEADING_FONT,
            fontSize=11,
            textColor=colors.HexColor("#31598c"),
            alignment=TA_CENTER,
            spaceAfter=14,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=defaults["Title"],
            fontName=_HEADING_FONT,
            fontSize=26,
            leading=36,
            textColor=colors.HexColor("#17233b"),
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "document_h1",
            parent=defaults["Heading1"],
            fontName=_HEADING_FONT,
            fontSize=19,
            leading=27,
            textColor=colors.HexColor("#17233b"),
            spaceBefore=8,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "document_h2",
            parent=defaults["Heading2"],
            fontName=_HEADING_FONT,
            fontSize=14,
            leading=21,
            textColor=colors.HexColor("#243c63"),
            spaceBefore=10,
            spaceAfter=8,
        ),
        "h3": ParagraphStyle(
            "document_h3",
            parent=defaults["Heading3"],
            fontName=_HEADING_FONT,
            fontSize=11,
            leading=17,
            textColor=colors.HexColor("#31598c"),
            spaceBefore=8,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "document_body",
            parent=defaults["BodyText"],
            fontName=_BODY_FONT,
            fontSize=9.5,
            leading=16,
            textColor=colors.HexColor("#27364c"),
            spaceAfter=8,
        ),
        "toc": ParagraphStyle(
            "document_toc",
            parent=defaults["BodyText"],
            fontName=_BODY_FONT,
            fontSize=10,
            leading=18,
            leftIndent=8,
            textColor=colors.HexColor("#344054"),
        ),
        "small": ParagraphStyle(
            "document_small",
            parent=defaults["BodyText"],
            fontName=_BODY_FONT,
            fontSize=8.5,
            leading=14,
            textColor=colors.HexColor("#526278"),
        ),
        "code": ParagraphStyle(
            "document_code",
            parent=defaults["Code"],
            fontName=_BODY_FONT,
            fontSize=8,
            leading=13,
            leftIndent=8,
            backColor=colors.HexColor("#f3f5f8"),
            borderPadding=6,
        ),
    }


def _paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def _headings(markdown: str) -> list[tuple[int, str]]:
    result: list[tuple[int, str]] = []
    for line in markdown.splitlines():
        match = re.match(r"^(#{1,2})\s+(.+?)\s*$", line)
        if match:
            result.append((len(match.group(1)), match.group(2)))
    return result


def _table(rows: list[list[str]], styles: dict[str, ParagraphStyle]) -> Table:
    width = (A4[0] - 36 * mm) / max(len(rows[0]), 1)
    values = [[_paragraph(cell, styles["small"]) for cell in row] for row in rows]
    table = Table(values, colWidths=[width] * len(rows[0]), repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#17233b")),
                ("FONTNAME", (0, 0), (-1, -1), _BODY_FONT),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#bcc8d8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _markdown_story(markdown: str, styles: dict[str, ParagraphStyle]) -> list[object]:
    story: list[object] = []
    lines = markdown.splitlines()
    index = 0
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            story.append(_paragraph("\n".join(paragraph), styles["body"]))
            paragraph.clear()

    while index < len(lines):
        line = lines[index]
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            flush()
            level = len(heading.group(1))
            style = styles["h1"] if level == 1 else styles["h2"] if level == 2 else styles["h3"]
            story.append(_paragraph(heading.group(2), style))
            index += 1
            continue
        if line.startswith("```"):
            flush()
            code: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].startswith("```"):
                code.append(lines[index])
                index += 1
            story.append(_paragraph("\n".join(code), styles["code"]))
            index += 1
            continue
        if line.strip().startswith("|"):
            flush()
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", cell.replace(" ", "")) for cell in cells):
                    rows.append(cells)
                index += 1
            if rows:
                story.extend([_table(rows, styles), Spacer(1, 7 * mm)])
            continue
        bullet = re.match(r"^[-*]\s+(.+)$", line)
        if bullet:
            flush()
            story.append(_paragraph(f"• {bullet.group(1)}", styles["body"]))
            index += 1
            continue
        if not line.strip():
            flush()
        else:
            paragraph.append(line)
        index += 1
    flush()
    return story


def _model_blocks(blocks: tuple[BodyBlock, ...], styles: dict[str, ParagraphStyle]) -> list[object]:
    story: list[object] = []
    for block in blocks:
        if block.kind == "table" and block.rows:
            if block.content:
                story.append(_paragraph(block.content, styles["h2"]))
            story.extend([_table([list(row) for row in block.rows], styles), Spacer(1, 7 * mm)])
        elif block.content:
            story.append(_paragraph(block.content, styles["body"]))
    return story


def pdf_export(model: RenderModel, markdown: str, filename: str) -> ExportResult:
    try:
        _register_fonts()
        styles = _styles()
        stream = BytesIO()
        document = SimpleDocTemplate(
            stream,
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title=model.cover.title,
            author=model.cover.organization_name,
        )
        story: list[object] = [
            Spacer(1, 45 * mm),
            _paragraph("DOCUMENT", styles["cover_label"]),
            _paragraph(model.cover.title or "제목 없는 문서", styles["cover_title"]),
            Spacer(1, 28 * mm),
        ]
        cover_rows = [
            ["문서 번호", model.cover.public_document_id],
            ["과제명", model.cover.task_name or "-"],
            ["수탁기관", model.cover.contractor_name or "-"],
            ["발주처", model.cover.client_name or "-"],
            ["회사·기관", model.cover.organization_name or "-"],
        ]
        story.extend([_table(cover_rows, styles), PageBreak()])

        headings = _headings(markdown)
        if headings:
            story.extend([_paragraph("목차", styles["h1"]), Spacer(1, 5 * mm)])
            for number, (level, heading) in enumerate(headings, 1):
                prefix = f"{number:02d}"
                indent = "　" if level == 2 else ""
                story.append(_paragraph(f"{prefix}　{indent}{heading}", styles["toc"]))
            story.append(PageBreak())

        body_story = (
            _markdown_story(markdown, styles)
            if markdown.strip()
            else _model_blocks(model.body_blocks, styles)
        )
        story.extend(body_story or [_paragraph("내용이 없습니다.", styles["body"])])

        def add_page_number(canvas, doc) -> None:
            canvas.saveState()
            canvas.setFont(_BODY_FONT, 8)
            canvas.setFillColor(colors.HexColor("#7b8798"))
            canvas.drawCentredString(A4[0] / 2, 9 * mm, str(doc.page))
            canvas.restoreState()

        document.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
        return ExportResult(
            filename=filename, content_type="application/pdf", content=stream.getvalue()
        )
    except RenderProblem:
        raise
    except Exception as error:
        raise PDF_EXPORT_FAILED from error

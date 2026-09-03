"""Thin adapter over the exact-pinned md-publisher package."""

from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from .errors import DOCX_EXPORT_FAILED
from .models import ExportResult


def docx_export(markdown: str, filename: str) -> ExportResult:
    try:
        from md_publisher import publish_docx

        with TemporaryDirectory() as directory:
            source = Path(directory) / "source.md"
            output = Path(directory) / "output.docx"
            source.write_text(markdown, encoding="utf-8")
            publish_docx(str(source), str(output), font="Noto Sans KR")
            return ExportResult(
                filename=filename,
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                content=output.read_bytes(),
            )
    except Exception as error:
        raise DOCX_EXPORT_FAILED from error

"""Safe U3 renderer/export errors."""

from dataclasses import dataclass


@dataclass(slots=True)
class RenderProblem(Exception):
    code: str
    message: str
    retryable: bool = False
    status_code: int = 400


RENDERER_NOT_SUPPORTED = RenderProblem("RENDERER_NOT_SUPPORTED", "지원하지 않는 렌더링 형식입니다.")
ATTACHMENT_SCOPE_MISMATCH = RenderProblem(
    "ATTACHMENT_SCOPE_MISMATCH", "첨부 범위가 일치하지 않습니다.", status_code=404
)
XLSX_EXPORT_FAILED = RenderProblem("XLSX_EXPORT_FAILED", "Excel 내보내기에 실패했습니다.")
DOCX_EXPORT_FAILED = RenderProblem("DOCX_EXPORT_FAILED", "DOCX 내보내기에 실패했습니다.")

PDF_EXPORT_FAILED = RenderProblem("PDF_EXPORT_FAILED", "PDF 내보내기에 실패했습니다.")

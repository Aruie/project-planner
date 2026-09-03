from app.features.rendering.models import CoverModel, RenderModel
from app.features.rendering.pdf import pdf_export


def test_pdf_export_renders_korean_preview_structure() -> None:
    model = RenderModel(
        cover=CoverModel(
            public_document_id="PRJ-003",
            title="변경 관리 내역서",
            description="",
            artifact_type="MarkdownDocument",
            task_name="차세대 시스템 구축",
            contractor_name="수탁기관",
            client_name="발주처",
            organization_name="회사",
        ),
        change_history=(),
        body_blocks=(),
    )

    result = pdf_export(
        model,
        "# 변경 요약\n\n## 승인 절차\n\n- 승인자를 지정합니다.",
        "변경_관리_내역서_v3.pdf",
    )

    assert result.filename == "변경_관리_내역서_v3.pdf"
    assert result.content_type == "application/pdf"
    assert result.content.startswith(b"%PDF-")
    assert len(result.content) > 2_000

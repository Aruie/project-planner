from app.features.rendering.docx import docx_export


def test_docx_export_uses_pinned_md_publisher() -> None:
    result = docx_export("---\ncover:\n  title: Test\n---\n\n# Hello", "test.docx")
    assert result.filename == "test.docx"
    assert result.content.startswith(b"PK")

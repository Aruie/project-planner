from fastapi.testclient import TestClient

from app.core.auth import AdminPrincipal, require_admin
from app.main import app


def test_xlsx_export_route_returns_download_response() -> None:
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    try:
        response = TestClient(app).post(
            "/projects/123e4567-e89b-12d3-a456-426614174000/"
            "artifacts/123e4567-e89b-12d3-a456-426614174001/exports/xlsx",
            json={
                "template_kind": "GenericExcel",
                "model": {
                    "cover": {
                        "public_document_id": "PRJ-001",
                        "title": "T",
                        "description": "",
                        "artifact_type": "ExcelDocument",
                    },
                    "change_history": [],
                    "body_blocks": [],
                },
            },
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.content.startswith(b"PK")
    assert 'attachment; filename="PRJ-001.xlsx"' == response.headers["content-disposition"]


def test_docx_export_route_encodes_korean_download_filename() -> None:
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    try:
        response = TestClient(app).post(
            "/projects/123e4567-e89b-12d3-a456-426614174000/"
            "artifacts/123e4567-e89b-12d3-a456-426614174001/exports/docx",
            json={"markdown": "# 문서\n\n내용", "filename": "변경관리내역서.docx"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.content.startswith(b"PK")
    assert "filename*=UTF-8''%EB%B3%80%EA%B2%BD" in response.headers["content-disposition"]


def test_pdf_export_route_returns_named_pdf() -> None:
    app.dependency_overrides[require_admin] = lambda: AdminPrincipal("admin")
    try:
        response = TestClient(app).post(
            "/projects/123e4567-e89b-12d3-a456-426614174000/"
            "artifacts/123e4567-e89b-12d3-a456-426614174001/exports/pdf",
            json={
                "model": {
                    "cover": {
                        "public_document_id": "PRJ-003",
                        "title": "변경 관리 내역서",
                        "description": "",
                        "artifact_type": "MarkdownDocument",
                        "task_name": "차세대 시스템",
                        "contractor_name": "수탁기관",
                        "client_name": "발주처",
                        "organization_name": "회사",
                    },
                    "change_history": [],
                    "body_blocks": [],
                    "attachment_ids": [],
                },
                "markdown": "# 변경 요약\n\n내용",
                "filename": "변경_관리_내역서_v3.pdf",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    assert ".pdf" in response.headers["content-disposition"]
    assert "filename*=UTF-8''" in response.headers["content-disposition"]

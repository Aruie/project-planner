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

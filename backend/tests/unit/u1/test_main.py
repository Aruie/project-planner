from fastapi.testclient import TestClient

from app.main import app


def test_u1_application_exposes_no_feature_routes() -> None:
    client = TestClient(app)

    response = client.get("/not-a-u1-feature-route")

    assert response.status_code == 404

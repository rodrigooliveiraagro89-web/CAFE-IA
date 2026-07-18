from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_configuration_without_exposing_secrets():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["processor"] == "agryn-ndvi-1.0.0"
    assert "cdse_client_secret" not in payload

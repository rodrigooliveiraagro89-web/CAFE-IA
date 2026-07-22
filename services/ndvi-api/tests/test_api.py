from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def test_health_reports_configuration_without_exposing_secrets():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["processor"] == "agryn-ndvi-1.0.0"
    assert "cdse_client_secret" not in payload


def test_cors_preflight_allows_authorization_header():
    # O frontend envia Authorization: Bearer no POST de processamento (cota de
    # NDVI). Se o CORS não liberar esse header, o preflight falha e o navegador
    # bloqueia a chamada com "Failed to fetch". Este teste trava essa regressão.
    origin = settings.origins[0] if settings.origins else "http://localhost:5173"
    response = TestClient(app).options(
        "/v1/ndvi/jobs",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    allowed = response.headers.get("access-control-allow-headers", "").lower()
    assert "authorization" in allowed

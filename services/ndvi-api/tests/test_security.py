from app.config import settings
from app.security import asset_token, valid_asset_token


def test_asset_links_are_signed_and_tamper_resistant(monkeypatch):
    monkeypatch.setattr(settings, "asset_signing_secret", "test-secret-with-enough-entropy")
    token = asset_token("job-owner-123")

    assert token
    assert valid_asset_token("job-owner-123", token)
    assert not valid_asset_token("job-owner-456", token)
    assert not valid_asset_token("job-owner-123", "invalid")


def test_asset_links_are_closed_when_signing_is_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "asset_signing_secret", "")
    monkeypatch.setattr(settings, "cdse_client_secret", "")

    assert asset_token("job") == ""
    assert not valid_asset_token("job", None)


def test_asset_links_fall_back_to_existing_server_secret(monkeypatch):
    monkeypatch.setattr(settings, "asset_signing_secret", "")
    monkeypatch.setattr(settings, "cdse_client_secret", "existing-render-secret")

    token = asset_token("job")

    assert token
    assert valid_asset_token("job", token)

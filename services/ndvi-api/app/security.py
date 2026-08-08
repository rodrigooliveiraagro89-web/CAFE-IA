import hashlib
import hmac

from .config import settings


def asset_token(job_id: str) -> str:
    # Render deployments already have the Copernicus client secret configured.
    # Reuse it only as a server-side fallback so an older deployment does not
    # break while ASSET_SIGNING_SECRET is being rolled out.
    signing_secret = settings.asset_signing_secret or settings.cdse_client_secret
    if not signing_secret:
        return ""
    return hmac.new(
        signing_secret.encode("utf-8"),
        job_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def valid_asset_token(job_id: str, token: str | None) -> bool:
    expected = asset_token(job_id)
    return bool(expected and token and hmac.compare_digest(expected, token))

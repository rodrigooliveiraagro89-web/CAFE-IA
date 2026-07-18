from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    cdse_client_id: str = ""
    cdse_client_secret: str = ""
    public_base_url: str = "http://localhost:8000"
    allowed_origins: str = (
        "http://localhost:5173,https://rodrigooliveiraagro89-web.github.io"
    )
    result_directory: Path = Path("./data/results")
    result_ttl_hours: int = 168
    max_output_pixels: int = 4_000_000

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    def validate_credentials(self) -> None:
        if not self.cdse_client_id or not self.cdse_client_secret:
            raise RuntimeError(
                "CDSE_CLIENT_ID e CDSE_CLIENT_SECRET precisam estar configurados no servidor."
            )


settings = Settings()


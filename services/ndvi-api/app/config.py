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

    # Usados para validar a sessão do usuário e checar a cota de NDVI por
    # plano. São os mesmos valores públicos já usados pelo frontend
    # (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — não são segredo novo.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    ndvi_quota_free_monthly: int = 2
    ndvi_quota_pro_monthly: int = 100

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    def validate_credentials(self) -> None:
        if not self.cdse_client_id or not self.cdse_client_secret:
            raise RuntimeError(
                "CDSE_CLIENT_ID e CDSE_CLIENT_SECRET precisam estar configurados no servidor."
            )


settings = Settings()


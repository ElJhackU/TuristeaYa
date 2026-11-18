from functools import lru_cache
import base64
import json

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: SecretStr
    SUPABASE_SERVICE_ROLE_KEY: SecretStr | None = None
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "TuristeaYa API"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("SUPABASE_KEY")
    @classmethod
    def require_public_key(cls, value: SecretStr) -> SecretStr:
        key = value.get_secret_value()
        if key.startswith("sb_secret_"):
            raise ValueError("SUPABASE_KEY debe ser una clave pública, no una clave secreta")
        if key.count(".") == 2:
            try:
                segment = key.split(".")[1]
                claims = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
            except (ValueError, UnicodeError):
                raise ValueError("SUPABASE_KEY no tiene un formato válido") from None
            if claims.get("role") != "anon":
                raise ValueError("SUPABASE_KEY debe usar el rol anon")
        return value

    @field_validator("SUPABASE_URL")
    @classmethod
    def validate_supabase_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("https://", "http://")):
            raise ValueError("SUPABASE_URL debe ser una URL HTTP(S) válida")
        return normalized

    @field_validator("API_V1_PREFIX")
    @classmethod
    def normalize_api_prefix(cls, value: str) -> str:
        prefix = "/" + value.strip("/")
        if prefix == "/":
            raise ValueError("API_V1_PREFIX no puede estar vacío")
        return prefix


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Carga y cachea la configuración; las claves nunca se registran en logs."""
    return Settings()


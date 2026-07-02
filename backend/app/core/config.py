from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./petcare.db"
    SECRET_KEY: str
    JWT_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"

    # LLM / AI chat (spec 13). Empty key = chat sends fail with provider_error,
    # but app startup and every other endpoint stay functional by design.
    OPENROUTER_API_KEY: str = ""
    LLM_MODEL: str = "google/gemini-2.5-flash"
    LLM_MAX_OUTPUT_TOKENS: int = 1024

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def async_database_url(self) -> str:
        """Async driver URL derived from the sync DATABASE_URL (Alembic keeps sync)."""
        url = self.DATABASE_URL
        if url.startswith("sqlite+aiosqlite") or url.startswith("postgresql+asyncpg"):
            return url
        if url.startswith("sqlite"):
            return url.replace("sqlite", "sqlite+aiosqlite", 1)
        if url.startswith("postgresql"):
            return url.replace("postgresql", "postgresql+asyncpg", 1)
        return url

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        if not v or v == "change-me-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a strong random value via environment "
                "variable or .env (the placeholder value is not allowed)"
            )
        return v

    @field_validator("JWT_EXPIRE_DAYS")
    @classmethod
    def expiry_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("JWT_EXPIRE_DAYS must be greater than 0")
        return v


settings = Settings()

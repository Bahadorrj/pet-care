from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./petcare.db"
    SECRET_KEY: str
    JWT_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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

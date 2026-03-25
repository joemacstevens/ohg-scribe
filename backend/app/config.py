from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://ohgscribe:ohgscribe@localhost:5432/ohgscribe"

    # API Keys (server-managed — never sent to client)
    assemblyai_api_key: str = ""
    anthropic_api_key: str = ""

    # Auth
    dev_user_email: str = ""  # Set in local dev to bypass Entra ID

    # App
    public_base_path: str = ""
    static_dir: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Module-level singleton for direct import: `from app.config import settings`
settings = get_settings()

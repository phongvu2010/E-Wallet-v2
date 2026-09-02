"""Application Configuration & Environment Settings.

Uses Pydantic Settings V2 to parse environment variables from .env file or system environment,
dynamically resolving asyncpg and psycopg2 database connection strings.
"""

from typing import List, Union

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """System-wide configuration settings loaded from environment or defaults."""

    PROJECT_NAME: str = "Credit Wallet 2.0 API"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # Database
    POSTGRES_DB: str = "credit_wallet"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_SSLMODE: Union[str, None] = (
        None  # None (local) or 'require' (Supabase/Cloud)
    )
    DATABASE_URL: Union[str, None] = None

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_PRE_PING: bool = True

    # Google Sheets ETL Ingestion
    GOOGLE_SHEET_ID: str = "16kks0eL-j7SNxBAR3NlU5n1viIEvTjg-fAu9yWC9mAk"

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        """
        If DATABASE_URL is not explicitly specified, auto-construct it from
        POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, and POSTGRES_SSLMODE.
        """
        if not self.DATABASE_URL:
            import urllib.parse

            user = (
                urllib.parse.quote_plus(self.POSTGRES_USER)
                if self.POSTGRES_USER
                else "postgres"
            )
            pwd_part = (
                f":{urllib.parse.quote_plus(self.POSTGRES_PASSWORD)}"
                if self.POSTGRES_PASSWORD
                else ""
            )
            ssl_param = (
                f"?sslmode={self.POSTGRES_SSLMODE}" if self.POSTGRES_SSLMODE else ""
            )
            self.DATABASE_URL = f"postgresql://{user}{pwd_part}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}{ssl_param}"
        return self

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    @property
    def async_database_url(self) -> str:
        """
        Convert standard postgresql:// URL to postgresql+asyncpg://
        and normalize SSL parameters for asyncpg compatibility (e.g. Supabase / Cloud).
        """
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        # asyncpg does not support libpq's 'sslmode=require', it expects 'ssl=require'
        if "sslmode=" in url:
            url = (
                url.replace("sslmode=require", "ssl=require")
                .replace("?sslmode=", "?ssl=")
                .replace("&sslmode=", "&ssl=")
            )

        return url

    @property
    def sync_database_url(self) -> str:
        """
        Convert standard postgresql:// URL to postgresql+psycopg2://
        """
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg2://", 1)
        return url


settings = Settings()

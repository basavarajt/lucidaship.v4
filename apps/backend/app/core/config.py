"""
Application configuration loaded from environment variables / .env file.
Uses pydantic-settings for validation and type coercion.
"""

import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Centralised, validated app settings."""

    # Application
    APP_NAME: str = "Lucida Lead Scoring API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # Database
    # For production, set `DATABASE_URL` to a managed SQL database (e.g. Cloud SQL).
    # If unset, the app falls back to a local SQLite file for development.
    DATABASE_URL: str = ""
    ALLOW_PRODUCTION_SQLITE_FALLBACK: bool = False
    SQLITE_DB_PATH: str = os.path.join(
        os.getenv("LOCALAPPDATA") or os.getenv("HOME") or "/tmp",
        "Lucida",
        "lucida_local.db",
    )

    # Firebase Auth / Google Cloud
    # firebase-admin uses Application Default Credentials on Cloud Run.
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_PRIVATE_KEY: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""

    # Resend API for emails
    RESEND_API_KEY: str = ""
    RESEND_WEBHOOK_SECRET: str = ""
    SENDER_DOMAIN: str = "hello@lucidaanalytics.tech"
    # Must be set from the deployment secret store when admin-secret endpoints are enabled.
    FASTAPI_SECRET_KEY: str = ""
    ADMIN_EMAIL: str = "talikotibasavaraj77@gmail.com"

    # Google Cloud Storage
    GCS_BUCKET_NAME: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000,https://lucidaanalytics.tech,https://www.lucidaanalytics.tech,https://lucidaanalytics-d28e1.web.app,https://lucidaanalytics-d28e1.firebaseapp.com,https://vantage.csw.lenovo.com"
    # Anonymous, client-selected tenant IDs are for local demonstrations only.
    ALLOW_GUEST_ACCESS: bool = False

    # ML
    MODEL_ARTIFACTS_DIR: str = "./model_artifacts"
    MAX_CSV_SIZE_MB: int = 200
    UPLOAD_COMPRESSION_ENABLED: bool = True
    UPLOAD_COMPRESSION_MODE: str = "shadow"
    UPLOAD_COMPRESSION_NUMERIC_ONLY: bool = True
    UPLOAD_COMPRESSION_MIN_ROWS: int = 128
    UPLOAD_COMPRESSION_MAX_ALLOWED_MSE: float = 0.05
    UPLOAD_COMPRESSION_MAX_ALLOWED_IP_ERROR: float = 0.10

    # Ranking explanation intelligence layer
    LLM_EXPLANATIONS_ENABLED: bool = False
    LLM_EXPLANATION_PROVIDER: str = "ollama"
    LLM_EXPLANATION_MODEL: str = "phi3:mini"
    LLM_EXPLANATION_ENDPOINT: str = "http://localhost:11434/api/generate"
    LLM_EXPLANATION_TIMEOUT_SECONDS: int = 8
    LLM_EXPLANATION_MAX_ROWS: int = 25

    # Scoring performance and business-aware weighting
    SCORE_CACHE_TTL_SECONDS: int = 300
    SIGNAL_CACHE_TTL_SECONDS: int = 600
    BUSINESS_WEIGHT_JOB_TITLE: float = 1.35
    BUSINESS_WEIGHT_COMPANY_SIZE: float = 1.2
    BUSINESS_WEIGHT_RECENT_ACTIVITY: float = 1.4
    ADAPTIVE_WEIGHT_MIN: float = 0.75
    ADAPTIVE_WEIGHT_MAX: float = 2.0

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached Settings singleton."""
    return Settings()

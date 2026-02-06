"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env file.
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Application
    DEBUG: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR

    # RBAC Flags
    CLIENT_ADMIN_CAN_VIEW_SECRETS: bool = False
    TECHNICIAN_CAN_EDIT_SECRETS: bool = True

    # Encryption
    # Fernet key for encrypting secret asset properties (device passwords, etc.)
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Required in production (DEBUG=False). In dev mode a deterministic key is derived automatically.
    ENCRYPTION_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


# Global settings instance
settings = Settings()

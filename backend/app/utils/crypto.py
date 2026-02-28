"""
Symmetric encryption for secret asset properties.

Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography library
(already installed as a dependency of python-jose[cryptography]).

Storage format: enc:1:<fernet-token>
Backward compatibility: values without the prefix are treated as plaintext.
"""
import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

ENCRYPTED_PREFIX = "enc:1:"


def _init_fernet() -> Fernet:
    """Initialize Fernet cipher from settings. Called once at module load."""
    key = settings.ENCRYPTION_KEY

    if not key:
        if not settings.DEBUG:
            raise SystemExit(
                "ENCRYPTION_KEY is required in production. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        # Deterministic dev key derived from JWT_SECRET_KEY (dev convenience only)
        raw = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(raw).decode()
        logger.warning(
            "ENCRYPTION_KEY not set — using deterministic dev key. "
            "DO NOT use this in production!"
        )

    return Fernet(key.encode() if isinstance(key, str) else key)


_fernet = _init_fernet()


def is_encrypted(value: str) -> bool:
    """Check whether a stored value has the encryption prefix."""
    return value.startswith(ENCRYPTED_PREFIX)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a plaintext secret and return prefixed ciphertext."""
    token = _fernet.encrypt(plaintext.encode("utf-8"))
    return ENCRYPTED_PREFIX + token.decode("utf-8")


def decrypt_secret(stored_value: str) -> str:
    """Decrypt a stored secret value.

    If the value has no encryption prefix it is returned as-is
    (backward compatibility with pre-encryption plaintext data).
    """
    if not stored_value:
        return stored_value

    if not is_encrypted(stored_value):
        return stored_value

    token = stored_value[len(ENCRYPTED_PREFIX):]
    try:
        return _fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt secret value — invalid token or wrong key")
        raise ValueError("Cannot decrypt secret: invalid token or wrong encryption key")

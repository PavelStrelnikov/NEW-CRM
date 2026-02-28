"""Encrypt existing plaintext secret property values

Revision ID: 20260205_000001
Revises: 20260121_000002
Create Date: 2026-02-05

Finds all asset_property_values with data_type='secret' that are stored
as plaintext (no 'enc:1:' prefix) and encrypts them using Fernet.
"""
import base64
import hashlib
import logging
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# revision identifiers, used by Alembic.
revision: str = '20260205_000001'
down_revision: Union[str, None] = '20260121_000002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENCRYPTED_PREFIX = "enc:1:"


def _get_fernet() -> Fernet:
    """Build Fernet cipher using the same logic as app.utils.crypto."""
    import os
    from dotenv import load_dotenv

    # Load .env so we can read ENCRYPTION_KEY / JWT_SECRET_KEY
    load_dotenv()

    key = os.getenv("ENCRYPTION_KEY")
    debug = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    if not key:
        if not debug:
            raise SystemExit(
                "ENCRYPTION_KEY is required for this migration. "
                "Set it in .env or as an environment variable."
            )
        jwt_secret = os.getenv("JWT_SECRET_KEY", "")
        if not jwt_secret:
            raise SystemExit("JWT_SECRET_KEY is required to derive dev encryption key.")
        raw = hashlib.sha256(jwt_secret.encode()).digest()
        key = base64.urlsafe_b64encode(raw).decode()
        logger.warning("Using deterministic dev encryption key (from JWT_SECRET_KEY).")

    return Fernet(key.encode() if isinstance(key, str) else key)


def upgrade() -> None:
    """Encrypt all plaintext secret values in asset_property_values."""
    connection = op.get_bind()
    fernet = _get_fernet()

    # Find all secret property values that are NOT yet encrypted
    rows = connection.execute(sa.text("""
        SELECT apv.id, apv.value_secret_encrypted
        FROM asset_property_values apv
        JOIN asset_property_definitions apd ON apd.id = apv.property_definition_id
        WHERE apd.data_type = 'secret'
          AND apv.value_secret_encrypted IS NOT NULL
          AND apv.value_secret_encrypted != ''
          AND apv.value_secret_encrypted NOT LIKE 'enc:1:%'
    """)).fetchall()

    encrypted_count = 0
    for row in rows:
        row_id = row[0]
        plaintext = row[1]
        token = fernet.encrypt(plaintext.encode("utf-8"))
        encrypted_value = ENCRYPTED_PREFIX + token.decode("utf-8")
        connection.execute(
            sa.text("UPDATE asset_property_values SET value_secret_encrypted = :val WHERE id = :id"),
            {"val": encrypted_value, "id": row_id}
        )
        encrypted_count += 1

    logger.info(f"Encrypted {encrypted_count} secret property value(s).")
    if encrypted_count > 0:
        connection.commit()


def downgrade() -> None:
    """Decrypt all encrypted secret values back to plaintext."""
    connection = op.get_bind()
    fernet = _get_fernet()

    rows = connection.execute(sa.text("""
        SELECT apv.id, apv.value_secret_encrypted
        FROM asset_property_values apv
        JOIN asset_property_definitions apd ON apd.id = apv.property_definition_id
        WHERE apd.data_type = 'secret'
          AND apv.value_secret_encrypted IS NOT NULL
          AND apv.value_secret_encrypted LIKE 'enc:1:%'
    """)).fetchall()

    decrypted_count = 0
    for row in rows:
        row_id = row[0]
        stored = row[1]
        token = stored[len(ENCRYPTED_PREFIX):]
        plaintext = fernet.decrypt(token.encode("utf-8")).decode("utf-8")
        connection.execute(
            sa.text("UPDATE asset_property_values SET value_secret_encrypted = :val WHERE id = :id"),
            {"val": plaintext, "id": row_id}
        )
        decrypted_count += 1

    logger.info(f"Decrypted {decrypted_count} secret property value(s).")
    if decrypted_count > 0:
        connection.commit()

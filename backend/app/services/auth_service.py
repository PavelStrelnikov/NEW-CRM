"""
Authentication service for internal and portal users.
Handles token generation, validation, and password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import UUID
from jose import jwt
from passlib.context import CryptContext

from app.config import settings

# Use passlib for password hashing (matches existing code)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for handling authentication operations."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt via passlib."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password against its hash."""
        try:
            return pwd_context.verify(password, password_hash)
        except Exception:
            return False

    @staticmethod
    def create_internal_user_token(
        user_id: UUID,
        email: str,
        role: str,
        name: str
    ) -> str:
        """
        Create a JWT token for an internal user.

        Args:
            user_id: Internal user ID
            email: User email
            role: User role (admin, technician, office)
            name: User display name

        Returns:
            JWT token string
        """
        payload = {
            "sub": str(user_id),
            "email": email,
            "role": role,
            "name": name,
            "user_type": "internal",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        }
        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        return token

    @staticmethod
    def create_portal_user_token(
        user_id: UUID,
        email: str,
        role: str,
        client_id: UUID,
        primary_client_id: UUID,
        allowed_client_ids: Optional[list[str]] = None,
        allowed_site_ids: Optional[list[str]] = None,
        can_view_secrets: bool = False
    ) -> str:
        """
        Create a JWT token for a portal user (client_user or client_admin).

        Args:
            user_id: Client user ID
            email: User email
            role: User role (CLIENT_USER, CLIENT_CONTACT, CLIENT_ADMIN)
            client_id: Currently active/selected client ID
            primary_client_id: User's primary client (from client_users.client_id)
            allowed_client_ids: All clients assigned to this CLIENT_ADMIN (None for CLIENT_USER)
            allowed_site_ids: Site restrictions (for CLIENT_USER only)
            can_view_secrets: Whether user can view device passwords

        Returns:
            JWT token string
        """
        payload = {
            "sub": str(user_id),
            "email": email,
            "role": role,
            "client_id": str(client_id),  # Active client
            "primary_client_id": str(primary_client_id),  # Home client
            "allowed_client_ids": allowed_client_ids or [],  # Multi-client access
            "allowed_site_ids": allowed_site_ids or [],
            "can_view_secrets": can_view_secrets,  # Device password access
            "user_type": "portal",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        }
        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        return token

    @staticmethod
    def refresh_internal_token(
        user_id: UUID,
        email: str,
        role: str,
        name: str
    ) -> str:
        """Refresh (recreate) an internal user token."""
        return AuthService.create_internal_user_token(user_id, email, role, name)

    @staticmethod
    def refresh_portal_token(
        user_id: UUID,
        email: str,
        role: str,
        client_id: UUID,
        allowed_site_ids: Optional[list[str]] = None
    ) -> str:
        """Refresh (recreate) a portal user token."""
        return AuthService.create_portal_user_token(
            user_id, email, role, client_id, allowed_site_ids
        )

    @staticmethod
    def get_current_user(db, token: str):
        """
        Decode JWT token and retrieve user from database.

        Args:
            db: Database session
            token: JWT token string

        Returns:
            CurrentUser object or None if invalid
        """
        from app.schemas.auth import CurrentUser
        from app.models.users import InternalUser, ClientUser

        try:
            # Decode token
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )

            user_id = UUID(payload.get("sub"))
            user_type = payload.get("user_type")

            if user_type == "internal":
                # Query internal user
                user = db.query(InternalUser).filter(InternalUser.id == user_id).first()
                if not user:
                    return None

                return CurrentUser(
                    id=user.id,
                    name=user.name,
                    email=user.email,
                    role=user.role,
                    user_type="internal",
                    client_id=None,
                    is_active=user.is_active,
                    preferred_locale=user.preferred_locale
                )

            elif user_type == "portal":
                # Query portal user
                user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
                if not user:
                    return None

                return CurrentUser(
                    id=user.id,
                    name=user.name,
                    email=user.email,
                    role=user.role,
                    user_type="client",
                    client_id=user.client_id,
                    is_active=user.is_active,
                    preferred_locale=user.preferred_locale
                )

            return None

        except Exception as e:
            # Token decode failed or database error
            return None

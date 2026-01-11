"""
Authentication service for user login and token management.
"""
from typing import Optional, Union, Tuple
from sqlalchemy.orm import Session

from app.models.users import InternalUser, ClientUser
from app.auth.security import pwd_hasher, token_manager
from app.schemas.auth import CurrentUser


class AuthService:
    """Service for authenticating users."""

    @staticmethod
    def authenticate_user(
        db: Session,
        email: str,
        password: str
    ) -> Optional[Tuple[Union[InternalUser, ClientUser], str]]:
        """
        Authenticate a user by email and password.

        Args:
            db: Database session
            email: User email
            password: Plain text password

        Returns:
            Tuple of (user, user_type) if authentication succeeds, None otherwise
            user_type is either "internal" or "client"
        """
        # Try to find internal user first
        internal_user = db.query(InternalUser).filter(
            InternalUser.email == email
        ).first()

        if internal_user:
            if not internal_user.is_active:
                return None

            if pwd_hasher.verify_password(password, internal_user.password_hash):
                return (internal_user, "internal")

        # Try to find client user
        client_user = db.query(ClientUser).filter(
            ClientUser.email == email
        ).first()

        if client_user:
            if not client_user.is_active:
                return None

            if pwd_hasher.verify_password(password, client_user.password_hash):
                return (client_user, "client")

        return None

    @staticmethod
    def create_access_token_for_user(
        user: Union[InternalUser, ClientUser],
        user_type: str
    ) -> str:
        """
        Create an access token for a user.

        Args:
            user: User object (InternalUser or ClientUser)
            user_type: Type of user ("internal" or "client")

        Returns:
            JWT access token
        """
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, 'value') else user.role,
            "user_type": user_type
        }

        # Add client_id for client users
        if user_type == "client" and hasattr(user, 'client_id'):
            token_data["client_id"] = str(user.client_id)

        return token_manager.create_access_token(token_data)

    @staticmethod
    def get_current_user(
        db: Session,
        token: str
    ) -> Optional[CurrentUser]:
        """
        Get the current user from a JWT token.

        Args:
            db: Database session
            token: JWT access token

        Returns:
            CurrentUser object if token is valid, None otherwise
        """
        payload = token_manager.decode_access_token(token)
        if not payload:
            return None

        user_id = payload.get("sub")
        user_type = payload.get("user_type")

        if not user_id or not user_type:
            return None

        # Fetch user from database
        if user_type == "internal":
            user = db.query(InternalUser).filter(InternalUser.id == user_id).first()
        elif user_type == "client":
            user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
        else:
            return None

        if not user or not user.is_active:
            return None

        # Convert to CurrentUser schema
        current_user = CurrentUser(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role.value if hasattr(user.role, 'value') else user.role,
            user_type=user_type,
            client_id=user.client_id if user_type == "client" else None,
            is_active=user.is_active,
            preferred_locale=user.preferred_locale.value if hasattr(user.preferred_locale, 'value') else user.preferred_locale
        )

        return current_user


# Singleton instance
auth_service = AuthService()

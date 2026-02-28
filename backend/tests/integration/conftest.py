"""
Integration test fixtures (API + Database).
Provides FastAPI TestClient with database override.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import get_db


@pytest.fixture
def test_client(db_session: Session):
    """
    FastAPI TestClient with database override.

    This fixture overrides the get_db dependency to use the test database.
    All API calls made through this client will use the test DB transaction.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers_admin(admin_token):
    """Authorization headers for admin user."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_technician(technician_token):
    """Authorization headers for technician user."""
    return {"Authorization": f"Bearer {technician_token}"}


@pytest.fixture
def auth_headers_office(office_token):
    """Authorization headers for office user."""
    return {"Authorization": f"Bearer {office_token}"}


@pytest.fixture
def auth_headers_client_user(client_user_token):
    """Authorization headers for portal client user."""
    return {"Authorization": f"Bearer {client_user_token}"}


@pytest.fixture
def auth_headers_client_admin(client_admin_token):
    """Authorization headers for portal client admin."""
    return {"Authorization": f"Bearer {client_admin_token}"}

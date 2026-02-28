"""Debug test for unassigned endpoint."""
import pytest
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.db.base import Base
from app.main import app
from app.db.session import get_db
from fastapi.testclient import TestClient
import os
from uuid import uuid4

def test_unassigned_minimal():
    """Minimal test for unassigned endpoint."""
    # Create test DB
    test_db_url = os.getenv('TEST_DATABASE_URL', 'postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_test')
    engine = create_engine(test_db_url)
    Base.metadata.create_all(bind=engine)

    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    db_session = SessionLocal()

    # Create admin user
    from app.models.users import InternalUser, InternalUserRole
    from app.services.auth_service import AuthService

    admin_id = uuid4()
    admin_user = InternalUser(
        id=admin_id,
        name='Test Admin',
        email='admin@test.com',
        password_hash=AuthService.hash_password('admin123'),
        role=InternalUserRole.ADMIN,
        is_active=True
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    # Create token
    token = AuthService.create_internal_user_token(
        user_id=admin_id,
        email=admin_user.email,
        role=admin_user.role.value,
        name=admin_user.name
    )

    # Override get_db
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Test with TestClient
    with TestClient(app) as client:
        # Test unassigned FIRST
        response2 = client.get(
            "/api/v1/tickets/unassigned",
            headers={'Authorization': f'Bearer {token}'}
        )
        print(f'Unassigned endpoint: {response2.status_code}')
        print(f'Response: {response2.json()}')

        # Then test a working endpoint
        response1 = client.post(
            f"/api/v1/tickets/00000000-0000-0000-0000-000000000001/assign",
            headers={'Authorization': f'Bearer {token}'},
            json={"assigned_to_internal_user_id": str(uuid4())}
        )
        print(f'Assign endpoint (should be 404): {response1.status_code}')

    app.dependency_overrides.clear()
    db_session.close()
    transaction.rollback()
    connection.close()

    assert response2.status_code == 200, f"Expected 200, got {response2.status_code}: {response2.json()}"

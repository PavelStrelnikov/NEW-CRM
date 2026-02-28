"""
Shared pytest fixtures for all tests.
Provides database, user, and authentication fixtures.
"""

import pytest
import os
from typing import Generator
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.db.base import Base


# ========== Test Database Configuration ==========

@pytest.fixture(scope="session")
def test_db_url() -> str:
    """
    Test database URL (separate from dev database).
    Override with TEST_DATABASE_URL environment variable.
    """
    return os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_test"
    )


@pytest.fixture(scope="session")
def test_engine(test_db_url):
    """
    Create test database engine (session scope - reuse across tests).
    Creates all tables at session start, drops at session end.
    """
    engine = create_engine(test_db_url, echo=False, pool_pre_ping=True)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Drop all tables after tests
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """
    Database session with transaction rollback (function scope).
    Each test gets a clean database state.

    Strategy: Use nested transaction pattern for isolation.
    """
    connection = test_engine.connect()
    transaction = connection.begin()

    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ========== Test Users & Authentication ==========

@pytest.fixture
def admin_user(db_session):
    """Create admin user for testing."""
    from app.models.users import InternalUser, InternalUserRole
    from app.services.auth_service import AuthService

    user = InternalUser(
        id=uuid4(),
        name="Test Admin",
        email="admin@test.com",
        password_hash=AuthService.hash_password("admin123"),
        role=InternalUserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def technician_user(db_session):
    """Create technician user for testing."""
    from app.models.users import InternalUser, InternalUserRole
    from app.services.auth_service import AuthService

    user = InternalUser(
        id=uuid4(),
        name="Test Technician",
        email="tech@test.com",
        password_hash=AuthService.hash_password("tech123"),
        role=InternalUserRole.TECHNICIAN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def office_user(db_session):
    """Create office user for testing."""
    from app.models.users import InternalUser, InternalUserRole
    from app.services.auth_service import AuthService

    user = InternalUser(
        id=uuid4(),
        name="Test Office",
        email="office@test.com",
        password_hash=AuthService.hash_password("office123"),
        role=InternalUserRole.OFFICE,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_client_record(db_session):
    """Create test client record."""
    from app.models.clients import Client

    client = Client(
        id=uuid4(),
        name="Test Company Ltd",
        main_address="123 Test St",
        status="active"
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)
    return client


@pytest.fixture
def test_site(db_session, test_client_record):
    """Create test site."""
    from app.models.clients import Site

    site = Site(
        id=uuid4(),
        client_id=test_client_record.id,
        name="Main Office",
        address="123 Test St",
        is_default=True
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    return site


@pytest.fixture
def client_user(db_session, test_client_record):
    """Create portal client user for testing."""
    from app.models.users import ClientUser, ClientUserRole
    from app.services.auth_service import AuthService

    user = ClientUser(
        id=uuid4(),
        client_id=test_client_record.id,
        name="Test Client User",
        email="client@test.com",
        password_hash=AuthService.hash_password("client123"),
        role=ClientUserRole.CLIENT_USER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def client_admin_user(db_session, test_client_record):
    """Create portal client admin for testing."""
    from app.models.users import ClientUser, ClientUserRole
    from app.services.auth_service import AuthService

    user = ClientUser(
        id=uuid4(),
        client_id=test_client_record.id,
        name="Test Client Admin",
        email="clientadmin@test.com",
        password_hash=AuthService.hash_password("admin123"),
        role=ClientUserRole.CLIENT_ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def allowed_site_ids(test_site):
    """List of site IDs for client user access."""
    return [test_site.id]


@pytest.fixture
def client_user_with_site_access(db_session, client_user, test_site):
    """Create client user with site access."""
    from app.models.users import ClientUserSite

    site_access = ClientUserSite(
        id=uuid4(),
        client_user_id=client_user.id,
        site_id=test_site.id
    )
    db_session.add(site_access)
    db_session.commit()
    return client_user


# ========== JWT Tokens ==========

@pytest.fixture
def admin_token(admin_user):
    """Generate JWT token for admin user."""
    from app.services.auth_service import AuthService
    return AuthService.create_internal_user_token(
        user_id=admin_user.id,
        email=admin_user.email,
        role=admin_user.role.value,
        name=admin_user.name
    )


@pytest.fixture
def technician_token(technician_user):
    """Generate JWT token for technician user."""
    from app.services.auth_service import AuthService
    return AuthService.create_internal_user_token(
        user_id=technician_user.id,
        email=technician_user.email,
        role=technician_user.role.value,
        name=technician_user.name
    )


@pytest.fixture
def office_token(office_user):
    """Generate JWT token for office user."""
    from app.services.auth_service import AuthService
    return AuthService.create_internal_user_token(
        user_id=office_user.id,
        email=office_user.email,
        role=office_user.role.value,
        name=office_user.name
    )


@pytest.fixture
def client_user_token(client_user, allowed_site_ids):
    """Generate JWT token for portal client user."""
    from app.services.auth_service import AuthService
    return AuthService.create_portal_user_token(
        user_id=client_user.id,
        email=client_user.email,
        role=client_user.role.value,
        client_id=client_user.client_id,
        allowed_site_ids=[str(sid) for sid in allowed_site_ids]
    )


@pytest.fixture
def client_admin_token(client_admin_user):
    """Generate JWT token for portal client admin."""
    from app.services.auth_service import AuthService
    return AuthService.create_portal_user_token(
        user_id=client_admin_user.id,
        email=client_admin_user.email,
        role=client_admin_user.role.value,
        client_id=client_admin_user.client_id,
        allowed_site_ids=None
    )


# ========== Test Data Factories ==========

@pytest.fixture
def default_ticket_status(db_session):
    """Create default ticket status definition."""
    from app.models.tickets import TicketStatusDefinition

    # Check if default status already exists
    default_status = db_session.query(TicketStatusDefinition).filter_by(is_default=True).first()
    if not default_status:
        default_status = TicketStatusDefinition(
            id=uuid4(),
            code="open",
            name_en="Open",
            name_he="פתוח",
            is_default=True,
            is_active=True,
            is_closed_state=False
        )
        db_session.add(default_status)
        db_session.commit()
        db_session.refresh(default_status)

    return default_status


@pytest.fixture
def ticket_factory(db_session, test_client_record, test_site):
    """Factory function to create tickets."""
    from app.models.tickets import Ticket, TicketStatusDefinition, CreatedByType

    def _create_ticket(**kwargs):
        # Get or create default status
        default_status = db_session.query(TicketStatusDefinition).filter_by(is_default=True).first()
        if not default_status:
            default_status = TicketStatusDefinition(
                id=uuid4(),
                code="open",
                name_en="Open",
                name_he="פתוח",
                is_default=True,
                is_active=True,
                is_closed_state=False
            )
            db_session.add(default_status)
            db_session.commit()

        ticket_data = {
            "id": uuid4(),
            "ticket_number": f"T-{uuid4().hex[:8].upper()}",
            "client_id": test_client_record.id,
            "site_id": test_site.id,
            "title": "Test Ticket",
            "description": "Test description",
            "status_id": default_status.id,
            "contact_phone": "050-1234567",
            "created_by_type": CreatedByType.INTERNAL.value,
            "source_channel": "manual"
        }
        ticket_data.update(kwargs)

        ticket = Ticket(**ticket_data)
        db_session.add(ticket)
        db_session.commit()
        db_session.refresh(ticket)
        return ticket

    return _create_ticket

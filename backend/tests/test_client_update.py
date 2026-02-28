"""
Test client update functionality to verify edit changes persist.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.models.clients import Client
from app.schemas.clients import ClientCreate, ClientUpdate


def test_client_update_persists():
    """Test that client updates are saved to database and persist after refresh."""
    # Create in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # 1. Create a client
        client_data = {
            'name': 'Test Client',
            'tax_id': '123456789',
            'main_phone': '050-1234567',
            'main_email': 'test@example.com',
            'main_address': '123 Test St',
            'status': 'active',
        }
        client = Client(**client_data)
        db.add(client)
        db.commit()
        db.refresh(client)

        client_id = client.id
        assert client.name == 'Test Client'
        assert client.tax_id == '123456789'
        assert client.main_phone == '050-1234567'
        assert client.main_email == 'test@example.com'
        assert client.status == 'active'  # Model uses status, not is_active

        # 2. Update the client (simulating what the API does)
        update_data = {
            'name': 'Updated Client Name',
            'tax_id': '987654321',
            'main_phone': '052-9876543',
            'main_email': 'updated@example.com',
            'main_address': '456 New Address',
            'status': 'inactive',
        }

        for field, value in update_data.items():
            setattr(client, field, value)

        db.commit()
        db.refresh(client)

        # 3. Verify changes persisted
        assert client.name == 'Updated Client Name'
        assert client.tax_id == '987654321'
        assert client.main_phone == '052-9876543'
        assert client.main_email == 'updated@example.com'
        assert client.main_address == '456 New Address'
        assert client.status == 'inactive'

        # 4. Re-fetch from database to confirm persistence (simulating page refresh)
        db.expunge_all()  # Clear session cache
        refetched_client = db.query(Client).filter(Client.id == client_id).first()

        assert refetched_client is not None
        assert refetched_client.name == 'Updated Client Name'
        assert refetched_client.tax_id == '987654321'
        assert refetched_client.main_phone == '052-9876543'
        assert refetched_client.main_email == 'updated@example.com'
        assert refetched_client.main_address == '456 New Address'
        assert refetched_client.status == 'inactive'

        print("✓ All assertions passed - client update persists correctly")

    finally:
        db.close()


if __name__ == '__main__':
    test_client_update_persists()
    print("Test completed successfully!")

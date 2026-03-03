"""
Integration tests for camera API endpoints.

Tests 3 endpoints:
- GET /api/v1/cameras/ - List camera assets
- GET /api/v1/cameras/{asset_id}/info - Camera details with parent NVR
- GET /api/v1/cameras/{asset_id}/snapshot - JPEG snapshot capture

Covers: Authentication, authorization, validation, protocol detection.
"""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.models.assets import (
    Asset, AssetType, AssetPropertyDefinition, AssetPropertyValue,
)
from app.utils.crypto import encrypt_secret


# ==================== Fixtures ====================


@pytest.fixture
def camera_asset_type(db_session):
    """Get or create CAMERA asset type."""
    existing = db_session.query(AssetType).filter(AssetType.code == 'CAMERA').first()
    if existing:
        return existing

    at = AssetType(
        id=uuid4(),
        code='CAMERA',
        name_en='Camera',
        name_he='מצלמה',
        is_active=True,
    )
    db_session.add(at)
    db_session.commit()
    db_session.refresh(at)
    return at


@pytest.fixture
def nvr_asset_type(db_session):
    """Get or create NVR asset type."""
    existing = db_session.query(AssetType).filter(AssetType.code == 'NVR').first()
    if existing:
        return existing

    at = AssetType(
        id=uuid4(),
        code='NVR',
        name_en='NVR',
        name_he='מקליט רשת (NVR)',
        is_active=True,
    )
    db_session.add(at)
    db_session.commit()
    db_session.refresh(at)
    return at


def _create_prop_def(db_session, asset_type_id, key, data_type='string', sort_order=0):
    """Helper to create a property definition."""
    pd = AssetPropertyDefinition(
        id=uuid4(),
        asset_type_id=asset_type_id,
        key=key,
        label_en=key.replace('_', ' ').title(),
        label_he=key,
        data_type=data_type,
        required=False,
        visibility='internal_only',
        sort_order=sort_order,
        is_active=True,
    )
    db_session.add(pd)
    db_session.commit()
    db_session.refresh(pd)
    return pd


def _set_prop_value(db_session, asset_id, prop_def_id, data_type, value):
    """Helper to set a property value."""
    pv = AssetPropertyValue(
        id=uuid4(),
        asset_id=asset_id,
        property_definition_id=prop_def_id,
    )
    if data_type == 'string':
        pv.value_string = value
    elif data_type == 'int':
        pv.value_int = value
    elif data_type == 'secret':
        pv.value_secret_encrypted = encrypt_secret(value)
    db_session.add(pv)
    db_session.commit()
    return pv


@pytest.fixture
def nvr_asset(db_session, test_client_record, test_site, nvr_asset_type):
    """Create NVR asset with credentials for ISAPI testing."""
    asset = Asset(
        id=uuid4(),
        client_id=test_client_record.id,
        site_id=test_site.id,
        asset_type_id=nvr_asset_type.id,
        label='Test NVR-01',
        manufacturer='Hikvision',
        model='DS-7616NI-K2',
        status='active',
    )
    db_session.add(asset)
    db_session.commit()

    # Add NVR credentials
    for key, dtype, value in [
        ('wan_public_ip', 'string', '192.168.1.100'),
        ('wan_http_port', 'int', 80),
        ('device_username', 'string', 'admin'),
        ('device_password', 'secret', 'test_password'),
    ]:
        pd = _create_prop_def(db_session, nvr_asset_type.id, key, dtype)
        _set_prop_value(db_session, asset.id, pd.id, dtype, value)

    db_session.refresh(asset)
    return asset


@pytest.fixture
def camera_asset_isapi(db_session, test_client_record, test_site, camera_asset_type, nvr_asset):
    """Create CAMERA asset with protocol=isapi pointing to NVR."""
    asset = Asset(
        id=uuid4(),
        client_id=test_client_record.id,
        site_id=test_site.id,
        asset_type_id=camera_asset_type.id,
        label='Camera Entrance',
        manufacturer='Hikvision',
        model='DS-2CD2143G2-I',
        status='active',
    )
    db_session.add(asset)
    db_session.commit()

    # Add camera properties
    for key, dtype, value in [
        ('camera_protocol', 'string', 'isapi'),
        ('camera_parent_nvr_id', 'string', str(nvr_asset.id)),
        ('camera_channel_number', 'int', 1),
        ('camera_stream_type', 'string', 'main'),
    ]:
        pd = _create_prop_def(db_session, camera_asset_type.id, key, dtype)
        _set_prop_value(db_session, asset.id, pd.id, dtype, value)

    db_session.refresh(asset)
    return asset


@pytest.fixture
def camera_asset_no_nvr(db_session, test_client_record, test_site, camera_asset_type):
    """Create CAMERA asset with isapi protocol but no parent NVR."""
    asset = Asset(
        id=uuid4(),
        client_id=test_client_record.id,
        site_id=test_site.id,
        asset_type_id=camera_asset_type.id,
        label='Camera Orphan',
        status='active',
    )
    db_session.add(asset)
    db_session.commit()

    pd = _create_prop_def(db_session, camera_asset_type.id, 'camera_protocol', 'string')
    _set_prop_value(db_session, asset.id, pd.id, 'string', 'isapi')

    db_session.refresh(asset)
    return asset


# Minimal valid JPEG for testing
MOCK_JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 200


# ==================== Tests: List Cameras ====================


class TestListCameras:
    """GET /api/v1/cameras/"""

    def test_list_cameras_empty(self, test_client, auth_headers_admin):
        """Returns empty list when no CAMERA assets exist."""
        response = test_client.get("/api/v1/cameras/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_cameras_with_results(
        self, test_client, auth_headers_admin, camera_asset_isapi
    ):
        """Returns camera assets when they exist."""
        response = test_client.get("/api/v1/cameras/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        labels = [item["label"] for item in data["items"]]
        assert "Camera Entrance" in labels

    def test_list_cameras_filter_by_client(
        self, test_client, auth_headers_admin, camera_asset_isapi, test_client_record
    ):
        """Filters by client_id query parameter."""
        response = test_client.get(
            f"/api/v1/cameras/?client_id={test_client_record.id}",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

        # Filter with non-existent client
        response2 = test_client.get(
            f"/api/v1/cameras/?client_id={uuid4()}",
            headers=auth_headers_admin,
        )
        assert response2.status_code == 200
        assert response2.json()["total"] == 0

    def test_list_cameras_filter_by_site(
        self, test_client, auth_headers_admin, camera_asset_isapi, test_site
    ):
        """Filters by site_id query parameter."""
        response = test_client.get(
            f"/api/v1/cameras/?site_id={test_site.id}",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    def test_list_cameras_technician_allowed(
        self, test_client, auth_headers_technician, camera_asset_isapi
    ):
        """Technicians can list cameras."""
        response = test_client.get("/api/v1/cameras/", headers=auth_headers_technician)
        assert response.status_code == 200

    def test_list_cameras_office_forbidden(self, test_client, auth_headers_office):
        """Office users get 403."""
        response = test_client.get("/api/v1/cameras/", headers=auth_headers_office)
        assert response.status_code == 403

    def test_list_cameras_unauthenticated(self, test_client):
        """No auth returns 401."""
        response = test_client.get("/api/v1/cameras/")
        assert response.status_code == 401


# ==================== Tests: Camera Info ====================


class TestCameraInfo:
    """GET /api/v1/cameras/{asset_id}/info"""

    def test_get_camera_info_success(
        self, test_client, auth_headers_admin, camera_asset_isapi, nvr_asset
    ):
        """Returns camera details including parent NVR label."""
        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/info",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["label"] == "Camera Entrance"
        assert data["camera_protocol"] == "isapi"
        assert data["camera_channel_number"] == 1
        assert data["parent_nvr_label"] == "Test NVR-01"

    def test_get_camera_info_not_found(self, test_client, auth_headers_admin):
        """Returns 404 for non-existent asset."""
        response = test_client.get(
            f"/api/v1/cameras/{uuid4()}/info",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    def test_get_camera_info_wrong_type(
        self, test_client, auth_headers_admin, nvr_asset
    ):
        """Returns 400 when asset is not CAMERA type."""
        response = test_client.get(
            f"/api/v1/cameras/{nvr_asset.id}/info",
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    def test_get_camera_info_office_forbidden(
        self, test_client, auth_headers_office, camera_asset_isapi
    ):
        """Office users get 403."""
        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/info",
            headers=auth_headers_office,
        )
        assert response.status_code == 403


# ==================== Tests: Camera Snapshot ====================


class TestCameraSnapshot:
    """GET /api/v1/cameras/{asset_id}/snapshot"""

    @patch('app.services.camera_service.isapi_get_snapshot', new_callable=AsyncMock)
    def test_snapshot_isapi_success(
        self, mock_snapshot, test_client, auth_headers_admin, camera_asset_isapi
    ):
        """Mocks isapi_get_snapshot to return JPEG, verifies response."""
        mock_snapshot.return_value = MOCK_JPEG

        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/snapshot",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.content == MOCK_JPEG
        mock_snapshot.assert_called_once()

    def test_snapshot_not_found(self, test_client, auth_headers_admin):
        """Returns 404 for non-existent camera."""
        response = test_client.get(
            f"/api/v1/cameras/{uuid4()}/snapshot",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    def test_snapshot_no_parent_nvr(
        self, test_client, auth_headers_admin, camera_asset_no_nvr
    ):
        """Returns 400 when ISAPI camera has no parent NVR configured."""
        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_no_nvr.id}/snapshot",
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @patch('app.services.camera_service.isapi_get_snapshot', new_callable=AsyncMock)
    def test_snapshot_device_timeout(
        self, mock_snapshot, test_client, auth_headers_admin, camera_asset_isapi
    ):
        """Returns 503 when device times out."""
        from app.integrations.hikvision.isapi_client import IsapiError
        mock_snapshot.side_effect = IsapiError("Connection timed out", status_code=None)

        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/snapshot",
            headers=auth_headers_admin,
        )
        assert response.status_code == 503

    def test_snapshot_office_forbidden(
        self, test_client, auth_headers_office, camera_asset_isapi
    ):
        """Office users get 403."""
        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/snapshot",
            headers=auth_headers_office,
        )
        assert response.status_code == 403

    def test_snapshot_technician_allowed(
        self, test_client, auth_headers_technician, camera_asset_isapi
    ):
        """Technicians can get snapshots."""
        # Will fail because no actual device, but should not be 403
        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/snapshot",
            headers=auth_headers_technician,
        )
        # Not 403 (could be 400/502/503 since no actual device)
        assert response.status_code != 403

    def test_snapshot_unauthenticated(self, test_client, camera_asset_isapi):
        """No auth returns 401."""
        response = test_client.get(
            f"/api/v1/cameras/{camera_asset_isapi.id}/snapshot"
        )
        assert response.status_code == 401

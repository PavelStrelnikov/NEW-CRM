"""
API endpoints for Hikvision device integration.
Uses hik_monitor_lib for hybrid SDK + ISAPI probing.
"""
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.auth.dependencies import require_internal_user
from app.schemas.auth import CurrentUser
from app.schemas.hikvision import (
    HikvisionProbeRequest,
    HikvisionProbeResponse,
    ISAPICredentials,
    TimeCheckResponse,
    TimeSyncResponse,
)
from app.integrations.hikvision.hybrid_probe import (
    get_sdk_path,
)
from app.integrations.hikvision.isapi_client import (
    get_snapshot as isapi_get_snapshot,
    sync_time as isapi_sync_time,
    IsapiError,
)
from app.services.hikvision_service import (
    get_asset_credentials,
    probe_device_impl,
    probe_and_save_asset as service_probe_and_save,
)
from app.models.assets import Asset
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/hikvision", tags=["hikvision"])

# Asset types that support Hikvision operations
NVR_DVR_TYPES = {"NVR", "DVR"}


def _require_nvr_dvr(db: Session, asset_id: UUID) -> None:
    """Verify asset exists and is NVR/DVR type. Raises HTTPException otherwise."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.asset_type or asset.asset_type.code not in NVR_DVR_TYPES:
        raise HTTPException(status_code=400, detail="This operation is only available for NVR/DVR assets")


@router.post("/probe", response_model=HikvisionProbeResponse)
async def probe_device(
    probe_data: HikvisionProbeRequest,
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    API endpoint: Probe a Hikvision device with explicit credentials.
    Used by AssetForm during creation/editing.
    """
    return await probe_device_impl(probe_data, current_user)


@router.post("/assets/{asset_id}/probe", response_model=HikvisionProbeResponse)
async def probe_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    Probe a Hikvision device using credentials stored in an asset.
    Does NOT save the probe results - use probe-and-save for that.

    The asset must have the following properties:
    - wan_public_ip (string) - WAN IP address
    - wan_service_port (integer, defaults to 8000) - Service Port for SDK
    - device_username (string) - Device username
    - device_password (secret) - Device password
    """
    _require_nvr_dvr(db, asset_id)

    try:
        creds = get_asset_credentials(db, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 400, detail=str(e))

    # Create a probe request and call the main endpoint
    probe_request = HikvisionProbeRequest(
        host=creds.host,
        port=creds.port,
        username=creds.username,
        password=creds.password,
    )

    return await probe_device_impl(probe_request, current_user)


@router.post("/assets/{asset_id}/probe-and-save", response_model=HikvisionProbeResponse)
async def probe_and_save_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    Probe a Hikvision device and automatically save the results to the database.

    This endpoint is designed for the "Refresh Status" button on the asset details page.
    It probes the device, then updates:
    - Asset properties (model, serial_number, camera_count, LAN IP)
    - NVR disks (S.M.A.R.T. data: status, working_hours, temperature, smart_status)

    Returns the same probe response as /probe endpoint.
    """
    _require_nvr_dvr(db, asset_id)

    return await service_probe_and_save(db, asset_id, current_user)


@router.get("/assets/{asset_id}/isapi-credentials", response_model=ISAPICredentials)
async def get_isapi_credentials(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    Get ISAPI connection credentials for direct device access from browser.

    Returns the device's IP, HTTP port, username, and password so that
    the frontend can make direct ISAPI requests without going through
    the backend SDK (which may fail if SDK is not available).

    Args:
        asset_id: UUID of the Hikvision device

    Returns:
        ISAPICredentials with connection details
    """
    logger.info(f"[isapi-credentials] Getting credentials for asset_id={asset_id}")

    _require_nvr_dvr(db, asset_id)

    try:
        creds = get_asset_credentials(db, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 400, detail=str(e))

    logger.debug(f"[isapi-credentials] Credentials requested for host={creds.host}, port={creds.web_port}")

    return ISAPICredentials(
        host=creds.host,
        web_port=creds.web_port,
        username=creds.username,
        password=creds.password,
        protocol="http"
    )


@router.get("/assets/{asset_id}/channels/{channel}/snapshot")
async def get_channel_snapshot(
    asset_id: UUID,
    channel: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    Get a JPEG snapshot from a specific camera channel via Hikvision SDK.

    Uses the SDK connection pool (port 8000) to capture a JPEG frame.
    Falls back to ISAPI HTTP if SDK fails.

    Args:
        asset_id: UUID of the NVR/DVR asset
        channel: Channel display number (1-16 for D1-D16)

    Returns:
        JPEG image as binary response with Content-Type: image/jpeg
    """
    from fastapi.responses import Response
    from app.integrations.hik_monitor_lib.connection_pool import get_connection_pool

    logger.info(f"[snapshot] Getting SDK snapshot for asset_id={asset_id}, channel={channel}")

    _require_nvr_dvr(db, asset_id)

    # Validate channel number
    if channel < 1 or channel > 64:
        raise HTTPException(status_code=400, detail="Channel number must be between 1 and 64")

    try:
        creds = get_asset_credentials(db, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 400, detail=str(e))

    pool = get_connection_pool()
    sdk_path = get_sdk_path()
    pool_key = (str(asset_id), creds.host, creds.port)

    try:
        manager, is_new = await pool.get_connection(
            str(asset_id), creds.host, creds.port,
            creds.username, creds.password, sdk_path
        )
        logger.info(f"[snapshot] SDK connection acquired (new={is_new})")

        success, jpeg_data, error_msg = await manager.get_snapshot(channel)

        if not success or not jpeg_data:
            logger.warning(f"[snapshot] SDK capture failed: {error_msg}, trying ISAPI fallback")
            # Fallback to ISAPI
            try:
                jpeg_data = await isapi_get_snapshot(
                    creds.host, creds.web_port, creds.username, creds.password, channel
                )
            except IsapiError as ie:
                raise HTTPException(
                    status_code=502,
                    detail=f"SDK: {error_msg}; ISAPI fallback: {ie}"
                )

        return Response(
            content=jpeg_data,
            media_type="image/jpeg",
            headers={
                "Content-Disposition": f"inline; filename=snapshot_D{channel}.jpg",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[snapshot] Snapshot capture failed: {e}")
        raise HTTPException(status_code=502, detail=f"Snapshot capture failed: {e}")
    finally:
        pool.release_connection(*pool_key)


# ==================== Endpoints для синхронизации времени ====================

@router.get("/assets/{asset_id}/time", response_model=TimeCheckResponse)
async def check_device_time(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    Проверить время на устройстве (отдельный вызов без полного probe).

    Возвращает:
    - device_time: время на устройстве
    - server_time: время сервера
    - drift_seconds: разница в секундах
    - is_synced: True если разница < 60 сек
    - status: ok/drift/error
    """
    logger.info(f"[time-check] Checking time for asset_id={asset_id}")

    _require_nvr_dvr(db, asset_id)

    try:
        creds = get_asset_credentials(db, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 400, detail=str(e))

    # Подключаемся к устройству для получения времени
    manager = None
    try:
        from app.integrations.hik_monitor_lib import HikvisionManager

        sdk_path = get_sdk_path()
        manager = HikvisionManager(sdk_path=sdk_path)

        await manager.connect(creds.host, creds.port, creds.username, creds.password)

        # Получаем время с устройства
        time_info = await manager.get_time_info()

        if time_info:
            server_time = datetime.utcnow()
            device_time_str = time_info.device_time if hasattr(time_info, 'device_time') else str(time_info)
            drift = time_info.drift_seconds if hasattr(time_info, 'drift_seconds') else 0

            is_synced = abs(drift) < 60
            status = "ok" if is_synced else "drift"

            return TimeCheckResponse(
                device_time=device_time_str,
                server_time=server_time.isoformat(),
                drift_seconds=drift,
                is_synced=is_synced,
                status=status
            )
        else:
            return TimeCheckResponse(
                device_time="unknown",
                server_time=datetime.utcnow().isoformat(),
                drift_seconds=0,
                is_synced=False,
                status="error"
            )

    except Exception as e:
        logger.error(f"[time-check] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check device time: {str(e)}")
    finally:
        if manager:
            try:
                await manager.disconnect()
                manager.cleanup()
            except Exception as e:
                logger.warning(f"Cleanup error: {e}")


@router.post("/assets/{asset_id}/time/sync", response_model=TimeSyncResponse)
async def sync_device_time(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_internal_user),
):
    """
    Синхронизировать время на устройстве с серверным временем.

    Использует ISAPI для установки времени на NVR.
    """
    from app.models.assets import AssetEvent

    logger.info(f"[time-sync] Syncing time for asset_id={asset_id}")

    _require_nvr_dvr(db, asset_id)

    try:
        creds = get_asset_credentials(db, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 400, detail=str(e))

    # Пробуем синхронизировать через SDK или ISAPI
    manager = None
    try:
        from app.integrations.hik_monitor_lib import HikvisionManager

        sdk_path = get_sdk_path()
        manager = HikvisionManager(sdk_path=sdk_path)

        await manager.connect(creds.host, creds.port, creds.username, creds.password)

        # Получаем время ДО синхронизации
        time_before = await manager.get_time_info()
        drift_before = time_before.drift_seconds if time_before and hasattr(time_before, 'drift_seconds') else None
        # device_time может быть datetime объектом - конвертируем в ISO строку
        raw_time_before = time_before.device_time if time_before and hasattr(time_before, 'device_time') else None
        device_time_before = raw_time_before.isoformat() if hasattr(raw_time_before, 'isoformat') else str(raw_time_before) if raw_time_before else None

        logger.info(f"[time-sync] Time BEFORE sync: device={device_time_before}, drift={drift_before}s")

        # Устанавливаем время через SDK (метод set_time использует ISAPI через SDK сессию)
        # Передаём локальное время сервера (без UTC, т.к. NVR работает с локальным временем)
        sync_success = False
        try:
            # manager.set_time() использует текущее время сервера если не указано иное
            sync_success = await manager.set_time()
            logger.info(f"[time-sync] SDK set_time() returned: {sync_success}")
        except Exception as e:
            logger.error(f"[time-sync] SDK set_time() exception: {e}")
            sync_success = False

        # Если SDK не сработал (вернул False или выбросил исключение) - пробуем HTTP ISAPI
        if not sync_success:
            logger.info(f"[time-sync] SDK failed, trying ISAPI fallback via HTTP...")
            sync_success = await isapi_sync_time(creds.host, creds.web_port, creds.username, creds.password)
            logger.info(f"[time-sync] ISAPI fallback returned: {sync_success}")

        if sync_success:
            # Проверяем время ПОСЛЕ синхронизации
            await asyncio.sleep(2)  # Даём устройству время обновить внутренние часы
            time_after = await manager.get_time_info()
            drift_after = time_after.drift_seconds if time_after and hasattr(time_after, 'drift_seconds') else None
            # device_time может быть datetime объектом - конвертируем в ISO строку
            raw_time_after = time_after.device_time if time_after and hasattr(time_after, 'device_time') else None
            device_time_after = raw_time_after.isoformat() if hasattr(raw_time_after, 'isoformat') else str(raw_time_after) if raw_time_after else None

            logger.info(f"[time-sync] Time AFTER sync: device={device_time_after}, drift={drift_after}s")
            logger.info(f"[time-sync] Drift change: {drift_before}s -> {drift_after}s")

            # Проверяем реально ли изменилось время
            if drift_after is not None and drift_before is not None:
                if abs(drift_after) >= abs(drift_before) - 5:
                    # Время не изменилось существенно - это подозрительно
                    logger.warning(f"[time-sync] WARNING: Drift did not improve! Before={drift_before}s, After={drift_after}s")

            # Создаём audit event
            event = AssetEvent(
                asset_id=asset_id,
                event_type="time_synced",
                details=f"Device time synchronized by {current_user.name}. Drift before: {drift_before}s, after: {drift_after}s",
                actor_type=current_user.user_type,
                actor_id=current_user.id,
                actor_display=current_user.name
            )
            db.add(event)
            db.commit()

            return TimeSyncResponse(
                success=True,
                message=f"Time synchronized. Drift: {drift_before}s -> {drift_after}s",
                device_time_before=device_time_before,
                device_time_after=device_time_after,
                drift_before=drift_before,
                drift_after=drift_after
            )
        else:
            logger.error(f"[time-sync] FAILED - set_time returned False")
            return TimeSyncResponse(
                success=False,
                message="Failed to sync time - device rejected the request or method not supported",
                device_time_before=device_time_before,
                drift_before=drift_before
            )

    except Exception as e:
        logger.error(f"[time-sync] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync device time: {str(e)}")
    finally:
        if manager:
            try:
                await manager.disconnect()
                manager.cleanup()
            except Exception as e:
                logger.warning(f"Cleanup error: {e}")



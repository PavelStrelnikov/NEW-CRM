"""
ISAPI HTTP client for Hikvision devices.

Handles all direct HTTP communication with Hikvision ISAPI endpoints:
- Snapshot capture (JPEG)
- Time synchronization (XML GET/PUT)

Dependencies: httpx, re, logging only. No ORM or DB imports.
"""
import re
import logging
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)


class IsapiError(Exception):
    """Error during ISAPI HTTP communication."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


async def get_snapshot(host: str, web_port: int, username: str, password: str, channel: int) -> bytes:
    """
    Capture a JPEG snapshot from a camera channel via ISAPI.

    ISAPI endpoint: /ISAPI/Streaming/channels/{channel}01/picture
    Uses Digest auth (Hikvision default), falls back to Basic auth.

    Args:
        host: Device IP address or hostname
        web_port: HTTP port (usually 80 or 81)
        username: Device username
        password: Device password
        channel: Channel display number (1-16 for D1-D16)

    Returns:
        JPEG image bytes

    Raises:
        IsapiError: On connection, auth, or invalid response errors
    """
    # ISAPI channel format: channel 1 = 101, channel 2 = 201, etc.
    isapi_channel = channel * 100 + 1
    isapi_url = f"http://{host}:{web_port}/ISAPI/Streaming/channels/{isapi_channel}/picture"

    logger.info(f"[snapshot] Fetching from ISAPI: {isapi_url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try digest auth first (Hikvision default), fall back to basic
            auth = httpx.DigestAuth(username, password)
            response = await client.get(isapi_url, auth=auth)

            if response.status_code == 401:
                # Fallback to basic auth
                logger.info("[snapshot] Digest auth failed, trying basic auth")
                auth = httpx.BasicAuth(username, password)
                response = await client.get(isapi_url, auth=auth)

            if response.status_code != 200:
                logger.error(f"[snapshot] ISAPI request failed: HTTP {response.status_code}")
                raise IsapiError(
                    f"Device returned HTTP {response.status_code}: {response.text[:200]}",
                    status_code=response.status_code,
                )

            jpeg_data = response.content

            if not jpeg_data or len(jpeg_data) < 100:
                raise IsapiError("No image data received from device")

            # Verify it's a JPEG (starts with FFD8)
            if jpeg_data[:2] != b'\xff\xd8':
                logger.error(f"[snapshot] Invalid JPEG data received, first bytes: {jpeg_data[:20].hex()}")
                raise IsapiError("Invalid image data received from device")

            logger.info(f"[snapshot] Successfully captured ISAPI snapshot, size={len(jpeg_data)} bytes")
            return jpeg_data

    except httpx.TimeoutException:
        logger.error("[snapshot] ISAPI request timed out")
        raise IsapiError("Device connection timed out")
    except httpx.ConnectError as e:
        logger.error(f"[snapshot] ISAPI connection failed: {e}")
        raise IsapiError(f"Failed to connect to device: {e}")
    except IsapiError:
        raise
    except Exception as e:
        logger.exception(f"[snapshot] ISAPI snapshot capture failed: {e}")
        raise IsapiError(f"Snapshot capture failed: {str(e)}")


async def sync_time(host: str, web_port: int, username: str, password: str) -> bool:
    """
    Synchronize device time via ISAPI HTTP PUT with Digest auth.

    Strategy:
    1. GET /ISAPI/System/time - get current time XML from device
    2. Update timeMode and localTime fields
    3. PUT /ISAPI/System/time - send updated XML

    Hikvision uses Digest Auth, not Basic Auth!

    Args:
        host: Device IP address or hostname
        web_port: HTTP port (usually 80 or 81)
        username: Device username
        password: Device password

    Returns:
        True if time was synced successfully, False otherwise
    """
    url = f"http://{host}:{web_port}/ISAPI/System/time"

    # Use LOCAL server time (NVR works with local time)
    now = datetime.now()
    time_str = now.strftime('%Y-%m-%dT%H:%M:%S')

    logger.info(f"[time-sync] ISAPI sync started for {host}:{web_port}")
    logger.info(f"[time-sync] Target time: {time_str}")

    try:
        auth = httpx.DigestAuth(username, password)

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: GET current time configuration
            logger.info(f"[time-sync] ISAPI GET {url}")
            get_response = await client.get(url, auth=auth)

            logger.info(f"[time-sync] GET response: status={get_response.status_code}")

            if get_response.status_code == 401:
                logger.error(f"[time-sync] ISAPI auth failed (401 Unauthorized)")
                return False

            if get_response.status_code != 200:
                logger.warning(f"[time-sync] GET failed with status {get_response.status_code}, trying direct PUT")
                # Fallback: try PUT without GET
                time_xml = _build_time_xml_minimal(time_str)
            else:
                current_xml = get_response.text
                logger.info(f"[time-sync] Current device time XML:\n{current_xml[:500]}")

                # Step 2: Modify XML - update timeMode and localTime
                time_xml = _update_time_xml(current_xml, time_str)

            logger.info(f"[time-sync] ISAPI PUT {url}")
            logger.info(f"[time-sync] PUT body:\n{time_xml}")

            # Step 3: PUT updated XML
            put_response = await client.put(
                url,
                content=time_xml,
                auth=auth,
                headers={"Content-Type": "application/xml"}
            )

            response_text = put_response.text
            logger.info(f"[time-sync] PUT response: status={put_response.status_code}, body_length={len(response_text)}")
            logger.info(f"[time-sync] PUT response body: {response_text[:1000] if response_text else '(empty)'}")

            if put_response.status_code == 200:
                # Hikvision may return:
                # 1. Empty response (success)
                # 2. XML with <statusCode>1</statusCode> (success)
                # 3. XML with <statusCode>X</statusCode> where X != 1 (error)
                # 4. XML with <statusString>OK</statusString> (success)
                if not response_text or len(response_text.strip()) == 0:
                    logger.info(f"[time-sync] ISAPI time sync SUCCESSFUL (empty response = OK)")
                    return True
                elif "<statusCode>1</statusCode>" in response_text or "<statusString>OK</statusString>" in response_text:
                    logger.info(f"[time-sync] ISAPI time sync SUCCESSFUL (explicit OK)")
                    return True
                elif "<statusCode>" in response_text:
                    logger.warning(f"[time-sync] ISAPI returned error status in response")
                    return False
                else:
                    logger.info(f"[time-sync] ISAPI time sync SUCCESSFUL (200 with content)")
                    return True
            elif put_response.status_code == 401:
                logger.error(f"[time-sync] ISAPI auth failed (401 Unauthorized)")
                return False
            else:
                logger.warning(f"[time-sync] PUT returned {put_response.status_code}: {response_text}")
                return False

    except httpx.ConnectError as e:
        logger.error(f"[time-sync] ISAPI connection failed: {e}")
        return False
    except httpx.TimeoutException as e:
        logger.error(f"[time-sync] ISAPI timeout: {e}")
        return False
    except Exception as e:
        logger.error(f"[time-sync] ISAPI request failed: {type(e).__name__}: {e}")
        return False


def _build_time_xml_minimal(time_str: str) -> str:
    """Build minimal XML for setting device time."""
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<timeMode>manual</timeMode>
<localTime>{time_str}</localTime>
</Time>'''


def _update_time_xml(current_xml: str, new_time_str: str) -> str:
    """
    Update existing device time XML.

    Preserves XML structure but updates:
    - timeMode -> manual
    - localTime -> new time
    """
    # Update timeMode to manual
    if "<timeMode>" in current_xml:
        updated = re.sub(r'<timeMode>[^<]*</timeMode>', '<timeMode>manual</timeMode>', current_xml)
    else:
        # Add timeMode after opening Time tag
        updated = re.sub(r'(<Time[^>]*>)', r'\1\n<timeMode>manual</timeMode>', current_xml)

    # Update localTime
    if "<localTime>" in updated:
        updated = re.sub(r'<localTime>[^<]*</localTime>', f'<localTime>{new_time_str}</localTime>', updated)
    else:
        # Add localTime after timeMode
        updated = re.sub(r'(</timeMode>)', f'\\1\n<localTime>{new_time_str}</localTime>', updated)

    return updated

"""
WebSocket-based video streaming for Hikvision devices.
Uses SDK port 8000 instead of RTSP port 554.

This module provides real-time video streaming via WebSocket by capturing
JPEG frames through the Hikvision SDK and transmitting them to the browser.
"""
import asyncio
import base64
import logging
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth.service import auth_service
from app.models.assets import Asset, AssetPropertyValue, AssetPropertyDefinition
from app.integrations.hikvision.hybrid_probe import get_sdk_path
from app.integrations.hik_monitor_lib.connection_pool import get_connection_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hikvision/ws", tags=["hikvision-websocket"])


class VideoStreamSession:
    """
    Manages a single video streaming session over WebSocket.

    Captures JPEG frames via SDK and sends them to client as base64-encoded JSON.
    Supports dynamic FPS adjustment and graceful shutdown.
    """

    def __init__(
        self,
        websocket: WebSocket,
        asset_id: str,
        channel: int,
        fps: int = 5
    ):
        self.websocket = websocket
        self.asset_id = asset_id
        self.channel = channel
        self.fps = min(max(fps, 1), 15)  # Clamp 1-15 FPS
        self.frame_interval = 1.0 / self.fps
        self.running = False
        self.frame_count = 0
        self.error_count = 0

    async def stream_frames(
        self,
        host: str,
        port: int,
        username: str,
        password: str
    ):
        """
        Main streaming loop - captures and sends JPEG frames.

        Uses connection pooling to reuse SDK connections for efficiency.
        Sends frames as base64-encoded JSON messages.
        """
        pool = get_connection_pool()
        sdk_path = get_sdk_path()
        manager = None
        pool_key_tuple = (self.asset_id, host, port)

        try:
            # Get connection from pool
            logger.info(f"[ws-stream] Getting connection for {host}:{port}")
            manager, is_new = await pool.get_connection(
                self.asset_id, host, port, username, password, sdk_path
            )
            logger.info(f"[ws-stream] Connection acquired (new={is_new})")

            self.running = True
            self.error_count = 0
            max_errors = 5

            # Send stream started message
            await self.websocket.send_json({
                "type": "stream_started",
                "channel": self.channel,
                "fps": self.fps
            })

            while self.running:
                try:
                    start_time = asyncio.get_event_loop().time()

                    # Capture JPEG frame
                    success, jpeg_data, error_msg = await manager.get_snapshot(self.channel)

                    if success and jpeg_data:
                        self.frame_count += 1
                        self.error_count = 0

                        # Send frame as base64
                        await self.websocket.send_json({
                            "type": "frame",
                            "channel": self.channel,
                            "frame_num": self.frame_count,
                            "data": base64.b64encode(jpeg_data).decode('ascii'),
                            "size": len(jpeg_data)
                        })

                        if self.frame_count % 50 == 0:
                            logger.debug(f"[ws-stream] Sent {self.frame_count} frames")
                    else:
                        self.error_count += 1
                        logger.warning(f"[ws-stream] Frame capture failed: {error_msg}")

                        if self.error_count >= max_errors:
                            await self.websocket.send_json({
                                "type": "error",
                                "message": f"Too many capture errors: {error_msg}"
                            })
                            break

                    # Maintain target FPS
                    elapsed = asyncio.get_event_loop().time() - start_time
                    sleep_time = max(0, self.frame_interval - elapsed)
                    if sleep_time > 0:
                        await asyncio.sleep(sleep_time)

                except asyncio.CancelledError:
                    logger.info(f"[ws-stream] Stream cancelled for channel {self.channel}")
                    break

        except Exception as e:
            logger.exception(f"[ws-stream] Stream error: {e}")
            try:
                await self.websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
            except:
                pass
        finally:
            self.running = False
            if manager:
                pool.release_connection(*pool_key_tuple)

            logger.info(f"[ws-stream] Stream ended: {self.frame_count} frames sent")

    def stop(self):
        """Stop the streaming session."""
        self.running = False

    def set_fps(self, new_fps: int):
        """Update the target FPS."""
        self.fps = min(max(new_fps, 1), 15)
        self.frame_interval = 1.0 / self.fps


@router.websocket("/assets/{asset_id}/channels/{channel}/stream")
async def websocket_video_stream(
    websocket: WebSocket,
    asset_id: str,
    channel: int,
    token: str = Query(...),
    fps: int = Query(default=5, ge=1, le=15),
):
    """
    WebSocket endpoint for live video streaming via SDK port 8000.

    This replaces RTSP-based streaming (port 554) which is often blocked
    on customer sites. Uses the SDK to capture JPEG frames and streams
    them over WebSocket.

    Protocol:
    - Server sends:
      - {"type": "stream_started", "channel": 1, "fps": 5}
      - {"type": "frame", "channel": 1, "frame_num": 1, "data": "<base64>", "size": 12345}
      - {"type": "fps_changed", "fps": 10}
      - {"type": "error", "message": "..."}
      - {"type": "stream_stopped"}
      - {"type": "ping"} (keepalive)

    - Client can send:
      - {"type": "stop"} - gracefully stop stream
      - {"type": "set_fps", "fps": 10} - change frame rate
      - {"type": "pong"} - response to ping (optional)

    Args:
        asset_id: UUID of the NVR/DVR asset
        channel: Channel display number (1-64)
        token: JWT token for authentication
        fps: Target frames per second (1-15, default 5)
    """
    # Get database session
    db: Session = next(get_db())

    try:
        # Authenticate via token
        current_user = auth_service.get_current_user(db, token)
        if not current_user:
            await websocket.close(code=4001, reason="Invalid or expired token")
            return
        if current_user.user_type != "internal":
            await websocket.close(code=4003, reason="Access denied: Internal users only")
            return

        # Validate channel
        if channel < 1 or channel > 64:
            await websocket.close(code=4002, reason="Invalid channel number (1-64)")
            return

        # Parse asset ID
        try:
            asset_uuid = UUID(asset_id)
        except ValueError:
            await websocket.close(code=4004, reason="Invalid asset ID format")
            return

        # Get asset
        asset = db.query(Asset).filter(Asset.id == asset_uuid).first()
        if not asset:
            await websocket.close(code=4005, reason="Asset not found")
            return

        # Get asset properties for connection
        props_query = (
            db.query(AssetPropertyDefinition.key, AssetPropertyValue)
            .join(AssetPropertyValue, AssetPropertyValue.property_definition_id == AssetPropertyDefinition.id)
            .filter(AssetPropertyValue.asset_id == asset_uuid)
        )
        props = {row[0]: row[1] for row in props_query.all()}

        # Extract connection details
        ip_prop = props.get("wan_public_ip") or props.get("ip_address")
        port_prop = props.get("wan_service_port") or props.get("port")
        username_prop = props.get("device_username") or props.get("admin_username")
        password_prop = props.get("device_password") or props.get("admin_password")

        if not ip_prop or not ip_prop.value_string:
            await websocket.close(code=4006, reason="Asset missing wan_public_ip")
            return
        if not username_prop or not username_prop.value_string:
            await websocket.close(code=4007, reason="Asset missing device_username")
            return
        if not password_prop or not password_prop.value_secret_encrypted:
            await websocket.close(code=4008, reason="Asset missing device_password")
            return

        host = ip_prop.value_string
        port = port_prop.value_int if port_prop and port_prop.value_int else 8000
        username = username_prop.value_string
        password = password_prop.value_secret_encrypted

        logger.info(f"[ws-stream] Accepting WebSocket for asset={asset_id}, channel={channel}, fps={fps}")

        # Accept WebSocket connection
        await websocket.accept()

        # Create streaming session
        session = VideoStreamSession(websocket, asset_id, channel, fps)

        # Start streaming in background task
        stream_task = asyncio.create_task(
            session.stream_frames(host, port, username, password)
        )

        try:
            # Handle incoming messages from client
            while session.running:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive_json(),
                        timeout=30.0
                    )

                    msg_type = data.get("type")

                    if msg_type == "stop":
                        logger.info(f"[ws-stream] Client requested stop")
                        session.stop()
                        break

                    elif msg_type == "set_fps":
                        new_fps = data.get("fps", 5)
                        session.set_fps(new_fps)
                        await websocket.send_json({
                            "type": "fps_changed",
                            "fps": session.fps
                        })
                        logger.info(f"[ws-stream] FPS changed to {session.fps}")

                    elif msg_type == "pong":
                        # Client responding to ping, ignore
                        pass

                except asyncio.TimeoutError:
                    # Send keepalive ping
                    try:
                        await websocket.send_json({"type": "ping"})
                    except:
                        break

        except WebSocketDisconnect:
            logger.info(f"[ws-stream] WebSocket disconnected for asset {asset_id} channel {channel}")
        except Exception as e:
            logger.exception(f"[ws-stream] WebSocket error: {e}")
        finally:
            session.stop()
            stream_task.cancel()
            try:
                await stream_task
            except asyncio.CancelledError:
                pass

            try:
                await websocket.send_json({"type": "stream_stopped"})
            except:
                pass

    finally:
        db.close()


@router.get("/pool-stats")
async def get_pool_stats():
    """
    Get connection pool statistics for debugging.

    Returns information about active connections, usage counts, and idle times.
    """
    pool = get_connection_pool()
    return pool.get_stats()

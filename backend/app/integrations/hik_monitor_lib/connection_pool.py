"""
Hikvision SDK Connection Pool Manager
=====================================
Maintains persistent connections to NVR devices for efficient streaming.
Eliminates per-frame connection overhead for live video.
"""

import asyncio
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from threading import Lock

from .core import HikvisionManager

logger = logging.getLogger(__name__)


@dataclass
class PooledConnection:
    """A pooled SDK connection with metadata."""
    manager: HikvisionManager
    asset_id: str
    host: str
    port: int
    created_at: datetime = field(default_factory=datetime.now)
    last_used: datetime = field(default_factory=datetime.now)
    use_count: int = 0
    in_use: bool = False


class HikvisionConnectionPool:
    """
    Connection pool for Hikvision SDK connections.

    Features:
    - Maintains persistent connections per device
    - Automatic connection cleanup after idle_timeout
    - Thread-safe connection acquisition/release
    - Max connection age to prevent stale connections

    Usage:
        pool = get_connection_pool()
        manager, is_new = await pool.get_connection(asset_id, host, port, user, pass, sdk_path)
        try:
            # Use manager for operations
            success, jpeg, error = await manager.get_snapshot(channel)
        finally:
            pool.release_connection(asset_id, host, port)
    """

    def __init__(
        self,
        idle_timeout_seconds: int = 300,
        max_connection_age_seconds: int = 1800
    ):
        """
        Initialize the connection pool.

        Args:
            idle_timeout_seconds: Close connections idle longer than this (default 5 min)
            max_connection_age_seconds: Maximum connection age before forced refresh (default 30 min)
        """
        self._pool: Dict[str, PooledConnection] = {}
        self._lock = Lock()
        self._idle_timeout = timedelta(seconds=idle_timeout_seconds)
        self._max_age = timedelta(seconds=max_connection_age_seconds)
        self._cleanup_task: Optional[asyncio.Task] = None

    def _make_pool_key(self, asset_id: str, host: str, port: int) -> str:
        """Generate unique pool key for a connection."""
        return f"{asset_id}:{host}:{port}"

    async def get_connection(
        self,
        asset_id: str,
        host: str,
        port: int,
        username: str,
        password: str,
        sdk_path: str
    ) -> Tuple[HikvisionManager, bool]:
        """
        Get a connection from the pool or create a new one.

        Args:
            asset_id: Asset ID for tracking
            host: Device IP/hostname
            port: SDK port (usually 8000)
            username: Device username
            password: Device password
            sdk_path: Path to SDK libraries

        Returns:
            Tuple of (HikvisionManager, is_new_connection)
        """
        pool_key = self._make_pool_key(asset_id, host, port)

        with self._lock:
            # Check for existing available connection
            if pool_key in self._pool:
                conn = self._pool[pool_key]
                if not conn.in_use and conn.manager.is_connected():
                    # Check if connection is too old
                    if datetime.now() - conn.created_at < self._max_age:
                        conn.in_use = True
                        conn.last_used = datetime.now()
                        conn.use_count += 1
                        logger.debug(f"Reusing pooled connection for {pool_key} (use #{conn.use_count})")
                        return (conn.manager, False)
                    else:
                        # Connection too old, close it
                        logger.info(f"Connection {pool_key} exceeded max age, creating new")
                        self._close_connection_sync(conn)
                        del self._pool[pool_key]

        # Create new connection outside the lock
        logger.info(f"Creating new pooled connection for {pool_key}")
        manager = HikvisionManager(sdk_path=sdk_path)
        await manager.connect(host, port, username, password)

        with self._lock:
            # Store in pool
            self._pool[pool_key] = PooledConnection(
                manager=manager,
                asset_id=asset_id,
                host=host,
                port=port,
                created_at=datetime.now(),
                last_used=datetime.now(),
                use_count=1,
                in_use=True
            )

        return (manager, True)

    def release_connection(self, asset_id: str, host: str, port: int):
        """
        Release a connection back to the pool.

        Args:
            asset_id: Asset ID
            host: Device IP/hostname
            port: SDK port
        """
        pool_key = self._make_pool_key(asset_id, host, port)
        with self._lock:
            if pool_key in self._pool:
                self._pool[pool_key].in_use = False
                self._pool[pool_key].last_used = datetime.now()
                logger.debug(f"Released connection {pool_key}")

    def _close_connection_sync(self, conn: PooledConnection):
        """Close a connection (sync, must be called with lock held or after removing from pool)."""
        try:
            conn.manager.disconnect_sync()
            conn.manager.cleanup()
        except Exception as e:
            logger.warning(f"Error closing connection: {e}")

    async def cleanup_idle_connections(self):
        """Remove idle and expired connections."""
        now = datetime.now()
        to_close: list[PooledConnection] = []

        with self._lock:
            to_remove = []
            for key, conn in self._pool.items():
                if conn.in_use:
                    continue

                # Check idle timeout
                if now - conn.last_used > self._idle_timeout:
                    to_remove.append(key)
                    to_close.append(conn)
                    continue

                # Check max age
                if now - conn.created_at > self._max_age:
                    to_remove.append(key)
                    to_close.append(conn)

            for key in to_remove:
                del self._pool[key]

        # Close connections outside the lock
        for conn in to_close:
            pool_key = self._make_pool_key(conn.asset_id, conn.host, conn.port)
            logger.info(f"Closing idle/expired connection: {pool_key}")
            self._close_connection_sync(conn)

    async def close_all(self):
        """Close all connections in the pool."""
        with self._lock:
            connections = list(self._pool.values())
            self._pool.clear()

        for conn in connections:
            self._close_connection_sync(conn)

        logger.info("All pooled connections closed")

    def get_stats(self) -> Dict:
        """Get pool statistics."""
        with self._lock:
            total = len(self._pool)
            in_use = sum(1 for c in self._pool.values() if c.in_use)
            return {
                "total_connections": total,
                "in_use": in_use,
                "available": total - in_use,
                "connections": [
                    {
                        "key": key,
                        "in_use": conn.in_use,
                        "use_count": conn.use_count,
                        "age_seconds": (datetime.now() - conn.created_at).total_seconds(),
                        "idle_seconds": (datetime.now() - conn.last_used).total_seconds(),
                    }
                    for key, conn in self._pool.items()
                ]
            }

    async def start_cleanup_task(self, interval_seconds: int = 60):
        """Start background task for periodic cleanup."""
        async def cleanup_loop():
            while True:
                await asyncio.sleep(interval_seconds)
                try:
                    await self.cleanup_idle_connections()
                except Exception as e:
                    logger.exception(f"Cleanup task error: {e}")

        self._cleanup_task = asyncio.create_task(cleanup_loop())
        logger.info("Connection pool cleanup task started")

    def stop_cleanup_task(self):
        """Stop the background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None
            logger.info("Connection pool cleanup task stopped")


# Global connection pool instance
_connection_pool: Optional[HikvisionConnectionPool] = None


def get_connection_pool() -> HikvisionConnectionPool:
    """Get or create the global connection pool singleton."""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = HikvisionConnectionPool()
    return _connection_pool

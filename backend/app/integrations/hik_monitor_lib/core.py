"""
Hikvision Monitor Library - Core
================================
Main HikvisionManager class with SDK initialization, connection management,
and async support. Cross-platform support for Windows and Linux.
"""

import os
import sys
import logging
import asyncio
from ctypes import byref, sizeof, POINTER, c_char_p, CDLL
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

# Platform-specific imports
if sys.platform == "win32":
    from ctypes import WinDLL

from .exceptions import (
    SdkNotFoundError,
    SdkInitError,
    DeviceConnectionError,
    DeviceNotConnectedError,
    get_sdk_error_message,
)
from .sdk_structures import (
    NET_DVR_DEVICEINFO_V40,
    NET_DVR_USER_LOGIN_INFO,
    NET_DVR_LOCAL_SDK_PATH,
    NET_SDK_INIT_CFG_SDK_PATH,
)
from .schemas import (
    DeviceInfo,
    HddInfo,
    ChannelInfo,
    RecordingInfo,
    HealthSummary,
    SyncData,
    TimeInfo,
    DEVICE_TYPES,
    get_device_type_name,
)

logger = logging.getLogger(__name__)


class HikvisionManager:
    """
    Главный класс для мониторинга Hikvision устройств.

    Поддерживает:
    - Async операции через ThreadPoolExecutor
    - Context manager (async with)
    - Кроссплатформенность (Windows/Linux)
    - Автопоиск SDK в папке lib/[win64|linux64]/lib/ рядом с модулем

    Example:
        async with HikvisionManager() as manager:
            await manager.connect(ip, port, username, password)
            data = await manager.get_sync_data()
            print(data.to_json())
    """

    def __init__(self, sdk_path: str = None):
        """
        Инициализация SDK.

        Args:
            sdk_path: Путь к папке с SDK библиотекой (HCNetSDK.dll или libhcnetsdk.so).
                      Если не указан - ищет в lib/[win64|linux64]/lib/ рядом с модулем.
        """
        self.sdk = None
        self.user_id = -1
        self.device_info: Optional[NET_DVR_DEVICEINFO_V40] = None
        self._connected_ip: str = ""
        self._connected_port: int = 0
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="hik_sdk")
        self._platform: str = ""  # Will be set in _load_sdk

        # Lazy import diagnostics to avoid circular imports
        self._diagnostics = None

        self._load_sdk(sdk_path)

    def _get_platform_info(self) -> Tuple[str, str, str]:
        """
        Определить платформу и пути к SDK.

        Returns:
            tuple: (platform_name, lib_subdir, lib_filename)

        Raises:
            SdkNotFoundError: если платформа не поддерживается
        """
        if sys.platform == "win32":
            return ("Windows", "win64/lib", "HCNetSDK.dll")
        elif sys.platform == "linux":
            return ("Linux", "linux64/lib", "libhcnetsdk.so")
        else:
            raise SdkNotFoundError(f"Unsupported platform: {sys.platform}")

    def _find_sdk_path(self) -> Tuple[Optional[str], str]:
        """
        Найти путь к SDK библиотеке.

        Returns:
            tuple: (lib_dir, lib_filename) where lib_dir может быть None
        """
        platform_name, lib_subdir, lib_name = self._get_platform_info()
        module_dir = os.path.dirname(os.path.abspath(__file__))

        # Порядок поиска:
        # 1. lib/[win64|linux64]/lib/ рядом с модулем
        # 2. То же в рабочей директории
        # 3. То же в родительской директории
        search_bases = [
            module_dir,
            os.getcwd(),
            os.path.dirname(module_dir),
        ]

        for base in search_bases:
            lib_dir = os.path.join(base, "lib", lib_subdir)
            lib_path = os.path.join(lib_dir, lib_name)
            if os.path.exists(lib_path):
                logger.debug(f"Found SDK at: {lib_path}")
                return lib_dir, lib_name

        return None, lib_name

    def _load_sdk(self, sdk_path: str = None):
        """
        Кроссплатформенная загрузка SDK библиотеки.

        Args:
            sdk_path: Путь к папке с SDK (опционально)
        """
        platform_name, lib_subdir, lib_name = self._get_platform_info()

        if sdk_path:
            lib_path = os.path.join(sdk_path, lib_name)
            if not os.path.exists(lib_path):
                raise SdkNotFoundError(lib_path)
            lib_dir = sdk_path
        else:
            # Автопоиск
            lib_dir, lib_name = self._find_sdk_path()
            if lib_dir:
                lib_path = os.path.join(lib_dir, lib_name)
            else:
                # Попробуем загрузить из системного PATH
                lib_path = lib_name
                lib_dir = None

        try:
            old_cwd = None

            if sys.platform == "win32":
                # Windows: WinDLL + add_dll_directory
                if lib_dir:
                    os.add_dll_directory(lib_dir)
                    # Также добавляем HCNetSDKCom для зависимостей
                    hcnetsdkcom_dir = os.path.join(lib_dir, "HCNetSDKCom")
                    if os.path.exists(hcnetsdkcom_dir):
                        os.add_dll_directory(hcnetsdkcom_dir)
                    # Меняем рабочую директорию для загрузки зависимых DLL
                    old_cwd = os.getcwd()
                    os.chdir(lib_dir)

                self.sdk = WinDLL(lib_path)

                # Восстанавливаем директорию
                if old_cwd:
                    os.chdir(old_cwd)
            else:
                # Linux: CDLL + LD_LIBRARY_PATH
                if lib_dir:
                    # Модифицируем LD_LIBRARY_PATH для зависимостей
                    ld_path = os.environ.get("LD_LIBRARY_PATH", "")
                    hcnetsdkcom_dir = os.path.join(lib_dir, "HCNetSDKCom")
                    new_paths = [lib_dir]
                    if os.path.exists(hcnetsdkcom_dir):
                        new_paths.append(hcnetsdkcom_dir)
                    for path in new_paths:
                        if path not in ld_path:
                            ld_path = f"{path}:{ld_path}" if ld_path else path
                    os.environ["LD_LIBRARY_PATH"] = ld_path

                self.sdk = CDLL(lib_path)

            # Указываем SDK путь к папке HCNetSDKCom (ОБЯЗАТЕЛЬНО ДО NET_DVR_Init!)
            # Это позволяет запускать приложение из любой директории
            if lib_dir:
                sdk_path_struct = NET_DVR_LOCAL_SDK_PATH()
                # Путь должен быть в bytes для ctypes c_char array
                path_bytes = lib_dir.encode('utf-8')
                sdk_path_struct.sPath = path_bytes
                self.sdk.NET_DVR_SetSDKInitCfg(NET_SDK_INIT_CFG_SDK_PATH, byref(sdk_path_struct))
                logger.debug(f"SDK component path set to: {lib_dir}")

            # Инициализация SDK
            if not self.sdk.NET_DVR_Init():
                error_code = self.sdk.NET_DVR_GetLastError()
                raise SdkInitError(error_code)

            # Установка таймаутов
            self.sdk.NET_DVR_SetConnectTime(5000, 3)  # 5 сек, 3 попытки
            self.sdk.NET_DVR_SetRecvTimeOut(10000)    # 10 сек

            self._platform = platform_name
            logger.info(f"Hikvision SDK loaded successfully ({platform_name})")

        except SdkNotFoundError:
            raise
        except SdkInitError:
            raise
        except OSError as e:
            error_str = str(e).lower()
            if "cannot open shared object" in error_str or "не найден" in error_str or "no such file" in error_str:
                raise SdkNotFoundError(lib_path) from e
            raise SdkInitError() from e
        except Exception as e:
            raise SdkInitError() from e

    # ========================================================================
    # CONNECTION METHODS
    # ========================================================================

    def connect_sync(self, ip: str, port: int, username: str, password: str) -> bool:
        """
        Синхронное подключение к устройству.

        Args:
            ip: IP адрес устройства
            port: Порт (обычно 8000)
            username: Логин
            password: Пароль

        Returns:
            True если успешно

        Raises:
            DeviceConnectionError: при ошибке подключения
        """
        login_info = NET_DVR_USER_LOGIN_INFO()
        login_info.sDeviceAddress = ip.encode('utf-8')
        login_info.wPort = port
        login_info.sUserName = username.encode('utf-8')
        login_info.sPassword = password.encode('utf-8')
        login_info.bUseAsynLogin = 0  # Синхронный вход

        self.device_info = NET_DVR_DEVICEINFO_V40()

        self.user_id = self.sdk.NET_DVR_Login_V40(
            byref(login_info),
            byref(self.device_info)
        )

        if self.user_id < 0:
            error_code = self.sdk.NET_DVR_GetLastError()
            error_msg = get_sdk_error_message(error_code)
            raise DeviceConnectionError(ip, port, error_code, error_msg)

        self._connected_ip = ip
        self._connected_port = port
        logger.info(f"Connected to {ip}:{port}")
        return True

    async def connect(self, ip: str, port: int, username: str, password: str) -> bool:
        """
        Асинхронное подключение к устройству.

        Args:
            ip: IP адрес устройства
            port: Порт (обычно 8000)
            username: Логин
            password: Пароль

        Returns:
            True если успешно
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            self.connect_sync,
            ip, port, username, password
        )

    def disconnect_sync(self):
        """Синхронное отключение от устройства."""
        if self.user_id >= 0:
            self.sdk.NET_DVR_Logout(self.user_id)
            self.user_id = -1
            logger.info(f"Disconnected from {self._connected_ip}:{self._connected_port}")
            self._connected_ip = ""
            self._connected_port = 0

    async def disconnect(self):
        """Асинхронное отключение от устройства."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, self.disconnect_sync)

    def cleanup(self):
        """Очистка SDK (вызывать при завершении работы)."""
        self.disconnect_sync()
        if self.sdk:
            self.sdk.NET_DVR_Cleanup()
            logger.info("SDK cleanup completed")
        self._executor.shutdown(wait=True)

    # ========================================================================
    # CONTEXT MANAGER
    # ========================================================================

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()
        # Не делаем cleanup здесь - SDK может понадобиться для других соединений

    def __enter__(self):
        """Sync context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Sync context manager exit."""
        self.disconnect_sync()

    # ========================================================================
    # UTILITY METHODS
    # ========================================================================

    def get_last_error(self) -> int:
        """Получить код последней ошибки SDK."""
        return self.sdk.NET_DVR_GetLastError()

    def is_connected(self) -> bool:
        """Проверить наличие подключения."""
        return self.user_id >= 0

    def _ensure_connected(self):
        """Проверить подключение, выбросить исключение если не подключен."""
        if self.user_id < 0:
            raise DeviceNotConnectedError()

    @property
    def diagnostics(self):
        """Получить модуль диагностики (lazy load)."""
        if self._diagnostics is None:
            from .diagnostics import Diagnostics
            self._diagnostics = Diagnostics(self)
        return self._diagnostics

    # ========================================================================
    # DEVICE INFO
    # ========================================================================

    def get_device_info_sync(self) -> DeviceInfo:
        """
        Получить информацию об устройстве (синхронно).

        Combines SDK data (serial, type, channels) with ISAPI data (model name, firmware).

        Returns:
            DeviceInfo с данными устройства
        """
        self._ensure_connected()

        dev = self.device_info.struDeviceV30

        # Серийный номер
        try:
            serial = bytes(dev.sSerialNumber).decode('utf-8').rstrip('\x00')
        except Exception:
            serial = ""

        # Тип устройства
        device_type = dev.byDVRType
        device_type_name = get_device_type_name(device_type)

        # Количество IP каналов (объединение низкого и высокого байта)
        ip_channels = dev.byIPChanNum + (dev.byHighDChanNum << 8)

        # Поддерживаемые функции
        features = []
        if dev.bySupport & 0x1:
            features.append("Smart Search")
        if dev.bySupport & 0x2:
            features.append("Backup")
        if dev.bySupport & 0x4:
            features.append("Compression Config")
        if dev.bySupport & 0x8:
            features.append("Multi Network Adapter")
        if dev.bySupport & 0x10:
            features.append("Remote SADP")
        if dev.bySupport & 0x20:
            features.append("RAID Card")
        if dev.bySupport1 & 0x1:
            features.append("SNMP v3.0")
        if dev.bySupport1 & 0x80:
            features.append("IPPARACFG V40")
        if dev.bySupport2 & 0x4:
            features.append("ANR")
        if dev.bySupport2 & 0x40:
            features.append("Stream Encrypt")

        # Get additional info via ISAPI (model name, firmware, MAC)
        isapi_info = self.diagnostics.get_device_info_isapi_sync()

        return DeviceInfo(
            serial_number=serial,
            device_type=device_type,
            device_type_name=device_type_name,
            firmware_version=isapi_info.get('firmware_version') or "",
            analog_channels=dev.byChanNum,
            ip_channels=ip_channels,
            disk_count=dev.byDiskNum,
            alarm_inputs=dev.byAlarmInPortNum,
            alarm_outputs=dev.byAlarmOutPortNum,
            support_features=features,
            # ISAPI fields:
            model_name=isapi_info.get('model'),
            device_name=isapi_info.get('device_name'),
            mac_address=isapi_info.get('mac_address'),
        )

    async def get_device_info(self) -> DeviceInfo:
        """Получить информацию об устройстве (асинхронно)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.get_device_info_sync)

    # ========================================================================
    # MAIN API - get_sync_data()
    # ========================================================================

    def get_sync_data_sync(self, ignored_channels: set[int] = None) -> SyncData:
        """
        Получить все данные для синхронизации с CRM (синхронно).

        Args:
            ignored_channels: Set of channel numbers to exclude from health monitoring (e.g., {2, 5, 8})

        Returns:
            SyncData со всей информацией об устройстве
        """
        self._ensure_connected()

        if ignored_channels is None:
            ignored_channels = set()

        # Собираем данные
        device_info = self.get_device_info_sync()
        hdd_list = self.diagnostics.get_hdd_info_sync()
        channels = self.diagnostics.get_channels_status_sync()
        recordings = self.diagnostics.check_recordings_sync()

        # Формируем health summary
        critical_hdd = sum(1 for h in hdd_list if h.is_critical)
        healthy_hdd = sum(1 for h in hdd_list if not h.is_critical)

        # Filter out ignored channels when calculating health status
        configured = [c for c in channels if c.is_configured and c.display_number not in ignored_channels]
        online = [c for c in configured if c.is_online]
        offline = [c for c in configured if not c.is_online]
        unconfigured = [c for c in channels if not c.is_configured and c.display_number not in ignored_channels]

        # Only count recordings for non-ignored, configured channels
        channels_with_rec = sum(
            1 for r in recordings
            if r.has_recordings and r.is_configured and r.display_number not in ignored_channels
        )

        # Определяем статус - игнорируемые каналы НЕ влияют на overall_status
        if critical_hdd > 0:
            overall_status = "critical"
        elif len(offline) > 0 or any(
            not r.has_recordings
            for r in recordings
            if r.is_online and r.is_configured and r.display_number not in ignored_channels
        ):
            overall_status = "warning"
        else:
            overall_status = "healthy"

        health = HealthSummary(
            total_hdd=len(hdd_list),
            healthy_hdd=healthy_hdd,
            critical_hdd=critical_hdd,
            total_channels=len(channels),
            configured_channels=len(configured),
            online_channels=len(online),
            offline_channels=len(offline),
            unconfigured_channels=len(unconfigured),
            channels_with_recordings=channels_with_rec,
            overall_status=overall_status,
        )

        return SyncData(
            device=device_info,
            hdd_list=hdd_list,
            channels=channels,
            recordings=recordings,
            health_summary=health,
            timestamp=datetime.now(),
        )

    async def get_sync_data(self, ignored_channels: set[int] = None) -> SyncData:
        """Get all device data for CRM synchronization (async).

        This is the main method for CRM integration. Returns complete device
        information in a structured format suitable for database storage.

        The method collects:
            - Device information (serial, type, firmware)
            - HDD status with S.M.A.R.T. data (power-on hours, temperature)
            - Channel status (D1-D16) with online/offline state
            - Recording verification (last 24 hours)
            - Health summary with overall status

        Args:
            ignored_channels: Set of channel numbers to exclude from health monitoring (e.g., {2, 5, 8})

        Returns:
            SyncData: Complete device data structure containing:
                - device: DeviceInfo with serial number, type, channels count
                - hdd_list: List[HddInfo] with capacity, SMART status, power-on hours
                - channels: List[ChannelInfo] with online status, IP addresses
                - recordings: List[RecordingInfo] with 24h recording check
                - health_summary: HealthSummary with overall status
                - timestamp: datetime of data collection

        Raises:
            DeviceNotConnectedError: If not connected to device.

        Example:
            async with HikvisionManager() as manager:
                await manager.connect(ip, port, user, password)
                # Exclude channels 2 and 5 from health monitoring
                data = await manager.get_sync_data(ignored_channels={2, 5})

                # Access as dictionary
                json_data = data.to_dict()

                # Access as JSON string
                json_str = data.to_json()

                # Access individual components
                for hdd in data.hdd_list:
                    print(f"HDD {hdd.number}: {hdd.power_on_hours} hours")
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.get_sync_data_sync, ignored_channels)

    # ========================================================================
    # CONVENIENCE METHODS
    # ========================================================================

    def get_full_report_sync(self) -> Dict[str, Any]:
        """
        Получить полный отчёт в виде словаря (синхронно).

        Returns:
            Словарь со всей информацией
        """
        sync_data = self.get_sync_data_sync()
        return sync_data.to_dict()

    async def get_full_report(self) -> Dict[str, Any]:
        """
        Получить полный отчёт в виде словаря (асинхронно).

        Returns:
            Словарь со всей информацией
        """
        sync_data = await self.get_sync_data()
        return sync_data.to_dict()

    # ========================================================================
    # TIME MANAGEMENT
    # ========================================================================

    def get_time_info_sync(self) -> TimeInfo:
        """
        Получить информацию о времени устройства (синхронно).

        Returns:
            TimeInfo с временем устройства, сервера и разницей (drift)
        """
        return self.diagnostics.get_time_info_sync()

    async def get_time_info(self) -> TimeInfo:
        """
        Получить информацию о времени устройства (асинхронно).

        Returns:
            TimeInfo с временем устройства, сервера и разницей (drift)
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self.diagnostics.get_time_info_sync
        )

    def set_time_sync(self, target_time: datetime = None) -> bool:
        """
        Установить время на устройстве (синхронно).

        Args:
            target_time: Целевое время. Если None - текущее время сервера.

        Returns:
            True если успешно
        """
        return self.diagnostics.set_time_sync(target_time)

    async def set_time(self, target_time: datetime = None) -> bool:
        """Set device time via ISAPI (async).

        Sends a PUT request to /ISAPI/System/time to update the device clock.
        This is useful for ensuring recordings have accurate timestamps.

        Args:
            target_time: Target datetime to set on device.
                If None, uses current server time (datetime.now()).

        Returns:
            bool: True if time was successfully set, False otherwise.

        Raises:
            DeviceNotConnectedError: If not connected to device.

        Example:
            # Sync to current server time
            success = await manager.set_time()

            # Set specific time
            from datetime import datetime
            success = await manager.set_time(datetime(2024, 1, 15, 12, 0, 0))

        Warning:
            Setting time may affect ongoing recordings. Use with caution
            on production systems.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self.diagnostics.set_time_sync, target_time
        )

    def sync_time_sync(self, threshold: int = 30) -> Tuple[bool, TimeInfo]:
        """
        Синхронизировать время если разница > threshold (синхронно).

        Args:
            threshold: Порог в секундах для срабатывания

        Returns:
            Tuple (была_ли_синхронизация, TimeInfo)
        """
        return self.diagnostics.sync_time_sync(threshold)

    async def sync_time(self, threshold: int = 30) -> Tuple[bool, TimeInfo]:
        """
        Синхронизировать время если разница > threshold (асинхронно).

        Args:
            threshold: Порог в секундах для срабатывания

        Returns:
            Tuple (была_ли_синхронизация, TimeInfo)
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self.diagnostics.sync_time_sync, threshold
        )

    # ========================================================================
    # NETWORK INTERFACES
    # ========================================================================

    def get_nvr_lan_ips_sync(self) -> List[str]:
        """
        Get the NVR's own LAN IP addresses (not camera IPs).

        Queries the NVR's network interface configuration via ISAPI and filters out:
        - PoE internal network IPs (192.168.254.x) - used for PoE camera connections
        - Loopback and empty addresses

        Returns:
            List of NVR LAN IP addresses (usually just one main interface)
        """
        return self.diagnostics.get_nvr_lan_ips_sync()

    async def get_nvr_lan_ips(self) -> List[str]:
        """
        Get the NVR's own LAN IP addresses (not camera IPs) - async version.

        Returns:
            List of NVR LAN IP addresses
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self.diagnostics.get_nvr_lan_ips_sync
        )

    # ========================================================================
    # SNAPSHOT CAPTURE
    # ========================================================================

    def get_snapshot_sync(self, channel: int) -> Tuple[bool, Optional[bytes], str]:
        """
        Получить снимок с канала (синхронно).

        Args:
            channel: Номер канала D1-D16 (1-16)

        Returns:
            Tuple (успех, bytes изображения или None, сообщение об ошибке)
        """
        return self.diagnostics.get_snapshot_sync(channel)

    async def get_snapshot(self, channel: int) -> Tuple[bool, Optional[bytes], str]:
        """Capture a JPEG snapshot from a camera channel (async).

        Uses the SDK's NET_DVR_CaptureJPEGPicture_NEW function to capture
        a single frame from the specified channel in JPEG format.

        Args:
            channel: Channel display number (1-based).
                Auto-detects DVR analog (A1-A16) vs NVR IP (D1-D64) channels.

        Returns:
            Tuple[bool, Optional[bytes], str]: A tuple containing:
                - success (bool): True if capture succeeded
                - image_data (bytes or None): JPEG image bytes if successful
                - error_message (str): Error description if failed, empty if success

        Raises:
            DeviceNotConnectedError: If not connected to device.

        Example:
            success, jpeg_data, error = await manager.get_snapshot(1)  # D1
            if success:
                with open("snapshot_D1.jpg", "wb") as f:
                    f.write(jpeg_data)
            else:
                print(f"Capture failed: {error}")

        Note:
            The channel must be online for snapshot capture to succeed.
            Typical image size is 100KB-500KB depending on resolution.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self.diagnostics.get_snapshot_sync, channel
        )

    def get_all_snapshots_sync(self, channels: List[int] = None) -> Dict[int, Tuple[bool, Optional[bytes], str]]:
        """
        Получить снимки со всех указанных каналов (синхронно).

        Args:
            channels: Список номеров каналов (1-16). Если None - все 16.

        Returns:
            Словарь {номер_канала: (успех, bytes, ошибка)}
        """
        return self.diagnostics.get_all_snapshots_sync(channels)

    async def get_all_snapshots(self, channels: List[int] = None) -> Dict[int, Tuple[bool, Optional[bytes], str]]:
        """
        Получить снимки со всех указанных каналов (асинхронно).

        Args:
            channels: Список номеров каналов (1-16). Если None - все 16.

        Returns:
            Словарь {номер_канала: (успех, bytes, ошибка)}
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self.diagnostics.get_all_snapshots_sync, channels
        )

"""
Hikvision Monitor Library - Diagnostics
========================================
HDD diagnostics, channel status, and recordings check.
"""

import re
import sys
import logging
import requests
from requests.auth import HTTPDigestAuth
from ctypes import byref, sizeof, cast, c_void_p, create_string_buffer, c_ulong
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, TYPE_CHECKING

# Cross-platform DWORD definition
if sys.platform == "win32":
    from ctypes.wintypes import DWORD
else:
    DWORD = c_ulong

from .sdk_structures import (
    NET_DVR_HDCFG,
    NET_DVR_HDCFG_V50,
    NET_DVR_WORKSTATE_V40,
    NET_DVR_IPPARACFG_V40,
    NET_DVR_PHY_DISK_LIST,
    NET_DVR_HDD_SMART_INFO,
    NET_DVR_FILECOND_V40,
    NET_DVR_FINDDATA_V40,
    NET_DVR_TIME,
    NET_DVR_XML_CONFIG_INPUT,
    NET_DVR_XML_CONFIG_OUTPUT,
    NET_DVR_JPEGPARA,
    NET_DVR_GET_HDCFG,
    NET_DVR_GET_HDCFG_V50,
    NET_DVR_GET_WORKSTATE_V40,
    NET_DVR_GET_IPPARACFG_V40,
    NET_DVR_GET_PHY_DISK_INFO,
    NET_DVR_GET_HDD_SMART_INFO,
    MAX_DISKNUM_V30,
    MAX_CHANNUM_V30,
    MAX_IP_DEVICE_V40,
    SUPPORT_PD_NUM,
    MAX_SMART_ATTR_NUM,
    SMART_ATTR_POWER_ON_HOURS,
    SMART_ATTR_REALLOCATED_SECTORS,
    SMART_ATTR_TEMPERATURE,
    CRITICAL_HDD_STATUSES,
    get_hd_status_name,
    get_hd_type_name,
    is_hdd_critical,
)
from .schemas import HddInfo, ChannelInfo, RecordingInfo, TimeInfo

if TYPE_CHECKING:
    from .core import HikvisionManager

logger = logging.getLogger(__name__)


class Diagnostics:
    """
    Модуль диагностики HDD, каналов и записей.

    Использует ISAPI и Binary SDK для получения полной информации.
    """

    def __init__(self, manager: "HikvisionManager"):
        """
        Args:
            manager: Экземпляр HikvisionManager с активным подключением
        """
        self._manager = manager

    @property
    def sdk(self):
        return self._manager.sdk

    @property
    def user_id(self):
        return self._manager.user_id

    @property
    def device_info(self):
        return self._manager.device_info

    # ========================================================================
    # HDD DIAGNOSTICS
    # ========================================================================

    def get_hdd_info_sync(self) -> List[HddInfo]:
        """
        Получить информацию о всех жёстких дисках (синхронно).

        Использует несколько методов:
        1. Базовый API (NET_DVR_HDCFG) - для объёма и свободного места
        2. V50 API - для дополнительных данных (модель, производитель)
        3. ISAPI - для SMART атрибутов (Power-On Hours, температура)
        4. Binary SDK (NET_DVR_GET_PHY_DISK_INFO) - fallback для SMART статуса

        Returns:
            Список HddInfo с информацией о каждом диске
        """
        self._manager._ensure_connected()

        # Получаем базовую информацию
        hdd_list = self._get_hdd_info_basic()

        # Дополняем информацией из V50 (модель, производитель)
        hdd_v50 = self._get_hdd_info_v50()
        if hdd_v50:
            v50_by_number = {h.number: h for h in hdd_v50}
            for hdd in hdd_list:
                if hdd.number in v50_by_number:
                    v50_info = v50_by_number[hdd.number]
                    hdd.model = v50_info.model or hdd.model
                    hdd.supplier = v50_info.supplier or hdd.supplier
                    hdd.location = v50_info.location or hdd.location

        # Получаем SMART информацию через ISAPI
        smart_info = self._get_smart_info_isapi()
        if smart_info:
            logger.info(f"SMART data retrieved via ISAPI for {len(smart_info)} disks")
            for hdd in hdd_list:
                if hdd.number in smart_info:
                    info = smart_info[hdd.number]
                    # Only set values if they exist (not 0), otherwise leave as None
                    hdd.power_on_hours = info.get("power_on_hours") if info.get("power_on_hours") else None
                    hdd.temperature = info.get("temperature") if info.get("temperature") else None
                    hdd.reallocated_sectors = info.get("reallocated_sectors") if info.get("reallocated_sectors") else None
                    hdd.smart_status = info.get("smart_status") if info.get("smart_status") else None
                    logger.debug(f"HDD {hdd.number}: ISAPI SMART applied - {hdd.power_on_hours}h, {hdd.temperature}°C, {hdd.smart_status}")
        else:
            logger.warning("ISAPI SMART data not available, trying Binary SDK fallback")

        # Fallback: Binary SDK для SMART статуса
        if not smart_info:
            phy_disk_info = self._get_phy_disk_smart_status()
            if phy_disk_info:
                logger.info(f"Using Binary SDK SMART data for {len(phy_disk_info)} disks")
                for hdd in hdd_list:
                    if hdd.number in phy_disk_info:
                        info = phy_disk_info[hdd.number]
                        hdd.smart_status = info.get("smart_status") if info.get("smart_status") else None
                        if not hdd.model and info.get("model"):
                            hdd.model = info["model"]
                        logger.debug(f"HDD {hdd.number}: Binary SDK SMART status = {hdd.smart_status}")
            else:
                logger.warning("No SMART data available from either ISAPI or Binary SDK - SMART fields will remain NULL")

        # Определяем SMART статус по status_code если не установлен
        for hdd in hdd_list:
            if not hdd.smart_status:
                if hdd.status_code == 3:  # SMART_FAILED
                    hdd.smart_status = "Fail"
                elif hdd.status_code in [0, 5]:  # NORMAL или SLEEP
                    hdd.smart_status = "Pass"
                # Otherwise leave as None (SMART not supported)
                elif hdd.status_code in [2, 17, 18]:  # ERROR, WARNING, BAD
                    hdd.smart_status = "Fail"

            # Определяем критичность
            hdd.is_critical = is_hdd_critical(hdd.status_code, hdd.smart_status)

        return hdd_list

    def _get_hdd_info_basic(self) -> List[HddInfo]:
        """Получить базовую HDD информацию через NET_DVR_HDCFG."""
        hd_cfg = NET_DVR_HDCFG()
        hd_cfg.dwSize = sizeof(hd_cfg)
        returned = DWORD(0)

        result = self.sdk.NET_DVR_GetDVRConfig(
            self.user_id,
            NET_DVR_GET_HDCFG,
            0,
            byref(hd_cfg),
            sizeof(hd_cfg),
            byref(returned)
        )

        if not result:
            error = self._manager.get_last_error()
            logger.error(f"Failed to get HDD config: error {error}")
            return []

        hdd_list = []
        seen_numbers = set()

        slots_to_check = max(hd_cfg.dwHDCount, MAX_DISKNUM_V30)
        for i in range(min(slots_to_check, MAX_DISKNUM_V30)):
            hd = hd_cfg.struHDInfo[i]

            # Пропускаем пустые слоты
            if hd.dwCapacity == 0 and hd.dwHdStatus in [0, 14]:
                continue

            disk_number = hd.dwHDNo
            display_number = disk_number + 1 if disk_number < 100 else disk_number

            if display_number in seen_numbers:
                continue
            seen_numbers.add(display_number)

            capacity_gb = hd.dwCapacity / 1024
            free_gb = hd.dwFreeSpace / 1024
            used_percent = ((capacity_gb - free_gb) / capacity_gb * 100) if capacity_gb > 0 else 100.0

            hdd_list.append(HddInfo(
                number=display_number,
                capacity_gb=round(capacity_gb, 2),
                free_space_gb=round(free_gb, 2),
                used_percent=round(used_percent, 1),
                status=get_hd_status_name(hd.dwHdStatus),
                status_code=hd.dwHdStatus,
                hdd_type=get_hd_type_name(hd.byHDType),
                type_code=hd.byHDType,
                is_recycling=bool(hd.byRecycling),
            ))

        hdd_list.sort(key=lambda x: x.number)
        return hdd_list

    def _get_hdd_info_v50(self) -> List[HddInfo]:
        """Получить HDD информацию v5.0 (с моделью и производителем)."""
        hd_cfg = NET_DVR_HDCFG_V50()
        hd_cfg.dwSize = sizeof(hd_cfg)
        returned = DWORD(0)

        result = self.sdk.NET_DVR_GetDVRConfig(
            self.user_id,
            NET_DVR_GET_HDCFG_V50,
            0,
            byref(hd_cfg),
            sizeof(hd_cfg),
            byref(returned)
        )

        if not result:
            return []

        hdd_list = []
        for i in range(min(hd_cfg.dwHDCount, MAX_DISKNUM_V30)):
            hd = hd_cfg.struHDInfoV50[i]

            if hd.dwCapacity == 0 and hd.dwHdStatus == 0:
                continue

            capacity_gb = hd.dwCapacity / 1024
            free_gb = hd.dwFreeSpace / 1024
            used_percent = ((capacity_gb - free_gb) / capacity_gb * 100) if capacity_gb > 0 else 100.0

            try:
                model = bytes(hd.byMode).decode('utf-8', errors='ignore').rstrip('\x00')
            except Exception:
                model = ""

            try:
                supplier = bytes(hd.bySupplier).decode('utf-8', errors='ignore').rstrip('\x00')
            except Exception:
                supplier = ""

            try:
                location = bytes(hd.bySlotLocation).decode('utf-8', errors='ignore').rstrip('\x00')
            except Exception:
                location = ""

            hdd_list.append(HddInfo(
                number=hd.dwHDNo + 1,
                capacity_gb=round(capacity_gb, 2),
                free_space_gb=round(free_gb, 2),
                used_percent=round(used_percent, 1),
                status=get_hd_status_name(hd.dwHdStatus),
                status_code=hd.dwHdStatus,
                hdd_type=get_hd_type_name(hd.byHDType),
                type_code=hd.byHDType,
                is_recycling=bool(hd.byRecycling),
                model=model,
                supplier=supplier,
                location=location,
            ))

        return hdd_list

    def _get_smart_info_isapi(self) -> Dict[int, Dict[str, Any]]:
        """
        Получить полную SMART информацию через ISAPI.

        Tries multiple endpoints in order:
        1. /ISAPI/ContentMgmt/Storage/hdd/{id}/SMARTTest/status (detailed SMART)
        2. /ISAPI/System/IO/hdd (basic info with some SMART data)

        Returns:
            Словарь {номер_диска: {smart_status, power_on_hours, temperature, ...}}
        """
        # Try detailed SMART endpoint first
        result = self._get_smart_detailed_isapi()
        if result:
            logger.info(f"Got SMART data from detailed endpoint for {len(result)} disks")
            return result

        # Fallback: try basic HDD info endpoint
        logger.warning("Detailed SMART endpoint failed, trying basic HDD info endpoint")
        result = self._get_smart_basic_isapi()
        if result:
            logger.info(f"Got SMART data from basic HDD endpoint for {len(result)} disks")
        return result

    def _get_smart_detailed_isapi(self) -> Dict[int, Dict[str, Any]]:
        """Get detailed SMART info via /ISAPI/ContentMgmt/Storage/hdd/{id}/SMARTTest/status"""
        result = {}
        disk_count = self.device_info.struDeviceV30.byDiskNum if self.device_info else 2

        for disk_id in range(1, disk_count + 1):
            try:
                url = f"GET /ISAPI/ContentMgmt/Storage/hdd/{disk_id}/SMARTTest/status\r\n".encode()
                url_buffer = create_string_buffer(url)
                out_buffer = create_string_buffer(16384)
                status_buffer = create_string_buffer(2048)

                input_param = NET_DVR_XML_CONFIG_INPUT()
                input_param.dwSize = sizeof(input_param)
                input_param.lpRequestUrl = cast(url_buffer, c_void_p)
                input_param.dwRequestUrlLen = len(url)
                input_param.lpInBuffer = None
                input_param.dwInBufferSize = 0
                input_param.dwRecvTimeOut = 10000

                output_param = NET_DVR_XML_CONFIG_OUTPUT()
                output_param.dwSize = sizeof(output_param)
                output_param.lpOutBuffer = cast(out_buffer, c_void_p)
                output_param.dwOutBufferSize = 16384
                output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
                output_param.dwStatusSize = 2048

                ret = self.sdk.NET_DVR_STDXMLConfig(
                    self.user_id,
                    byref(input_param),
                    byref(output_param)
                )

                if not ret:
                    continue

                xml_data = out_buffer.value.decode('utf-8', errors='ignore')

                # Log first 1000 chars of XML for debugging different device formats
                logger.debug(f"SMART XML for disk {disk_id}: {xml_data[:1000]}")

                # TEMPORARY: Save full XML to file for debugging HWN-4216MH-16P
                try:
                    import os
                    debug_dir = os.path.join(os.path.dirname(__file__), "debug_xml")
                    os.makedirs(debug_dir, exist_ok=True)
                    debug_file = os.path.join(debug_dir, f"smart_disk_{disk_id}.xml")
                    with open(debug_file, "w", encoding="utf-8") as f:
                        f.write(xml_data)
                    logger.info(f"SMART XML saved to {debug_file}")
                except Exception as e:
                    logger.debug(f"Failed to save debug XML: {e}")

                info = {
                    "smart_status": "Pass",
                    "power_on_hours": 0,
                    "power_on_days": 0,
                    "temperature": 0,
                    "reallocated_sectors": 0,
                }

                # Парсим статус SMART
                self_eval_match = re.search(
                    r'<selfEvaluaingStatus>(\w+)</selfEvaluaingStatus>',
                    xml_data, re.IGNORECASE
                )
                if self_eval_match:
                    status = self_eval_match.group(1).lower()
                    if status in ["error", "fail", "fault"]:
                        info["smart_status"] = "Fail"

                all_eval_match = re.search(
                    r'<allEvaluaingStatus>(\w+)</allEvaluaingStatus>',
                    xml_data, re.IGNORECASE
                )
                if all_eval_match:
                    status = all_eval_match.group(1).lower()
                    if status in ["fault", "error", "fail"]:
                        info["smart_status"] = "Fail"

                # Температура (с опечаткой в API - temprature, но также пробуем temperature)
                temp_match = re.search(r'<temprature>(\d+)</temprature>', xml_data, re.IGNORECASE)
                if not temp_match:
                    temp_match = re.search(r'<temperature>(\d+)</temperature>', xml_data, re.IGNORECASE)
                if temp_match:
                    info["temperature"] = int(temp_match.group(1))

                # Power-on Days
                pod_match = re.search(r'<powerOnDay>(\d+)</powerOnDay>', xml_data, re.IGNORECASE)
                if pod_match:
                    info["power_on_days"] = int(pod_match.group(1))

                # Парсим SMART атрибуты
                # Try both TestResult and SMARTAttribute tags for different device firmware versions
                test_results = re.findall(
                    r'<TestResult>.*?<attributeID>(\d+)</attributeID>.*?<rawValue>(\d+)</rawValue>.*?</TestResult>',
                    xml_data, re.DOTALL | re.IGNORECASE
                )

                if not test_results:
                    # Fallback: try alternative XML structure (SMARTAttribute instead of TestResult)
                    test_results = re.findall(
                        r'<SMARTAttribute>.*?<id>(\d+)</id>.*?<rawValue>(\d+)</rawValue>.*?</SMARTAttribute>',
                        xml_data, re.DOTALL | re.IGNORECASE
                    )

                for attr_id_str, raw_value_str in test_results:
                    attr_id = int(attr_id_str)
                    raw_value = int(raw_value_str)

                    if attr_id == 9:  # Power-On Hours
                        info["power_on_hours"] = raw_value
                        logger.debug(f"Disk {disk_id}: Found Power-On Hours = {raw_value}")
                    elif attr_id == 5:  # Reallocated Sectors
                        info["reallocated_sectors"] = raw_value
                        if raw_value > 0:
                            info["smart_status"] = "Warning" if info["smart_status"] == "Pass" else info["smart_status"]
                        if raw_value > 100:
                            info["smart_status"] = "Fail"
                        logger.debug(f"Disk {disk_id}: Found Reallocated Sectors = {raw_value}")
                    elif attr_id == 194:  # Temperature
                        if info["temperature"] == 0:
                            info["temperature"] = raw_value & 0xFF
                        logger.debug(f"Disk {disk_id}: Found Temperature (attr 194) = {raw_value & 0xFF}")

                # Log final parsed values
                logger.info(f"Disk {disk_id} SMART parsed: temp={info['temperature']}°C, "
                           f"hours={info['power_on_hours']}, status={info['smart_status']}")

                result[disk_id] = info

            except Exception as e:
                logger.debug(f"ISAPI SMART request failed for disk {disk_id}: {e}")
                continue

        return result

    def _get_smart_basic_isapi(self) -> Dict[int, Dict[str, Any]]:
        """
        Get basic SMART info via /ISAPI/System/IO/hdd endpoint.

        This endpoint is more widely supported but has less detailed SMART data.
        It typically provides: temperature, power-on days (not hours), basic status.
        """
        result = {}

        try:
            url = b"GET /ISAPI/System/IO/hdd\r\n"
            url_buffer = create_string_buffer(url)
            out_buffer = create_string_buffer(131072)  # Large buffer for multiple disks
            status_buffer = create_string_buffer(4096)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = None
            input_param.dwInBufferSize = 0
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 131072
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 4096

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if not ret:
                error_code = self._manager.get_last_error()
                logger.warning(f"Basic HDD ISAPI request failed: SDK error {error_code}")
                return result

            xml_data = out_buffer.value.decode('utf-8', errors='ignore')
            logger.debug(f"Basic HDD ISAPI XML: {xml_data[:2000]}")

            # Parse HDD blocks
            hdd_blocks = re.findall(
                r'<hdd[^>]*>(.*?)</hdd>',
                xml_data, re.DOTALL | re.IGNORECASE
            )

            logger.info(f"Found {len(hdd_blocks)} HDD blocks in basic ISAPI response")

            for idx, block in enumerate(hdd_blocks):
                disk_id = idx + 1  # 1-based

                info = {
                    "smart_status": "Pass",
                    "power_on_hours": 0,
                    "power_on_days": 0,
                    "temperature": 0,
                    "reallocated_sectors": 0,
                }

                # Parse ID (some firmware use <id>, others use attributes)
                id_match = re.search(r'<id>(\d+)</id>', block)
                if id_match:
                    disk_id = int(id_match.group(1))

                # Temperature
                temp_match = re.search(r'<temperature>(\d+)</temperature>', block, re.IGNORECASE)
                if temp_match:
                    info["temperature"] = int(temp_match.group(1))

                # Power-on days (convert to hours)
                pod_match = re.search(r'<powerOnDays>(\d+)</powerOnDays>', block, re.IGNORECASE)
                if pod_match:
                    days = int(pod_match.group(1))
                    info["power_on_days"] = days
                    info["power_on_hours"] = days * 24  # Convert days to hours

                # S.M.A.R.T. status
                smart_match = re.search(r'<smartStatus>(\w+)</smartStatus>', block, re.IGNORECASE)
                if smart_match:
                    status = smart_match.group(1).lower()
                    if status in ["pass", "ok", "normal"]:
                        info["smart_status"] = "Pass"
                    elif status in ["fail", "error", "fault"]:
                        info["smart_status"] = "Fail"
                    elif status in ["warning", "degraded"]:
                        info["smart_status"] = "Warning"

                logger.info(f"Basic HDD {disk_id}: temp={info['temperature']}°C, "
                           f"days={info['power_on_days']}, hours={info['power_on_hours']}, "
                           f"status={info['smart_status']}")

                result[disk_id] = info

        except Exception as e:
            logger.warning(f"Basic HDD ISAPI request exception: {e}")

        return result

    def _get_smart_direct_http(self, host: str, port: int, username: str, password: str) -> Dict[int, Dict[str, Any]]:
        """
        Try direct HTTP requests to ISAPI endpoints (bypassing SDK).

        Tests multiple endpoints to find which one works on HWN-4216MH-16P:
        1. /ISAPI/ContentMgmt/Storage/hdd/[id]/SMARTTest/status
        2. /ISAPI/System/IO/hdd
        3. /ISAPI/Storage/hdd/[id]/SMARTTest
        4. /ISAPI/ContentMgmt/Storage/hdd

        Args:
            host: Device IP address
            port: HTTP port (usually 80)
            username: Device username
            password: Device password

        Returns:
            Dictionary mapping disk_number -> SMART data
        """
        result = {}
        base_url = f"http://{host}:{port}"
        auth = HTTPDigestAuth(username, password)

        logger.info(f"Testing direct HTTP ISAPI requests to {base_url}")

        # Test endpoint 1: /ISAPI/ContentMgmt/Storage/hdd
        try:
            url = f"{base_url}/ISAPI/ContentMgmt/Storage/hdd"
            logger.debug(f"Testing endpoint: {url}")
            response = requests.get(url, auth=auth, timeout=10)
            if response.status_code == 200:
                logger.info(f"✓ Endpoint /ISAPI/ContentMgmt/Storage/hdd returned {len(response.text)} bytes")
                logger.debug(f"Response: {response.text[:2000]}")

                # Save full XML for analysis
                try:
                    import os
                    debug_dir = os.path.join(os.path.dirname(__file__), "debug_xml")
                    os.makedirs(debug_dir, exist_ok=True)
                    debug_file = os.path.join(debug_dir, "direct_http_storage_hdd.xml")
                    with open(debug_file, "w", encoding="utf-8") as f:
                        f.write(response.text)
                    logger.info(f"Full XML saved to {debug_file}")
                except Exception as e:
                    logger.debug(f"Failed to save XML: {e}")

                # Try parsing
                result = self._parse_storage_hdd_xml(response.text)
                if result:
                    return result
            else:
                logger.warning(f"✗ Endpoint returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"✗ Endpoint /ISAPI/ContentMgmt/Storage/hdd failed: {e}")

        # Test endpoint 2: /ISAPI/System/IO/hdd
        try:
            url = f"{base_url}/ISAPI/System/IO/hdd"
            logger.debug(f"Testing endpoint: {url}")
            response = requests.get(url, auth=auth, timeout=10)
            if response.status_code == 200:
                logger.info(f"✓ Endpoint /ISAPI/System/IO/hdd returned {len(response.text)} bytes")
                logger.debug(f"Response: {response.text[:2000]}")

                # Save full XML
                try:
                    import os
                    debug_dir = os.path.join(os.path.dirname(__file__), "debug_xml")
                    os.makedirs(debug_dir, exist_ok=True)
                    debug_file = os.path.join(debug_dir, "direct_http_system_io_hdd.xml")
                    with open(debug_file, "w", encoding="utf-8") as f:
                        f.write(response.text)
                    logger.info(f"Full XML saved to {debug_file}")
                except Exception as e:
                    logger.debug(f"Failed to save XML: {e}")

                # Try parsing (reuse existing basic HDD parser logic)
                result = self._parse_basic_hdd_xml(response.text)
                if result:
                    return result
            else:
                logger.warning(f"✗ Endpoint returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"✗ Endpoint /ISAPI/System/IO/hdd failed: {e}")

        # Test endpoint 3: Per-disk SMART status
        for disk_id in range(1, 5):
            try:
                url = f"{base_url}/ISAPI/ContentMgmt/Storage/hdd/{disk_id}/SMARTTest/status"
                logger.debug(f"Testing endpoint: {url}")
                response = requests.get(url, auth=auth, timeout=10)
                if response.status_code == 200:
                    logger.info(f"✓ Endpoint /ISAPI/.../hdd/{disk_id}/SMARTTest/status returned {len(response.text)} bytes")
                    logger.debug(f"Response: {response.text[:2000]}")

                    # Save full XML
                    try:
                        import os
                        debug_dir = os.path.join(os.path.dirname(__file__), "debug_xml")
                        os.makedirs(debug_dir, exist_ok=True)
                        debug_file = os.path.join(debug_dir, f"direct_http_smart_disk_{disk_id}.xml")
                        with open(debug_file, "w", encoding="utf-8") as f:
                            f.write(response.text)
                        logger.info(f"Full XML saved to {debug_file}")
                    except Exception as e:
                        logger.debug(f"Failed to save XML: {e}")

                    # Parse this disk's SMART data
                    info = self._parse_smart_test_status_xml(response.text, disk_id)
                    if info:
                        result[disk_id] = info
                else:
                    logger.debug(f"✗ Disk {disk_id} endpoint returned status {response.status_code}")
                    break  # If first disk fails, others likely will too
            except Exception as e:
                logger.debug(f"✗ Disk {disk_id} endpoint failed: {e}")
                break

        if result:
            logger.info(f"Direct HTTP retrieved SMART data for {len(result)} disks")
        else:
            logger.warning("All direct HTTP endpoints failed or returned no data")

        return result

    def _parse_storage_hdd_xml(self, xml_data: str) -> Dict[int, Dict[str, Any]]:
        """Parse /ISAPI/ContentMgmt/Storage/hdd XML response."""
        result = {}
        # Similar structure to basic HDD parsing
        hdd_blocks = re.findall(r'<hdd[^>]*>(.*?)</hdd>', xml_data, re.DOTALL | re.IGNORECASE)

        for idx, block in enumerate(hdd_blocks):
            disk_id = idx + 1
            info = {
                "smart_status": "",
                "power_on_hours": 0,
                "temperature": 0,
                "reallocated_sectors": 0,
            }

            # Extract ID if available
            id_match = re.search(r'<id>(\d+)</id>', block)
            if id_match:
                disk_id = int(id_match.group(1))

            # Temperature
            temp_match = re.search(r'<temperature>(\d+)</temperature>', block, re.IGNORECASE)
            if temp_match:
                info["temperature"] = int(temp_match.group(1))

            # Power-on hours or days
            hours_match = re.search(r'<powerOnHours>(\d+)</powerOnHours>', block, re.IGNORECASE)
            if hours_match:
                info["power_on_hours"] = int(hours_match.group(1))
            else:
                days_match = re.search(r'<powerOnDays>(\d+)</powerOnDays>', block, re.IGNORECASE)
                if days_match:
                    info["power_on_hours"] = int(days_match.group(1)) * 24

            # SMART status
            smart_match = re.search(r'<smartStatus>(\w+)</smartStatus>', block, re.IGNORECASE)
            if smart_match:
                status = smart_match.group(1).lower()
                if status in ["pass", "ok", "normal"]:
                    info["smart_status"] = "Pass"
                elif status in ["fail", "error"]:
                    info["smart_status"] = "Fail"
                elif status in ["warning"]:
                    info["smart_status"] = "Warning"

            if info["temperature"] > 0 or info["power_on_hours"] > 0:
                result[disk_id] = info
                logger.info(f"Parsed disk {disk_id}: {info}")

        return result

    def _parse_basic_hdd_xml(self, xml_data: str) -> Dict[int, Dict[str, Any]]:
        """Parse /ISAPI/System/IO/hdd XML response."""
        # Reuse logic from _get_smart_basic_isapi
        result = {}
        hdd_blocks = re.findall(r'<hdd[^>]*>(.*?)</hdd>', xml_data, re.DOTALL | re.IGNORECASE)

        for idx, block in enumerate(hdd_blocks):
            disk_id = idx + 1
            info = {
                "smart_status": "",
                "power_on_hours": 0,
                "temperature": 0,
                "reallocated_sectors": 0,
            }

            id_match = re.search(r'<id>(\d+)</id>', block)
            if id_match:
                disk_id = int(id_match.group(1))

            temp_match = re.search(r'<temperature>(\d+)</temperature>', block, re.IGNORECASE)
            if temp_match:
                info["temperature"] = int(temp_match.group(1))

            pod_match = re.search(r'<powerOnDays>(\d+)</powerOnDays>', block, re.IGNORECASE)
            if pod_match:
                info["power_on_hours"] = int(pod_match.group(1)) * 24

            smart_match = re.search(r'<smartStatus>(\w+)</smartStatus>', block, re.IGNORECASE)
            if smart_match:
                status = smart_match.group(1).lower()
                if status in ["pass", "ok", "normal"]:
                    info["smart_status"] = "Pass"
                elif status in ["fail", "error"]:
                    info["smart_status"] = "Fail"
                elif status in ["warning"]:
                    info["smart_status"] = "Warning"

            if info["temperature"] > 0 or info["power_on_hours"] > 0:
                result[disk_id] = info
                logger.info(f"Parsed disk {disk_id}: {info}")

        return result

    def _parse_smart_test_status_xml(self, xml_data: str, disk_id: int) -> Optional[Dict[str, Any]]:
        """Parse per-disk /ISAPI/.../SMARTTest/status XML response."""
        info = {
            "smart_status": "",
            "power_on_hours": 0,
            "temperature": 0,
            "reallocated_sectors": 0,
        }

        # Overall status
        status_match = re.search(r'<selfEvaluaingStatus>(\w+)</selfEvaluaingStatus>', xml_data, re.IGNORECASE)
        if not status_match:
            status_match = re.search(r'<allEvaluaingStatus>(\w+)</allEvaluaingStatus>', xml_data, re.IGNORECASE)
        if status_match:
            status = status_match.group(1).lower()
            if status == "pass":
                info["smart_status"] = "Pass"
            elif status in ["fail", "failure"]:
                info["smart_status"] = "Fail"
            elif status in ["warning", "degraded"]:
                info["smart_status"] = "Warning"

        # Temperature (typo version)
        temp_match = re.search(r'<temprature>(\d+)</temprature>', xml_data, re.IGNORECASE)
        if not temp_match:
            temp_match = re.search(r'<temperature>(\d+)</temperature>', xml_data, re.IGNORECASE)
        if temp_match:
            info["temperature"] = int(temp_match.group(1))

        # SMART attributes
        test_results = re.findall(
            r'<TestResult>.*?<attributeID>(\d+)</attributeID>.*?<rawValue>(\d+)</rawValue>.*?</TestResult>',
            xml_data, re.DOTALL | re.IGNORECASE
        )

        if not test_results:
            test_results = re.findall(
                r'<SMARTAttribute>.*?<id>(\d+)</id>.*?<rawValue>(\d+)</rawValue>.*?</SMARTAttribute>',
                xml_data, re.DOTALL | re.IGNORECASE
            )

        for attr_id_str, raw_value_str in test_results:
            attr_id = int(attr_id_str)
            raw_value = int(raw_value_str)

            if attr_id == 9:  # Power-On Hours
                info["power_on_hours"] = raw_value
            elif attr_id == 194:  # Temperature
                if info["temperature"] == 0:
                    info["temperature"] = raw_value
            elif attr_id == 5:  # Reallocated Sectors
                info["reallocated_sectors"] = raw_value

        if info["temperature"] > 0 or info["power_on_hours"] > 0:
            return info
        return None

    async def get_smart_direct_http_async(self, host: str, port: int, username: str, password: str) -> Dict[int, Dict[str, Any]]:
        """
        Async wrapper for direct HTTP SMART retrieval.

        This runs the synchronous _get_smart_direct_http() in the executor thread.
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,  # Use default executor
            self._get_smart_direct_http,
            host,
            port,
            username,
            password
        )

    def _get_phy_disk_smart_status(self) -> Dict[int, Dict[str, Any]]:
        """Получить SMART статус через Binary SDK (NET_DVR_GET_PHY_DISK_INFO)."""
        result = {}

        try:
            phy_disk_list = NET_DVR_PHY_DISK_LIST()
            phy_disk_list.dwSize = sizeof(phy_disk_list)
            returned = DWORD(0)

            ret = self.sdk.NET_DVR_GetDVRConfig(
                self.user_id,
                NET_DVR_GET_PHY_DISK_INFO,
                0,
                byref(phy_disk_list),
                sizeof(phy_disk_list),
                byref(returned)
            )

            if not ret:
                error_code = self._manager.get_last_error()
                logger.warning(f"PHY_DISK_INFO request failed: SDK error {error_code}")
                return result

            logger.info(f"PHY_DISK_INFO: Found {phy_disk_list.dwCount} physical disks")

            for i in range(min(phy_disk_list.dwCount, SUPPORT_PD_NUM)):
                disk = phy_disk_list.struPhyDiskInfo[i]

                if disk.byType == 0xff:
                    continue

                slot = disk.wPhySlot + 1 if disk.wPhySlot < 100 else disk.wPhySlot

                smart_status = "Pass"
                if disk.byType == 8:  # SMART аномальный
                    smart_status = "Fail"
                elif disk.byType == 7:  # Аномальный
                    smart_status = "Fail"
                elif disk.byType == 10:  # Есть bad-блоки
                    smart_status = "Warning"
                elif disk.byType == 4:  # Оффлайн
                    smart_status = "Offline"

                try:
                    model = bytes(disk.byMode).decode('utf-8', errors='ignore').rstrip('\x00')
                except Exception:
                    model = ""

                result[slot] = {
                    "smart_status": smart_status,
                    "disk_type": disk.byType,
                    "model": model,
                    "status_code": disk.byStatus,
                }

                logger.debug(f"PHY_DISK slot {slot}: type={disk.byType}, status={smart_status}, model={model}")

        except Exception as e:
            logger.warning(f"PHY_DISK_INFO request exception: {e}")

        return result

    # ========================================================================
    # CHANNEL STATUS
    # ========================================================================

    def get_channels_status_sync(self) -> List[ChannelInfo]:
        """
        Получить статус всех каналов (синхронно).

        Нумерация:
        - Аналоговые: A1, A2... (display_number = номер)
        - IP: D1, D2... D16 (display_number = D-номер)

        Returns:
            Список ChannelInfo для всех каналов
        """
        self._manager._ensure_connected()

        channels = []
        dev = self.device_info.struDeviceV30
        analog_count = dev.byChanNum
        start_chan = dev.byStartChan if dev.byStartChan > 0 else 1

        logger.info(f"[channels] Device info: analog={analog_count} (start={start_chan}), "
                    f"ip={dev.byIPChanNum + (dev.byHighDChanNum << 8)} (start={dev.byStartDChan})")

        # Аналоговые каналы из WORKSTATE
        if analog_count > 0:
            work_state = NET_DVR_WORKSTATE_V40()
            work_state.dwSize = sizeof(work_state)
            returned = DWORD(0)

            result = self.sdk.NET_DVR_GetDVRConfig(
                self.user_id,
                NET_DVR_GET_WORKSTATE_V40,
                0,
                byref(work_state),
                sizeof(work_state),
                byref(returned)
            )

            if result:
                for i in range(analog_count):
                    chan = work_state.struChanStatic[i]

                    channels.append(ChannelInfo(
                        channel_number=start_chan + i,
                        display_number=i + 1,
                        channel_type="analog",
                        is_configured=True,
                        is_online=chan.bySignalStatic == 0,
                        is_recording=chan.byRecordStatic == 1,
                        has_signal=chan.bySignalStatic == 0,
                        bitrate_kbps=chan.dwBitRate,
                        connected_clients=chan.dwLinkNum,
                    ))
                logger.info(f"[channels] WORKSTATE OK: {analog_count} analog channels added")
            else:
                # WORKSTATE failed — still add analog channels without status info
                error_code = self._manager.get_last_error()
                logger.warning(f"[channels] WORKSTATE_V40 failed (error={error_code}), "
                             f"adding {analog_count} analog channels without status")
                for i in range(analog_count):
                    channels.append(ChannelInfo(
                        channel_number=start_chan + i,
                        display_number=i + 1,
                        channel_type="analog",
                        is_configured=True,
                        is_online=True,  # Assume online when status unknown
                        has_signal=True,
                    ))

        # IP каналы (display numbers offset by analog_count to avoid overlap)
        ip_channels = self._get_ip_channels(display_offset=analog_count)
        channels.extend(ip_channels)
        logger.info(f"[channels] Total: {len(channels)} channels ({analog_count} analog + {len(ip_channels)} IP)")

        return channels

    def _get_ip_channels(self, display_offset: int = 0) -> List[ChannelInfo]:
        """Получить IP каналы (приоритет: ISAPI, fallback: SDK).

        Args:
            display_offset: Offset for display_number to avoid overlap with analog channels.
                For pure NVR this is 0, for hybrid DVR this is analog_count.
        """
        channels = self._get_ip_channels_via_isapi(display_offset=display_offset)
        if channels:
            return channels
        return self._get_ip_channels_via_sdk(display_offset=display_offset)

    def _get_ip_channels_via_isapi(self, display_offset: int = 0) -> List[ChannelInfo]:
        """Получить IP каналы через ISAPI."""
        try:
            url = b"GET /ISAPI/ContentMgmt/InputProxy/channels/status\r\n"
            url_buffer = create_string_buffer(url)
            out_buffer = create_string_buffer(131072)
            status_buffer = create_string_buffer(4096)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = None
            input_param.dwInBufferSize = 0
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 131072
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 4096

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if not ret:
                return []

            xml_data = out_buffer.value.decode('utf-8', errors='ignore')

            dev = self.device_info.struDeviceV30
            total_ip_channels = dev.byIPChanNum + (dev.byHighDChanNum << 8)
            start_dchan = dev.byStartDChan if dev.byStartDChan > 0 else 33

            configured_channels = {}

            channel_blocks = re.findall(
                r'<InputProxyChannelStatus[^>]*>(.*?)</InputProxyChannelStatus>',
                xml_data, re.DOTALL | re.IGNORECASE
            )

            for block in channel_blocks:
                id_match = re.search(r'<id>(\d+)</id>', block)
                if not id_match:
                    continue
                channel_id = int(id_match.group(1))

                ip_match = re.search(r'<ipAddress>([^<]+)</ipAddress>', block)
                ip = ip_match.group(1) if ip_match else ""

                proto_match = re.search(r'<proxyProtocol>([^<]+)</proxyProtocol>', block)
                protocol = proto_match.group(1) if proto_match else "Unknown"

                online_match = re.search(r'<online>([^<]+)</online>', block)
                is_online = online_match and online_match.group(1).lower() == "true"

                configured_channels[channel_id] = {
                    "ip": ip,
                    "protocol": protocol,
                    "is_online": is_online,
                }

            if not configured_channels:
                return []

            channels = []
            for slot in range(1, total_ip_channels + 1):
                sdk_channel_number = start_dchan + slot - 1
                display_num = slot + display_offset

                if slot in configured_channels:
                    ch_data = configured_channels[slot]
                    channels.append(ChannelInfo(
                        channel_number=sdk_channel_number,
                        display_number=display_num,
                        channel_type="ip",
                        is_configured=True,
                        is_online=ch_data["is_online"],
                        ip_address=ch_data["ip"],
                        protocol=ch_data["protocol"],
                        has_signal=ch_data["is_online"],
                    ))
                else:
                    channels.append(ChannelInfo(
                        channel_number=sdk_channel_number,
                        display_number=display_num,
                        channel_type="ip",
                        is_configured=False,
                        is_online=False,
                        ip_address="",
                        protocol="",
                    ))

            return channels

        except Exception as e:
            logger.debug(f"ISAPI channels request failed: {e}")
            return []

    def _get_ip_channels_via_sdk(self, display_offset: int = 0) -> List[ChannelInfo]:
        """Получить IP каналы через Binary SDK (fallback)."""
        ip_cfg = NET_DVR_IPPARACFG_V40()
        ip_cfg.dwSize = sizeof(ip_cfg)
        returned = DWORD(0)

        result = self.sdk.NET_DVR_GetDVRConfig(
            self.user_id,
            NET_DVR_GET_IPPARACFG_V40,
            0,
            byref(ip_cfg),
            sizeof(ip_cfg),
            byref(returned)
        )

        if not result:
            return []

        start_dchan = ip_cfg.dwStartDChan
        num_channels = ip_cfg.dwDChanNum

        # Собираем устройства по ID
        devices_by_id = {}
        for i in range(min(64, MAX_IP_DEVICE_V40)):
            dev_info = ip_cfg.struIPDevInfo[i]
            if dev_info.byEnable == 1:
                try:
                    ip = dev_info.struIP.sIpV4.decode('utf-8').rstrip('\x00')
                    if not ip:
                        ip = dev_info.struIP.sIpV6.decode('utf-8').rstrip('\x00')
                except Exception:
                    ip = ""

                proto_names = {0: "Hikvision", 1: "Panasonic", 2: "Sony"}
                protocol = proto_names.get(dev_info.byProType, "Unknown")

                devices_by_id[i + 1] = {
                    "ip": ip,
                    "protocol": protocol,
                }

        channels = []
        for slot in range(min(num_channels, MAX_CHANNUM_V30)):
            d_number = slot + 1 + display_offset
            sdk_channel_number = start_dchan + slot

            stream_mode = ip_cfg.struStreamMode[slot]
            chan_info = stream_mode.uGetStream.struChanInfo

            is_configured = (chan_info.byEnable == 1)

            if is_configured:
                device_id = chan_info.byIPID + (chan_info.byIPIDHigh << 8)
                dev = devices_by_id.get(device_id, {})

                channels.append(ChannelInfo(
                    channel_number=sdk_channel_number,
                    display_number=d_number,
                    channel_type="ip",
                    is_configured=True,
                    is_online=True,
                    ip_address=dev.get("ip", ""),
                    protocol=dev.get("protocol", "Unknown"),
                    has_signal=True,
                ))
            else:
                channels.append(ChannelInfo(
                    channel_number=sdk_channel_number,
                    display_number=d_number,
                    channel_type="ip",
                    is_configured=False,
                    is_online=False,
                    ip_address="",
                    protocol="",
                ))

        return channels

    # ========================================================================
    # RECORDINGS CHECK
    # ========================================================================

    def check_recordings_sync(self, hours: int = 24) -> List[RecordingInfo]:
        """
        Проверить наличие записей за указанный период (синхронно).

        Args:
            hours: Количество часов назад для проверки (по умолчанию 24)

        Returns:
            Список RecordingInfo для каждого канала
        """
        self._manager._ensure_connected()

        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)

        results = []
        channels_info = self.get_channels_status_sync()

        for ch_info in channels_info:
            if not ch_info.is_configured:
                results.append(RecordingInfo(
                    channel_number=ch_info.channel_number,
                    display_number=ch_info.display_number,
                    channel_type=ch_info.channel_type,
                    is_configured=False,
                    is_online=False,
                    has_recordings=False,
                    files_count=0,
                    total_size_gb=0,
                ))
                continue

            rec_info = self._check_channel_recordings(
                ch_info.channel_number,
                start_time,
                end_time,
                display_number=ch_info.display_number,
                is_online=ch_info.is_online,
                channel_type=ch_info.channel_type,
            )
            results.append(rec_info)

        return results

    def _check_channel_recordings(
        self,
        channel: int,
        start: datetime,
        end: datetime,
        display_number: int = 0,
        is_online: bool = True,
        channel_type: str = "unknown",
    ) -> RecordingInfo:
        """Проверить записи для одного канала."""
        find_cond = NET_DVR_FILECOND_V40()
        find_cond.lChannel = channel
        find_cond.dwFileType = 0xff
        find_cond.dwIsLocked = 0xff
        find_cond.dwUseCardNo = 0
        find_cond.struStartTime = NET_DVR_TIME.from_datetime(start)
        find_cond.struStopTime = NET_DVR_TIME.from_datetime(end)

        find_handle = self.sdk.NET_DVR_FindFile_V40(
            self.user_id,
            byref(find_cond)
        )

        if find_handle < 0:
            return RecordingInfo(
                channel_number=channel,
                display_number=display_number,
                channel_type=channel_type,
                is_configured=True,
                is_online=is_online,
                has_recordings=False,
                files_count=0,
                total_size_gb=0,
            )

        files_count = 0
        total_size = 0
        oldest_time = None
        newest_time = None

        find_data = NET_DVR_FINDDATA_V40()

        while True:
            result = self.sdk.NET_DVR_FindNextFile_V40(
                find_handle,
                byref(find_data)
            )

            if result == 1000:  # NET_DVR_FILE_SUCCESS
                files_count += 1
                total_size += find_data.dwFileSize

                file_start = find_data.struStartTime.to_datetime()
                file_stop = find_data.struStopTime.to_datetime()

                if oldest_time is None or file_start < oldest_time:
                    oldest_time = file_start
                if newest_time is None or file_stop > newest_time:
                    newest_time = file_stop

            elif result == 1002:  # NET_DVR_ISFINDING
                continue
            else:
                break

        self.sdk.NET_DVR_FindClose_V30(find_handle)

        return RecordingInfo(
            channel_number=channel,
            display_number=display_number,
            channel_type=channel_type,
            is_configured=True,
            is_online=is_online,
            has_recordings=files_count > 0,
            files_count=files_count,
            total_size_gb=round(total_size / (1024 * 1024 * 1024), 2),
            oldest_record=oldest_time,
            newest_record=newest_time,
        )

    # ========================================================================
    # DEVICE INFO (ISAPI)
    # ========================================================================

    def get_device_info_isapi_sync(self) -> Dict[str, Optional[str]]:
        """
        Get device info via ISAPI /System/deviceInfo endpoint.

        Returns human-readable model name, device name, firmware version, MAC address.
        Uses SDK's NET_DVR_STDXMLConfig for tunneled ISAPI requests.

        Returns:
            Dict with keys: model, device_name, firmware_version, mac_address
        """
        self._manager._ensure_connected()

        result: Dict[str, Optional[str]] = {
            'model': None,
            'device_name': None,
            'firmware_version': None,
            'mac_address': None,
        }

        try:
            url = b"GET /ISAPI/System/deviceInfo\r\n"
            url_buffer = create_string_buffer(url)
            out_buffer = create_string_buffer(16384)  # Larger buffer for device info
            status_buffer = create_string_buffer(2048)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = None
            input_param.dwInBufferSize = 0
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 16384
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 2048

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if ret:
                xml_data = out_buffer.value.decode('utf-8', errors='ignore')
                logger.debug(f"ISAPI deviceInfo response: {xml_data[:500]}")

                # Parse XML fields with regex (handles namespaces)
                def find_tag(tag_names: List[str]) -> Optional[str]:
                    for tag in tag_names:
                        match = re.search(rf'<{tag}>([^<]+)</{tag}>', xml_data, re.IGNORECASE)
                        if match:
                            return match.group(1).strip()
                    return None

                result['model'] = find_tag(['model', 'Model'])
                result['device_name'] = find_tag(['deviceName', 'DeviceName'])
                result['firmware_version'] = find_tag(['firmwareVersion', 'FirmwareVersion'])
                result['mac_address'] = find_tag(['macAddress', 'MACAddress', 'macAdress'])

                logger.info(f"ISAPI deviceInfo: model={result['model']}, "
                           f"device_name={result['device_name']}, "
                           f"firmware={result['firmware_version']}")
            else:
                error_code = self._manager.get_last_error()
                logger.warning(f"ISAPI deviceInfo request failed: error {error_code}")

        except Exception as e:
            logger.warning(f"Failed to get ISAPI device info: {e}")

        return result

    # ========================================================================
    # TIME MANAGEMENT (ISAPI)
    # ========================================================================

    def get_time_info_sync(self) -> TimeInfo:
        """
        Получить время устройства через ISAPI (синхронно).

        ISAPI endpoint: GET /ISAPI/System/time

        Returns:
            TimeInfo с временем устройства, сервера и drift
        """
        self._manager._ensure_connected()

        server_time = datetime.now()
        device_time = server_time  # Default fallback
        timezone = ""
        time_mode = ""
        dst_enabled = False
        sync_status = "error"

        try:
            url = b"GET /ISAPI/System/time\r\n"
            url_buffer = create_string_buffer(url)
            out_buffer = create_string_buffer(8192)
            status_buffer = create_string_buffer(2048)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = None
            input_param.dwInBufferSize = 0
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 8192
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 2048

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if ret:
                xml_data = out_buffer.value.decode('utf-8', errors='ignore')
                logger.debug(f"Time ISAPI response: {xml_data[:500]}")

                # Парсим localTime (формат: 2026-01-16T12:30:45+03:00 или 2026-01-16T12:30:45)
                local_time_match = re.search(
                    r'<localTime>([^<]+)</localTime>',
                    xml_data, re.IGNORECASE
                )
                if local_time_match:
                    time_str = local_time_match.group(1)
                    # Убираем timezone offset для парсинга
                    time_str_clean = re.sub(r'[+-]\d{2}:\d{2}$', '', time_str)
                    try:
                        device_time = datetime.fromisoformat(time_str_clean)
                    except ValueError:
                        # Пробуем альтернативный формат
                        try:
                            device_time = datetime.strptime(time_str_clean, '%Y-%m-%dT%H:%M:%S')
                        except ValueError:
                            logger.warning(f"Cannot parse device time: {time_str}")

                # Парсим timeZone
                tz_match = re.search(r'<timeZone>([^<]+)</timeZone>', xml_data, re.IGNORECASE)
                if tz_match:
                    timezone = tz_match.group(1)

                # Парсим timeMode (manual/NTP)
                mode_match = re.search(r'<timeMode>([^<]+)</timeMode>', xml_data, re.IGNORECASE)
                if mode_match:
                    time_mode = mode_match.group(1)

                # Парсим DST
                dst_match = re.search(r'<daylightSavingTime>([^<]+)</daylightSavingTime>', xml_data, re.IGNORECASE)
                if dst_match:
                    dst_enabled = dst_match.group(1).lower() == 'true'

                sync_status = "ok"
            else:
                error_code = self._manager.get_last_error()
                logger.warning(f"ISAPI time request failed: error {error_code}")

        except Exception as e:
            logger.error(f"Failed to get device time: {e}")

        # Вычисляем drift
        drift_seconds = int((device_time - server_time).total_seconds())

        # Определяем статус синхронизации
        if sync_status == "ok":
            if abs(drift_seconds) <= 30:
                sync_status = "ok"
            else:
                sync_status = "drift"

        return TimeInfo(
            device_time=device_time,
            server_time=server_time,
            drift_seconds=drift_seconds,
            timezone=timezone,
            time_mode=time_mode,
            dst_enabled=dst_enabled,
            sync_status=sync_status,
        )

    def set_time_sync(self, target_time: datetime = None) -> bool:
        """
        Установить время на устройстве через ISAPI (синхронно).

        ISAPI endpoint: PUT /ISAPI/System/time

        Args:
            target_time: Целевое время. Если None - используется текущее время сервера.

        Returns:
            True если успешно установлено
        """
        self._manager._ensure_connected()

        if target_time is None:
            target_time = datetime.now()

        # Формируем XML для PUT запроса
        time_str = target_time.strftime('%Y-%m-%dT%H:%M:%S')
        xml_body = f'''<?xml version="1.0" encoding="UTF-8"?>
<Time>
<timeMode>manual</timeMode>
<localTime>{time_str}</localTime>
</Time>'''

        try:
            url = b"PUT /ISAPI/System/time\r\n"
            url_buffer = create_string_buffer(url)
            body_bytes = xml_body.encode('utf-8')
            body_buffer = create_string_buffer(body_bytes)
            out_buffer = create_string_buffer(4096)
            status_buffer = create_string_buffer(2048)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = cast(body_buffer, c_void_p)
            input_param.dwInBufferSize = len(body_bytes)
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 4096
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 2048

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if ret:
                logger.info(f"Device time set to: {time_str}")
                return True
            else:
                error_code = self._manager.get_last_error()
                logger.error(f"Failed to set device time: error {error_code}")
                return False

        except Exception as e:
            logger.error(f"Exception setting device time: {e}")
            return False

    def sync_time_sync(self, threshold_seconds: int = 30) -> Tuple[bool, TimeInfo]:
        """
        Синхронизировать время если drift превышает порог (синхронно).

        Args:
            threshold_seconds: Порог в секундах для срабатывания синхронизации

        Returns:
            Tuple (была_ли_синхронизация, TimeInfo)
        """
        time_info = self.get_time_info_sync()
        original_drift = time_info.drift_seconds

        if abs(time_info.drift_seconds) > threshold_seconds:
            success = self.set_time_sync()
            if success:
                # Перечитываем время после синхронизации
                time_info = self.get_time_info_sync()
                time_info.sync_status = "synced"
                logger.info(f"Time synchronized. Original drift: {original_drift}s, new drift: {time_info.drift_seconds}s")
            else:
                time_info.sync_status = "error"
            return (True, time_info)

        return (False, time_info)

    # ========================================================================
    # NETWORK INTERFACES (ISAPI)
    # ========================================================================

    def get_network_interfaces_sync(self) -> List[Dict[str, Any]]:
        """
        Get NVR network interface configuration via ISAPI.

        ISAPI endpoint: GET /ISAPI/System/Network/interfaces

        Returns a list of network interfaces with their IP addresses.
        This is the HOST IP of the NVR itself, not the connected cameras.

        Returns:
            List of dicts with keys: id, ip_address, subnet_mask, mac_address, is_dhcp
        """
        self._manager._ensure_connected()

        interfaces = []

        try:
            url = b"GET /ISAPI/System/Network/interfaces\r\n"
            url_buffer = create_string_buffer(url)
            out_buffer = create_string_buffer(32768)  # Large buffer for multiple interfaces
            status_buffer = create_string_buffer(2048)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = None
            input_param.dwInBufferSize = 0
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 32768
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 2048

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if ret:
                xml_data = out_buffer.value.decode('utf-8', errors='ignore')
                # Log full response for debugging network interface issues
                logger.info(f"ISAPI /System/Network/interfaces response length: {len(xml_data)}")
                # Log more of the response for debugging
                logger.info(f"ISAPI network interfaces XML: {xml_data[:3000]}")

                # Parse NetworkInterface blocks
                interface_blocks = re.findall(
                    r'<NetworkInterface[^>]*>(.*?)</NetworkInterface>',
                    xml_data, re.DOTALL | re.IGNORECASE
                )

                logger.info(f"Found {len(interface_blocks)} NetworkInterface blocks in XML")

                for i, block in enumerate(interface_blocks):
                    interface_id = str(i + 1)

                    # Get interface ID
                    id_match = re.search(r'<id>(\d+)</id>', block)
                    if id_match:
                        interface_id = id_match.group(1)

                    # Get IP address from IPAddress block
                    ip_address = ""
                    ip_block_match = re.search(
                        r'<IPAddress[^>]*>(.*?)</IPAddress>',
                        block, re.DOTALL | re.IGNORECASE
                    )
                    if ip_block_match:
                        ip_block = ip_block_match.group(1)
                        ip_match = re.search(r'<ipAddress>([^<]+)</ipAddress>', ip_block)
                        if ip_match:
                            ip_address = ip_match.group(1)

                    logger.info(f"Interface {interface_id}: IP from IPAddress block = '{ip_address}'")

                    # Skip empty IPs
                    if not ip_address or ip_address == "0.0.0.0":
                        logger.info(f"Interface {interface_id}: Skipping empty/zero IP")
                        continue

                    # Get subnet mask
                    subnet_mask = ""
                    subnet_match = re.search(r'<subnetMask>([^<]+)</subnetMask>', block)
                    if subnet_match:
                        subnet_mask = subnet_match.group(1)

                    # Get MAC address
                    mac_address = ""
                    mac_match = re.search(r'<MACAddress>([^<]+)</MACAddress>', block)
                    if mac_match:
                        mac_address = mac_match.group(1)

                    # Check if DHCP is enabled
                    is_dhcp = False
                    dhcp_match = re.search(r'<addressingType>([^<]+)</addressingType>', block)
                    if dhcp_match:
                        is_dhcp = dhcp_match.group(1).lower() == 'dynamic'

                    interfaces.append({
                        "id": interface_id,
                        "ip_address": ip_address,
                        "subnet_mask": subnet_mask,
                        "mac_address": mac_address,
                        "is_dhcp": is_dhcp,
                    })
                    logger.info(f"Added interface {interface_id}: {ip_address} (mask={subnet_mask}, mac={mac_address})")

                logger.info(f"Total valid interfaces found via ISAPI: {len(interfaces)}")

            else:
                error_code = self._manager.get_last_error()
                logger.warning(f"ISAPI network interfaces request failed: error {error_code}")

        except Exception as e:
            logger.warning(f"Failed to get network interfaces via ISAPI: {e}")

        return interfaces

    def get_primary_nic_ip_sync(self) -> Optional[str]:
        """
        Get the primary NIC (NIC 1) IP address directly via ISAPI.

        ISAPI endpoint: GET /ISAPI/System/Network/interfaces/1

        Returns:
            IP address of NIC 1, or None if request fails
        """
        self._manager._ensure_connected()

        try:
            url = b"GET /ISAPI/System/Network/interfaces/1\r\n"
            url_buffer = create_string_buffer(url)
            out_buffer = create_string_buffer(8192)
            status_buffer = create_string_buffer(2048)

            input_param = NET_DVR_XML_CONFIG_INPUT()
            input_param.dwSize = sizeof(input_param)
            input_param.lpRequestUrl = cast(url_buffer, c_void_p)
            input_param.dwRequestUrlLen = len(url)
            input_param.lpInBuffer = None
            input_param.dwInBufferSize = 0
            input_param.dwRecvTimeOut = 10000

            output_param = NET_DVR_XML_CONFIG_OUTPUT()
            output_param.dwSize = sizeof(output_param)
            output_param.lpOutBuffer = cast(out_buffer, c_void_p)
            output_param.dwOutBufferSize = 8192
            output_param.lpStatusBuffer = cast(status_buffer, c_void_p)
            output_param.dwStatusSize = 2048

            ret = self.sdk.NET_DVR_STDXMLConfig(
                self.user_id,
                byref(input_param),
                byref(output_param)
            )

            if ret:
                xml_data = out_buffer.value.decode('utf-8', errors='ignore')
                logger.info(f"ISAPI /System/Network/interfaces/1 response: {xml_data[:1500]}")

                # Parse IP address
                ip_match = re.search(r'<ipAddress>([^<]+)</ipAddress>', xml_data)
                if ip_match:
                    ip = ip_match.group(1)
                    logger.info(f"Primary NIC 1 IP: {ip}")
                    return ip

            else:
                error_code = self._manager.get_last_error()
                logger.warning(f"ISAPI /interfaces/1 request failed: error {error_code}")

        except Exception as e:
            logger.warning(f"Failed to get primary NIC IP: {e}")

        return None

    def get_nvr_lan_ips_sync(self) -> List[str]:
        """
        Get the NVR's own LAN IP addresses (not camera IPs).

        Strategy:
        1. First try to get primary NIC (interface 1) directly
        2. If that fails, get all interfaces and filter

        Filters out:
        - PoE internal network IPs (192.168.254.x) - used for PoE camera connections
        - 0.0.0.0 and empty addresses

        Prioritizes interface with id=1 (primary LAN port).

        Returns:
            List of NVR LAN IP addresses, sorted by interface ID (primary first)
        """
        # Strategy 1: Try to get NIC 1 directly (most reliable)
        primary_ip = self.get_primary_nic_ip_sync()
        if primary_ip and not primary_ip.startswith("192.168.254.") and primary_ip != "0.0.0.0":
            logger.info(f"Using primary NIC 1 IP: {primary_ip}")
            return [primary_ip]

        # Strategy 2: Fall back to getting all interfaces
        logger.info("Primary NIC request failed, trying all interfaces...")
        interfaces = self.get_network_interfaces_sync()

        logger.info(f"Raw interfaces from ISAPI: {interfaces}")

        # If ISAPI returned no interfaces, return empty list
        # The caller (hybrid_probe.py) will fall back to camera IPs
        if not interfaces:
            logger.warning("ISAPI returned no network interfaces")
            return []

        # Sort interfaces by ID to ensure NIC 1 comes first
        # Interface ID 1 is typically the primary LAN port
        interfaces.sort(key=lambda x: int(x.get("id", "999")))

        logger.info(f"Sorted interfaces by ID: {interfaces}")

        valid_ips = []
        for iface in interfaces:
            ip = iface.get("ip_address", "")
            iface_id = iface.get("id", "?")

            if not ip:
                logger.info(f"Interface {iface_id}: empty IP, skipping")
                continue

            # Filter out PoE internal network (192.168.254.x)
            # This is the internal network used for PoE camera connections
            if ip.startswith("192.168.254."):
                logger.info(f"Filtering out PoE internal IP from NIC {iface_id}: {ip}")
                continue

            # Filter out loopback and empty
            if ip.startswith("127.") or ip == "0.0.0.0":
                logger.info(f"Filtering out loopback/zero IP from NIC {iface_id}: {ip}")
                continue

            logger.info(f"Valid LAN IP from NIC {iface_id}: {ip}")
            valid_ips.append(ip)

        logger.info(f"All valid LAN IPs after filtering: {valid_ips}")

        # Return only the first valid IP (primary LAN interface = NIC 1)
        # NIC 1 is the main LAN port, NIC 2+ are secondary (e.g., PoE management)
        if len(valid_ips) > 1:
            logger.info(f"Multiple LAN IPs found: {valid_ips}, returning only NIC 1: {valid_ips[0]}")
            return [valid_ips[0]]  # Only return the primary interface IP

        return valid_ips

    # ========================================================================
    # SNAPSHOT CAPTURE (SDK)
    # ========================================================================

    def _resolve_sdk_channel(self, channel_display_number: int) -> int:
        """
        Map a display channel number (1-based) to the actual SDK channel number.

        DVR (analog-only): SDK channel = byStartChan + display - 1 (usually 1-based)
        NVR (IP channels):  SDK channel = byStartDChan + display - 1 (usually 33-based)
        Hybrid (both):      analog range first, then IP range
        """
        dev = self.device_info.struDeviceV30
        analog_count = dev.byChanNum
        ip_count = dev.byIPChanNum + (dev.byHighDChanNum << 8)

        if ip_count > 0 and analog_count == 0:
            # Pure NVR — only IP channels
            start_dchan = dev.byStartDChan if dev.byStartDChan > 0 else 33
            return start_dchan + channel_display_number - 1
        elif analog_count > 0 and ip_count == 0:
            # Pure DVR — only analog channels
            start_chan = dev.byStartChan if dev.byStartChan > 0 else 1
            return start_chan + channel_display_number - 1
        elif analog_count > 0 and ip_count > 0:
            # Hybrid device — analog channels listed first, then IP
            if channel_display_number <= analog_count:
                start_chan = dev.byStartChan if dev.byStartChan > 0 else 1
                return start_chan + channel_display_number - 1
            else:
                # IP channel: display_number beyond analog range
                ip_display = channel_display_number - analog_count
                start_dchan = dev.byStartDChan if dev.byStartDChan > 0 else 33
                return start_dchan + ip_display - 1
        else:
            # Fallback: assume IP channels starting at 33
            return 33 + channel_display_number - 1

    def get_snapshot_sync(self, channel_display_number: int) -> Tuple[bool, Optional[bytes], str]:
        """
        Получить снимок (snapshot) с канала через SDK (синхронно).

        Использует NET_DVR_CaptureJPEGPicture_NEW для получения JPEG в память.

        Args:
            channel_display_number: Номер канала для отображения (1-based)

        Returns:
            Tuple (успех, bytes изображения или None, сообщение об ошибке)
        """
        self._manager._ensure_connected()

        dev = self.device_info.struDeviceV30
        sdk_channel = self._resolve_sdk_channel(channel_display_number)

        try:
            # Настройки JPEG: автоматическое разрешение, лучшее качество
            jpeg_para = NET_DVR_JPEGPARA()
            jpeg_para.wPicSize = 0xff  # Auto - использовать разрешение текущего потока
            jpeg_para.wPicQuality = 0   # Best quality

            # Буфер для изображения (до 2 MB должно хватить)
            buffer_size = 2 * 1024 * 1024
            pic_buffer = create_string_buffer(buffer_size)
            size_returned = DWORD(0)

            # Вызываем SDK функцию
            ret = self.sdk.NET_DVR_CaptureJPEGPicture_NEW(
                self.user_id,
                sdk_channel,
                byref(jpeg_para),
                pic_buffer,
                buffer_size,
                byref(size_returned)
            )

            if ret:
                actual_size = size_returned.value
                if actual_size > 0:
                    # Извлекаем bytes изображения
                    image_data = pic_buffer.raw[:actual_size]

                    # Проверяем что это JPEG (начинается с FFD8)
                    if len(image_data) > 2 and image_data[0:2] == b'\xff\xd8':
                        logger.debug(f"Snapshot ch{channel_display_number} (sdk={sdk_channel}): {len(image_data)} bytes")
                        return (True, image_data, "")
                    else:
                        return (False, None, "Not JPEG data")
                else:
                    return (False, None, "Empty response")
            else:
                error_code = self._manager.get_last_error()
                error_msg = f"SDK error {error_code}"
                logger.warning(f"Snapshot ch{channel_display_number} (sdk={sdk_channel}) failed: {error_msg}")
                return (False, None, error_msg)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Snapshot ch{channel_display_number} (sdk={sdk_channel}) exception: {error_msg}")
            return (False, None, error_msg)

    def get_all_snapshots_sync(self, channels: List[int] = None) -> Dict[int, Tuple[bool, Optional[bytes], str]]:
        """
        Получить снимки со всех указанных каналов (синхронно).

        Args:
            channels: Список display номеров каналов (1-based). Если None - все каналы по device_info.

        Returns:
            Словарь {номер_канала: (успех, bytes, ошибка)}
        """
        if channels is None:
            dev = self.device_info.struDeviceV30
            analog_count = dev.byChanNum
            ip_count = dev.byIPChanNum + (dev.byHighDChanNum << 8)
            total = analog_count + ip_count
            if total <= 0:
                total = 16  # fallback
            channels = list(range(1, total + 1))

        results = {}
        for ch_num in channels:
            success, data, error = self.get_snapshot_sync(ch_num)
            results[ch_num] = (success, data, error)

        return results

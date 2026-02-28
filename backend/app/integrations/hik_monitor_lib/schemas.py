"""
Hikvision Monitor Library - Data Schemas
=========================================
Dataclass schemas for JSON API and data transfer.
"""

from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import IntEnum


# ============================================================================
# ENUMS
# ============================================================================

class HDStatus(IntEnum):
    """Статус жёсткого диска (SDK)"""
    NORMAL = 0
    UNFORMATTED = 1
    ERROR = 2
    SMART_FAILED = 3
    NOT_MATCH = 4
    SLEEPING = 5
    NOT_ONLINE = 6
    NOT_EXIST = 7
    LOCKED = 10
    UNMOUNTED = 11
    LOCKED_OR_IO_ERR = 12
    CAPACITY_LIMIT = 17
    WARNING = 18
    BAD = 19


class HDType(IntEnum):
    """Тип жёсткого диска"""
    READ_WRITE = 1
    READ_ONLY = 2
    REDUNDANT = 3


class ChannelType(IntEnum):
    """Тип канала"""
    ANALOG = 0
    IP = 1


# ============================================================================
# HDD DATA CLASSES
# ============================================================================

@dataclass
class HddInfo:
    """Информация о жёстком диске для CRM.

    S.M.A.R.T. данные получаем через ISAPI:
    - Общий статус SMART (Pass/Fail/Warning) - из selfEvaluaingStatus/allEvaluaingStatus
    - Power-on Hours (наработка) - из SMART атрибута ID 9 (rawValue)
    - Температура - из тега temprature или атрибута ID 194
    """
    number: int                     # Номер диска (1-based, как в веб-интерфейсе)
    capacity_gb: float              # Объём (ГБ)
    free_space_gb: float            # Свободно (ГБ)
    used_percent: float             # Использовано (%)
    status: str                     # Статус (текст)
    status_code: int                # Статус (код)
    hdd_type: str                   # Тип диска (read/write, read-only, redundant)
    type_code: int                  # Код типа
    is_recycling: bool              # Перезапись включена
    model: str = ""                 # Модель диска
    supplier: str = ""              # Производитель
    location: str = ""              # Расположение (слот)
    smart_status: Optional[str] = None  # Статус S.M.A.R.T. (Pass/Fail/Warning) - None если не поддерживается
    power_on_hours: Optional[int] = None  # Наработка в часах (SMART ID 9) - None если не поддерживается
    temperature: Optional[int] = None     # Температура (SMART ID 194) - None если не поддерживается
    reallocated_sectors: Optional[int] = None  # Переназначенные сектора (SMART ID 5) - None если не поддерживается
    is_critical: bool = False       # Критическая ошибка - требуется замена

    def to_dict(self) -> Dict[str, Any]:
        """Преобразование в словарь для JSON."""
        return asdict(self)


@dataclass
class SmartAttribute:
    """Атрибут S.M.A.R.T."""
    id: int
    name: str
    current_value: int
    worst_value: int
    threshold: int
    raw_value: int
    status: str  # Pass/Fail/Warning


@dataclass
class SmartInfo:
    """Полная информация S.M.A.R.T. диска."""
    disk_number: int
    overall_status: str  # Pass/Fail/Warning
    self_test_status: str
    temperature: int
    power_on_hours: int
    attributes: List[SmartAttribute] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "disk_number": self.disk_number,
            "overall_status": self.overall_status,
            "self_test_status": self.self_test_status,
            "temperature": self.temperature,
            "power_on_hours": self.power_on_hours,
            "attributes": [asdict(a) for a in self.attributes]
        }


# ============================================================================
# TIME DATA CLASSES
# ============================================================================

@dataclass
class TimeInfo:
    """Информация о времени устройства.

    Используется для синхронизации времени между сервером и NVR/DVR.
    Получается через ISAPI: GET /ISAPI/System/time
    """
    device_time: datetime           # Время на устройстве
    server_time: datetime           # Время сервера при запросе
    drift_seconds: int              # Разница в секундах (device - server)
    timezone: str = ""              # Часовой пояс устройства (например "CST-3:00:00")
    time_mode: str = ""             # Режим времени (manual/NTP)
    dst_enabled: bool = False       # DST включён
    sync_status: str = "unknown"    # ok / drift / synced / error

    def to_dict(self) -> Dict[str, Any]:
        """Преобразование в словарь для JSON."""
        return {
            "device_time": self.device_time.isoformat(),
            "server_time": self.server_time.isoformat(),
            "drift_seconds": self.drift_seconds,
            "timezone": self.timezone,
            "time_mode": self.time_mode,
            "dst_enabled": self.dst_enabled,
            "sync_status": self.sync_status,
        }


# ============================================================================
# CHANNEL DATA CLASSES
# ============================================================================

@dataclass
class ChannelInfo:
    """Информация о канале для CRM."""
    channel_number: int             # Номер канала (внутренний SDK, 33+)
    display_number: int             # Номер для отображения (D1-D16)
    channel_type: str               # Тип: analog/ip
    is_configured: bool             # Канал настроен (False = слот пустой)
    is_online: bool                 # В сети
    ip_address: str = ""            # IP (для IP камер)
    protocol: str = ""              # Протокол подключения
    is_recording: bool = False      # Запись активна
    has_signal: bool = False        # Есть сигнал
    bitrate_kbps: int = 0           # Битрейт (kbps)
    connected_clients: int = 0      # Подключённых клиентов
    offline_reason: str = ""        # Причина offline (Video Loss и т.д.)

    def to_dict(self) -> Dict[str, Any]:
        """Преобразование в словарь для JSON."""
        return asdict(self)


@dataclass
class RecordingInfo:
    """Информация о записях за период."""
    channel_number: int             # Внутренний номер канала
    display_number: int             # Номер для отображения (D1-D16)
    channel_type: str               # Тип канала (analog/ip)
    is_configured: bool             # Канал настроен
    is_online: bool                 # Камера онлайн при проверке
    has_recordings: bool            # Есть записи за период
    files_count: int                # Количество файлов
    total_size_gb: float            # Общий размер (ГБ)
    oldest_record: Optional[datetime] = None
    newest_record: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Преобразование в словарь для JSON."""
        result = asdict(self)
        # Конвертируем datetime в ISO строки
        if result["oldest_record"]:
            result["oldest_record"] = result["oldest_record"].isoformat()
        if result["newest_record"]:
            result["newest_record"] = result["newest_record"].isoformat()
        return result


# ============================================================================
# DEVICE DATA CLASSES
# ============================================================================

@dataclass
class DeviceInfo:
    """Базовая информация об устройстве."""
    serial_number: str              # Серийный номер
    device_type: int                # Тип устройства (код)
    device_type_name: str           # Название типа
    firmware_version: str           # Версия прошивки
    analog_channels: int            # Аналоговых каналов
    ip_channels: int                # IP каналов
    disk_count: int                 # Количество дисков
    alarm_inputs: int               # Входов тревоги
    alarm_outputs: int              # Выходов тревоги
    support_features: List[str] = field(default_factory=list)
    # Fields from ISAPI /System/deviceInfo:
    model_name: Optional[str] = None      # Human-readable model (e.g., "HWN-4116MH")
    device_name: Optional[str] = None     # User-set device name
    mac_address: Optional[str] = None     # MAC address

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HealthSummary:
    """Сводка состояния устройства."""
    total_hdd: int
    healthy_hdd: int
    critical_hdd: int
    total_channels: int
    configured_channels: int
    online_channels: int
    offline_channels: int
    unconfigured_channels: int
    channels_with_recordings: int
    overall_status: str  # healthy/warning/critical

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ============================================================================
# SYNC DATA - MAIN OUTPUT STRUCTURE
# ============================================================================

@dataclass
class SyncData:
    """Полная структура данных для синхронизации с CRM.

    Это основной класс, возвращаемый методом get_sync_data().
    Содержит всю информацию об устройстве для записи в БД.
    """
    device: DeviceInfo
    hdd_list: List[HddInfo]
    channels: List[ChannelInfo]
    recordings: List[RecordingInfo]
    health_summary: HealthSummary
    timestamp: datetime
    time_info: Optional[TimeInfo] = None  # Информация о времени устройства

    def to_dict(self) -> Dict[str, Any]:
        """Преобразование в словарь для JSON/БД."""
        result = {
            "device": self.device.to_dict(),
            "hdd_list": [h.to_dict() for h in self.hdd_list],
            "channels": [c.to_dict() for c in self.channels],
            "recordings": [r.to_dict() for r in self.recordings],
            "health_summary": self.health_summary.to_dict(),
            "timestamp": self.timestamp.isoformat()
        }
        if self.time_info:
            result["time_info"] = self.time_info.to_dict()
        return result

    def to_json(self) -> str:
        """Преобразование в JSON строку."""
        import json
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)


# ============================================================================
# DEVICE TYPE MAPPING
# ============================================================================

DEVICE_TYPES = {
    1: "DVR",
    2: "ATM DVR",
    3: "DVS",
    4: "Decoder",
    5: "DVR (5)",
    6: "DS-6001D/F",
    7: "DS-6001VS",
    8: "DS-6002MD",
    9: "DS-6101HF/L",
    10: "DS-6001HF/A/AF",
    14: "Encoder Card",
    15: "Decoder Card",
    16: "NVR",
    17: "PCNVR",
    18: "Embedded NVR",
    24: "IP Camera",
}


def get_device_type_name(device_type: int) -> str:
    """Получить название типа устройства по коду."""
    return DEVICE_TYPES.get(device_type, f"Unknown ({device_type})")

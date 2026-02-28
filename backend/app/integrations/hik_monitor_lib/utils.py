"""
Hikvision Monitor Library - Utilities
=====================================
XML parsing, Markdown report generation, and helper functions.
"""

import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from .schemas import DeviceInfo, HddInfo, ChannelInfo, RecordingInfo, HealthSummary, SyncData

logger = logging.getLogger(__name__)


# ============================================================================
# XML PARSER
# ============================================================================

class XmlParser:
    """Парсер XML ответов ISAPI."""

    @staticmethod
    def extract_value(xml: str, tag: str) -> Optional[str]:
        """
        Извлечь значение тега из XML.

        Args:
            xml: XML строка
            tag: Имя тега

        Returns:
            Значение тега или None
        """
        match = re.search(rf'<{tag}>([^<]+)</{tag}>', xml, re.IGNORECASE)
        return match.group(1) if match else None

    @staticmethod
    def extract_value_with_attrs(xml: str, tag: str) -> Optional[str]:
        """
        Извлечь значение тега с атрибутами.

        Args:
            xml: XML строка
            tag: Имя тега (без атрибутов)

        Returns:
            Значение тега или None
        """
        match = re.search(rf'<{tag}[^>]*>([^<]+)</{tag}>', xml, re.IGNORECASE)
        return match.group(1) if match else None

    @staticmethod
    def extract_blocks(xml: str, tag: str) -> List[str]:
        """
        Извлечь все блоки с указанным тегом.

        Args:
            xml: XML строка
            tag: Имя тега

        Returns:
            Список содержимого блоков
        """
        return re.findall(rf'<{tag}[^>]*>(.*?)</{tag}>', xml, re.DOTALL | re.IGNORECASE)

    @staticmethod
    def extract_int(xml: str, tag: str, default: int = 0) -> int:
        """
        Извлечь целочисленное значение тега.

        Args:
            xml: XML строка
            tag: Имя тега
            default: Значение по умолчанию

        Returns:
            Целое число или default
        """
        value = XmlParser.extract_value(xml, tag)
        if value:
            try:
                return int(value)
            except ValueError:
                pass
        return default

    @staticmethod
    def extract_bool(xml: str, tag: str, default: bool = False) -> bool:
        """
        Извлечь булево значение тега.

        Args:
            xml: XML строка
            tag: Имя тега
            default: Значение по умолчанию

        Returns:
            True/False или default
        """
        value = XmlParser.extract_value(xml, tag)
        if value:
            return value.lower() in ("true", "1", "yes", "on")
        return default


# ============================================================================
# MARKDOWN REPORT GENERATOR
# ============================================================================

class MarkdownReportGenerator:
    """Генератор отчётов в формате Markdown."""

    def __init__(self):
        self.lines = []

    def add_header(self, text: str, level: int = 1):
        """Добавить заголовок."""
        self.lines.append(f"{'#' * level} {text}\n")

    def add_paragraph(self, text: str):
        """Добавить параграф."""
        self.lines.append(f"{text}\n")

    def add_separator(self):
        """Добавить разделитель."""
        self.lines.append("---\n")

    def add_table(self, headers: List[str], rows: List[List[Any]]):
        """
        Добавить таблицу.

        Args:
            headers: Список заголовков столбцов
            rows: Список строк (каждая строка - список значений)
        """
        if not headers or not rows:
            return

        self.lines.append("| " + " | ".join(str(h) for h in headers) + " |")
        self.lines.append("| " + " | ".join("---" for _ in headers) + " |")
        for row in rows:
            self.lines.append("| " + " | ".join(str(v) for v in row) + " |")
        self.lines.append("")

    def add_key_value(self, key: str, value: Any):
        """Добавить пару ключ-значение."""
        self.lines.append(f"- **{key}:** {value}")

    def add_code_block(self, code: str, language: str = ""):
        """Добавить блок кода."""
        self.lines.append(f"```{language}")
        self.lines.append(code)
        self.lines.append("```\n")

    def add_newline(self):
        """Добавить пустую строку."""
        self.lines.append("")

    def get_content(self) -> str:
        """Получить итоговый контент."""
        return "\n".join(self.lines)

    def save(self, filepath: str):
        """Сохранить отчёт в файл."""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.get_content())


def generate_report(sync_data: SyncData) -> MarkdownReportGenerator:
    """
    Генерирует полный Markdown отчёт из данных синхронизации.

    Args:
        sync_data: Данные синхронизации

    Returns:
        MarkdownReportGenerator с готовым отчётом
    """
    report = MarkdownReportGenerator()

    # Заголовок
    report.add_header("Отчёт о состоянии устройства Hikvision")
    report.add_paragraph(f"Дата: {sync_data.timestamp.strftime('%d.%m.%Y %H:%M:%S')}")
    report.add_newline()

    # Информация об устройстве
    device = sync_data.device
    report.add_header("Информация об устройстве", level=2)
    report.add_key_value("Серийный номер", device.serial_number)
    report.add_key_value("Тип устройства", device.device_type_name)
    report.add_key_value("Аналоговых каналов", device.analog_channels)
    report.add_key_value("IP каналов", device.ip_channels)
    report.add_key_value("Дисков", device.disk_count)
    report.add_newline()

    # Состояние здоровья
    health = sync_data.health_summary
    status_emoji = {
        "healthy": "✅",
        "warning": "⚠️",
        "critical": "❌",
    }
    emoji = status_emoji.get(health.overall_status, "❓")
    report.add_header(f"Состояние системы {emoji}", level=2)
    report.add_key_value("Общий статус", health.overall_status.upper())
    report.add_key_value("HDD", f"{health.healthy_hdd}/{health.total_hdd} в норме")
    if health.critical_hdd > 0:
        report.add_key_value("Критические HDD", f"{health.critical_hdd}")
    report.add_key_value("Каналы онлайн", f"{health.online_channels}/{health.configured_channels}")
    if health.unconfigured_channels > 0:
        report.add_key_value("Не настроено", f"{health.unconfigured_channels}")
    report.add_newline()

    # Таблица HDD
    if sync_data.hdd_list:
        report.add_header("Жёсткие диски", level=2)
        hdd_headers = ["#", "Объём", "Свободно", "Занято", "Статус", "SMART", "Наработка"]
        hdd_rows = []
        for hdd in sync_data.hdd_list:
            status_mark = "❌" if hdd.is_critical else "✅"
            hours = f"{hdd.power_on_hours} ч" if hdd.power_on_hours > 0 else "-"
            hdd_rows.append([
                hdd.number,
                f"{hdd.capacity_gb:.1f} GB",
                f"{hdd.free_space_gb:.1f} GB",
                f"{hdd.used_percent:.1f}%",
                f"{status_mark} {hdd.status}",
                hdd.smart_status or "-",
                hours,
            ])
        report.add_table(hdd_headers, hdd_rows)

    # Таблица каналов
    if sync_data.channels:
        report.add_header("Каналы", level=2)
        ch_headers = ["Канал", "Тип", "IP", "Статус", "Записи"]
        ch_rows = []

        # Создаём словарь записей по channel_number
        rec_by_channel = {r.channel_number: r for r in sync_data.recordings}

        for ch in sync_data.channels:
            if ch.channel_type == "ip":
                ch_name = f"D{ch.display_number}"
            else:
                ch_name = f"A{ch.display_number}"

            if not ch.is_configured:
                status = "⚪ Не настроен"
            elif ch.is_online:
                status = "🟢 Онлайн"
            else:
                status = "🔴 Оффлайн"

            rec = rec_by_channel.get(ch.channel_number)
            if rec and rec.has_recordings:
                rec_status = f"✅ {rec.files_count} файлов"
            elif ch.is_configured:
                rec_status = "❌ Нет"
            else:
                rec_status = "-"

            ch_rows.append([
                ch_name,
                ch.channel_type.upper(),
                ch.ip_address or "-",
                status,
                rec_status,
            ])

        report.add_table(ch_headers, ch_rows)

    report.add_separator()
    report.add_paragraph(f"*Сгенерировано hik_monitor_lib*")

    return report


# ============================================================================
# FORMATTING HELPERS
# ============================================================================

def format_hours(hours: int) -> str:
    """
    Форматировать часы в читаемый вид.

    Args:
        hours: Количество часов

    Returns:
        Строка вида "X лет Y дней" или "X дней Y ч"
    """
    if hours == 0:
        return "-"

    days = hours // 24
    remaining_hours = hours % 24

    if days >= 365:
        years = days // 365
        remaining_days = days % 365
        return f"{years} лет {remaining_days} дней"
    elif days > 0:
        return f"{days} дней {remaining_hours} ч"
    else:
        return f"{hours} ч"


def format_bytes(size_bytes: int) -> str:
    """
    Форматировать размер в байтах.

    Args:
        size_bytes: Размер в байтах

    Returns:
        Строка с размером (KB, MB, GB, TB)
    """
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(size_bytes) < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"


def format_timestamp(dt: Optional[datetime]) -> str:
    """
    Форматировать timestamp.

    Args:
        dt: datetime объект

    Returns:
        Строка даты/времени или "-"
    """
    if dt is None:
        return "-"
    return dt.strftime("%d.%m.%Y %H:%M")

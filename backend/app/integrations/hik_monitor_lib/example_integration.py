"""
Hikvision Monitor Library - Example CRM Integration
====================================================

This example demonstrates how to use hik_monitor_lib with SQLAlchemy
for CRM integration.

Prerequisites:
    pip install sqlalchemy aiosqlite

Usage:
    python -m hik_monitor_lib.example_integration
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

# SQLAlchemy imports
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Import from hik_monitor_lib
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hik_monitor_lib import (
    HikvisionManager,
    Device,
    HddStats,
    ChannelStats,
    SyncHistory,
    Base,
    create_tables,
    generate_report,
    SyncData,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


def save_sync_data_to_db(session: Session, sync_data: SyncData, ip: str, port: int) -> Device:
    """
    Сохранить данные синхронизации в базу данных.

    Args:
        session: SQLAlchemy session
        sync_data: Данные синхронизации
        ip: IP адрес устройства
        port: Порт устройства

    Returns:
        Объект Device
    """
    device_info = sync_data.device

    # Ищем или создаём устройство
    device = session.query(Device).filter_by(
        serial_number=device_info.serial_number
    ).first()

    if device is None:
        device = Device(serial_number=device_info.serial_number)
        session.add(device)

    # Обновляем информацию об устройстве
    device.ip_address = ip
    device.port = port
    device.device_type = device_info.device_type
    device.device_type_name = device_info.device_type_name
    device.firmware_version = device_info.firmware_version
    device.analog_channels = device_info.analog_channels
    device.ip_channels = device_info.ip_channels
    device.disk_count = device_info.disk_count
    device.alarm_inputs = device_info.alarm_inputs
    device.alarm_outputs = device_info.alarm_outputs
    device.support_features = json.dumps(device_info.support_features)
    device.is_online = True
    device.last_online = datetime.utcnow()
    device.last_sync = datetime.utcnow()
    device.overall_status = sync_data.health_summary.overall_status

    session.flush()  # Получаем device.id

    # Записываем HDD статистику
    for hdd in sync_data.hdd_list:
        hdd_stat = HddStats(
            device_id=device.id,
            disk_number=hdd.number,
            capacity_gb=hdd.capacity_gb,
            free_space_gb=hdd.free_space_gb,
            used_percent=hdd.used_percent,
            status=hdd.status,
            status_code=hdd.status_code,
            hdd_type=hdd.hdd_type,
            type_code=hdd.type_code,
            is_recycling=hdd.is_recycling,
            is_critical=hdd.is_critical,
            smart_status=hdd.smart_status,
            power_on_hours=hdd.power_on_hours,
            temperature=hdd.temperature,
            reallocated_sectors=hdd.reallocated_sectors,
            model=hdd.model,
            supplier=hdd.supplier,
            location=hdd.location,
            recorded_at=datetime.utcnow(),
        )
        session.add(hdd_stat)

    # Записываем статистику каналов
    rec_by_channel = {r.channel_number: r for r in sync_data.recordings}

    for ch in sync_data.channels:
        rec = rec_by_channel.get(ch.channel_number)

        ch_stat = ChannelStats(
            device_id=device.id,
            channel_number=ch.channel_number,
            display_number=ch.display_number,
            channel_type=ch.channel_type,
            is_configured=ch.is_configured,
            is_online=ch.is_online,
            is_recording=ch.is_recording,
            has_signal=ch.has_signal,
            ip_address=ch.ip_address,
            protocol=ch.protocol,
            bitrate_kbps=ch.bitrate_kbps,
            connected_clients=ch.connected_clients,
            offline_reason=ch.offline_reason,
            has_recordings_24h=rec.has_recordings if rec else False,
            recordings_count=rec.files_count if rec else 0,
            recordings_size_gb=rec.total_size_gb if rec else 0,
            recorded_at=datetime.utcnow(),
        )
        session.add(ch_stat)

    # Записываем историю синхронизации
    health = sync_data.health_summary
    history = SyncHistory(
        device_id=device.id,
        success=True,
        overall_status=health.overall_status,
        total_hdd=health.total_hdd,
        critical_hdd=health.critical_hdd,
        total_channels=health.total_channels,
        online_channels=health.online_channels,
        offline_channels=health.offline_channels,
        channels_with_recordings=health.channels_with_recordings,
        sync_started_at=sync_data.timestamp,
        sync_completed_at=datetime.utcnow(),
    )
    session.add(history)

    session.commit()

    logger.info(f"Saved sync data for device {device.serial_number}")
    return device


async def monitor_device(
    ip: str,
    port: int,
    username: str,
    password: str,
    db_path: str = "hikvision_crm.db",
    sdk_path: Optional[str] = None,
):
    """
    Выполнить мониторинг устройства и сохранить данные в БД.

    Args:
        ip: IP адрес устройства
        port: Порт (обычно 8000)
        username: Логин
        password: Пароль
        db_path: Путь к SQLite базе
        sdk_path: Путь к папке с SDK (опционально)
    """
    # Создаём подключение к БД
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    create_tables(engine)
    SessionLocal = sessionmaker(bind=engine)

    logger.info(f"Connecting to {ip}:{port}...")

    try:
        # Используем async context manager
        async with HikvisionManager(sdk_path=sdk_path) as manager:
            await manager.connect(ip, port, username, password)

            logger.info("Fetching device data...")
            sync_data = await manager.get_sync_data()

            # Сохраняем в БД
            with SessionLocal() as session:
                device = save_sync_data_to_db(session, sync_data, ip, port)

            # Генерируем отчёт
            report = generate_report(sync_data)
            report_path = f"report_{device.serial_number}.md"
            report.save(report_path)
            logger.info(f"Report saved to {report_path}")

            # Выводим JSON
            print("\n" + "=" * 60)
            print("SYNC DATA (JSON):")
            print("=" * 60)
            print(sync_data.to_json())

            # Выводим сводку
            health = sync_data.health_summary
            print("\n" + "=" * 60)
            print("HEALTH SUMMARY:")
            print("=" * 60)
            print(f"Status: {health.overall_status.upper()}")
            print(f"HDD: {health.healthy_hdd}/{health.total_hdd} healthy, {health.critical_hdd} critical")
            print(f"Channels: {health.online_channels}/{health.configured_channels} online")
            print(f"Recordings: {health.channels_with_recordings} channels with 24h recordings")

    except Exception as e:
        logger.error(f"Error: {e}")
        raise


def main():
    """Точка входа для примера."""
    import getpass

    print("=" * 60)
    print("HIKVISION MONITOR LIBRARY - CRM INTEGRATION EXAMPLE")
    print("=" * 60)

    # Запрашиваем параметры подключения
    ip = input("Device IP [192.168.1.64]: ").strip() or "192.168.1.64"
    port_str = input("Port [8000]: ").strip()
    port = int(port_str) if port_str else 8000
    username = input("Username [admin]: ").strip() or "admin"

    try:
        password = getpass.getpass("Password: ")
    except Exception:
        password = input("Password: ")

    # Путь к SDK (можно оставить пустым для автопоиска)
    sdk_path_input = input("SDK path (leave empty for auto-detect): ").strip()
    sdk_path = sdk_path_input if sdk_path_input else None

    # Если SDK path не указан, пробуем найти рядом
    if sdk_path is None:
        lib_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lib")
        if os.path.exists(os.path.join(lib_path, "HCNetSDK.dll")):
            sdk_path = lib_path
            print(f"Found SDK at: {sdk_path}")

    print()
    asyncio.run(monitor_device(ip, port, username, password, sdk_path=sdk_path))


if __name__ == "__main__":
    main()

"""
Hikvision Monitor Library - SQLAlchemy Models
==============================================
ORM models for storing device monitoring data in a database.
Compatible with SQLite, PostgreSQL, MySQL and other SQLAlchemy-supported databases.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Device(Base):
    """
    Hikvision устройство (NVR/DVR).

    Хранит основную информацию об устройстве и связи с его статистикой.
    """
    __tablename__ = "hikvision_devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    serial_number = Column(String(64), unique=True, index=True, nullable=False)
    ip_address = Column(String(64), nullable=True)
    port = Column(Integer, default=8000)
    device_type = Column(Integer, nullable=True)
    device_type_name = Column(String(32), nullable=True)
    firmware_version = Column(String(64), nullable=True)
    analog_channels = Column(Integer, default=0)
    ip_channels = Column(Integer, default=0)
    disk_count = Column(Integer, default=0)
    alarm_inputs = Column(Integer, default=0)
    alarm_outputs = Column(Integer, default=0)
    support_features = Column(Text, nullable=True)  # JSON array

    # Статус устройства
    is_online = Column(Boolean, default=False)
    last_online = Column(DateTime, nullable=True)
    last_sync = Column(DateTime, nullable=True)
    overall_status = Column(String(16), default="unknown")  # healthy/warning/critical/unknown

    # Метаданные
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    hdd_stats = relationship("HddStats", back_populates="device", cascade="all, delete-orphan")
    channel_stats = relationship("ChannelStats", back_populates="device", cascade="all, delete-orphan")
    sync_history = relationship("SyncHistory", back_populates="device", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Device(serial={self.serial_number}, ip={self.ip_address})>"


class HddStats(Base):
    """
    Статистика жёсткого диска.

    Хранит снапшот состояния HDD на момент синхронизации.
    """
    __tablename__ = "hikvision_hdd_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("hikvision_devices.id", ondelete="CASCADE"), nullable=False)

    # Идентификация
    disk_number = Column(Integer, nullable=False)  # 1-based номер диска

    # Объём
    capacity_gb = Column(Float, default=0)
    free_space_gb = Column(Float, default=0)
    used_percent = Column(Float, default=0)

    # Статус
    status = Column(String(32), nullable=True)
    status_code = Column(Integer, default=0)
    hdd_type = Column(String(32), nullable=True)
    type_code = Column(Integer, default=0)
    is_recycling = Column(Boolean, default=False)
    is_critical = Column(Boolean, default=False)

    # S.M.A.R.T.
    smart_status = Column(String(16), nullable=True)  # Pass/Fail/Warning
    power_on_hours = Column(Integer, default=0)
    temperature = Column(Integer, default=0)
    reallocated_sectors = Column(Integer, default=0)

    # Информация о диске
    model = Column(String(128), nullable=True)
    supplier = Column(String(64), nullable=True)
    location = Column(String(64), nullable=True)

    # Метаданные
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    device = relationship("Device", back_populates="hdd_stats")

    # Индексы
    __table_args__ = (
        Index("ix_hdd_stats_device_disk", "device_id", "disk_number"),
        Index("ix_hdd_stats_recorded", "recorded_at"),
    )

    def __repr__(self):
        return f"<HddStats(device_id={self.device_id}, disk={self.disk_number}, status={self.status})>"


class ChannelStats(Base):
    """
    Статистика канала (камеры).

    Хранит снапшот состояния канала на момент синхронизации.
    """
    __tablename__ = "hikvision_channel_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("hikvision_devices.id", ondelete="CASCADE"), nullable=False)

    # Идентификация
    channel_number = Column(Integer, nullable=False)  # SDK номер (33+)
    display_number = Column(Integer, nullable=False)  # D1, D2... (1-16)
    channel_type = Column(String(8), nullable=False)  # ip/analog

    # Статус
    is_configured = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)
    is_recording = Column(Boolean, default=False)
    has_signal = Column(Boolean, default=False)

    # Параметры
    ip_address = Column(String(64), nullable=True)
    protocol = Column(String(32), nullable=True)
    bitrate_kbps = Column(Integer, default=0)
    connected_clients = Column(Integer, default=0)
    offline_reason = Column(String(64), nullable=True)

    # Записи
    has_recordings_24h = Column(Boolean, default=False)
    recordings_count = Column(Integer, default=0)
    recordings_size_gb = Column(Float, default=0)

    # Метаданные
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    device = relationship("Device", back_populates="channel_stats")

    # Индексы
    __table_args__ = (
        Index("ix_channel_stats_device_channel", "device_id", "channel_number"),
        Index("ix_channel_stats_recorded", "recorded_at"),
    )

    def __repr__(self):
        return f"<ChannelStats(device_id={self.device_id}, D{self.display_number}, online={self.is_online})>"


class SyncHistory(Base):
    """
    История синхронизаций.

    Хранит метаданные каждой синхронизации для аудита.
    """
    __tablename__ = "hikvision_sync_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("hikvision_devices.id", ondelete="CASCADE"), nullable=False)

    # Результат
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    error_code = Column(Integer, nullable=True)

    # Статистика
    overall_status = Column(String(16), nullable=True)  # healthy/warning/critical
    total_hdd = Column(Integer, default=0)
    critical_hdd = Column(Integer, default=0)
    total_channels = Column(Integer, default=0)
    online_channels = Column(Integer, default=0)
    offline_channels = Column(Integer, default=0)
    channels_with_recordings = Column(Integer, default=0)

    # Метаданные
    sync_started_at = Column(DateTime, default=datetime.utcnow)
    sync_completed_at = Column(DateTime, nullable=True)
    sync_duration_ms = Column(Integer, nullable=True)

    # Связи
    device = relationship("Device", back_populates="sync_history")

    # Индексы
    __table_args__ = (
        Index("ix_sync_history_device", "device_id"),
        Index("ix_sync_history_started", "sync_started_at"),
    )

    def __repr__(self):
        return f"<SyncHistory(device_id={self.device_id}, success={self.success}, status={self.overall_status})>"


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_tables(engine):
    """
    Создать все таблицы в базе данных.

    Args:
        engine: SQLAlchemy engine
    """
    Base.metadata.create_all(engine)


def drop_tables(engine):
    """
    Удалить все таблицы из базы данных.

    Args:
        engine: SQLAlchemy engine
    """
    Base.metadata.drop_all(engine)

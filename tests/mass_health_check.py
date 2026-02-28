"""
Mass Health Check Script (Async Version)
=========================================
Asynchronous mass health check of Hikvision NVR/DVR devices.

Features:
- Parallel device checking with configurable concurrency (Semaphore)
- Real-time progress bar (tqdm)
- Deep diagnostics: HDD SMART, 24h recordings, channel status
- Time synchronization support (manual/auto modes)
- Camera snapshots capture
- Individual Markdown reports per device

Usage:
    python mass_health_check.py                      # Read-only mode
    python mass_health_check.py --sync               # Auto-sync time if drift > 30s
    python mass_health_check.py --save-photos        # Save snapshots from all channels
    python mass_health_check.py --sync --save-photos # Full mode

Requirements:
    - target.csv file in current directory
    - pip install tqdm
"""

import csv
import os
import sys
import asyncio
import argparse
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    from tqdm.asyncio import tqdm
    from tqdm import tqdm as tqdm_sync
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False
    print("Warning: tqdm not installed. Run: pip install tqdm")
    print("Continuing without progress bar...\n")

from hik_monitor_lib import HikvisionManager, SyncData, TimeInfo

# Configuration
MAX_CONCURRENT = 5          # Maximum parallel connections
CRITICAL_HOURS = 50000      # HDD hours threshold for "CRITICAL" marking
REPORTS_DIR = "reports"


@dataclass
class DeviceResult:
    """Result of checking a single device."""
    name: str
    host: str
    port: int
    success: bool
    sync_data: Optional[SyncData] = None
    error: Optional[str] = None
    duration_sec: float = 0.0
    time_info: Optional[TimeInfo] = None      # Time information
    time_synced: bool = False                  # Was time synchronized
    original_drift: int = 0                    # Original drift before sync
    snapshots_saved: int = 0                   # Number of snapshots saved
    snapshots_failed: int = 0                  # Number of failed snapshots


def read_targets(csv_path: str) -> List[Dict]:
    """
    Read target devices from CSV file.

    Args:
        csv_path: Path to CSV file

    Returns:
        List of device dictionaries
    """
    targets = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get('host'):
                continue
            targets.append({
                'name': row['name'],
                'host': row['host'],
                'username': row['username'],
                'password': row['password'],
                'port': int(row['port'])
            })
    return targets


def format_hours(hours: int) -> str:
    """Format hours into human-readable string."""
    if hours == 0:
        return "-"
    if hours >= 8760:  # 1 year
        years = hours / 8760
        return f"{hours:,} ч ({years:.1f} лет)"
    elif hours >= 720:  # 1 month
        months = hours / 720
        return f"{hours:,} ч ({months:.1f} мес)"
    else:
        return f"{hours:,} ч"


def generate_detailed_report(result: DeviceResult) -> str:
    """
    Generate detailed Markdown report for a device.

    Args:
        result: DeviceResult with sync_data or error

    Returns:
        Markdown string
    """
    lines = []
    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d %H:%M:%S')

    # Header
    lines.append(f"# Диагностика: {result.name}")
    lines.append("")
    lines.append(f"| Параметр | Значение |")
    lines.append(f"|----------|----------|")
    lines.append(f"| **IP адрес** | `{result.host}:{result.port}` |")
    lines.append(f"| **Дата проверки** | {date_str} |")
    lines.append(f"| **Время проверки** | {result.duration_sec:.1f} сек |")

    if result.error:
        lines.append(f"| **Статус** | ❌ ОШИБКА |")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## Ошибка подключения")
        lines.append("")
        lines.append(f"```")
        lines.append(result.error)
        lines.append(f"```")
        return "\n".join(lines)

    sd = result.sync_data
    hs = sd.health_summary

    # Status emoji
    status_emoji = {"healthy": "✅", "warning": "⚠️", "critical": "❌"}
    emoji = status_emoji.get(hs.overall_status, "❓")

    lines.append(f"| **Статус** | {emoji} {hs.overall_status.upper()} |")
    lines.append(f"| **Серийный номер** | `{sd.device.serial_number}` |")
    lines.append(f"| **Тип устройства** | {sd.device.device_type_name} |")
    lines.append("")

    # Summary box
    lines.append("---")
    lines.append("")
    lines.append("## Сводка")
    lines.append("")
    lines.append(f"| Метрика | Значение |")
    lines.append(f"|---------|----------|")
    lines.append(f"| Каналов онлайн | **{hs.online_channels}** из {hs.configured_channels} |")
    lines.append(f"| Каналов офлайн | **{hs.offline_channels}** |")
    lines.append(f"| Не настроено | {hs.unconfigured_channels} |")
    lines.append(f"| Каналов с записью 24ч | **{hs.channels_with_recordings}** |")
    lines.append(f"| Дисков всего | {hs.total_hdd} |")
    lines.append(f"| Дисков критичных | **{hs.critical_hdd}** |")
    lines.append("")

    # HDD Table
    lines.append("---")
    lines.append("")
    lines.append("## Жёсткие диски (SMART)")
    lines.append("")

    if sd.hdd_list:
        lines.append("| # | Модель | Объём | Свободно | Статус | Наработка | Темп. | SMART | Примечание |")
        lines.append("|---|--------|-------|----------|--------|-----------|-------|-------|------------|")

        for hdd in sd.hdd_list:
            hours = hdd.power_on_hours
            hours_str = format_hours(hours)

            # Temperature
            temp_str = f"{hdd.temperature}°C" if hdd.temperature > 0 else "-"

            # Notes
            notes = []
            if hours > CRITICAL_HOURS:
                notes.append("⚠️ >50k ч")
            if hdd.is_critical:
                notes.append("❌ Замена")
            if hdd.smart_status and hdd.smart_status.lower() == "fail":
                notes.append("❌ SMART Fail")
            note_str = ", ".join(notes) if notes else "✅"

            # Model (truncate if too long)
            model = hdd.model[:20] if hdd.model else "-"

            lines.append(
                f"| {hdd.number} | {model} | {hdd.capacity_gb:.0f} GB | "
                f"{hdd.free_space_gb:.0f} GB | {hdd.status} | {hours_str} | "
                f"{temp_str} | {hdd.smart_status or '-'} | {note_str} |"
            )
    else:
        lines.append("*Нет данных о дисках*")

    lines.append("")

    # Channels Table
    lines.append("---")
    lines.append("")
    lines.append("## Каналы (D1-D16)")
    lines.append("")

    ip_channels = [ch for ch in sd.channels if ch.channel_type == "ip"]

    if ip_channels:
        lines.append("| Канал | IP камеры | Статус | Причина | Запись 24ч |")
        lines.append("|-------|-----------|--------|---------|------------|")

        # Create recordings lookup
        rec_by_channel = {r.channel_number: r for r in sd.recordings}

        for ch in ip_channels:
            ch_name = f"D{ch.display_number}"

            if not ch.is_configured:
                lines.append(f"| {ch_name} | - | ⚪ Не настроен | - | - |")
                continue

            ip = ch.ip_address or "-"

            if ch.is_online:
                status = "🟢 Онлайн"
                reason = "-"
            else:
                status = "🔴 Офлайн"
                # Offline reason
                reason = ch.offline_reason if ch.offline_reason else "Unknown"

            # Recording status
            rec = rec_by_channel.get(ch.channel_number)
            if rec and rec.has_recordings:
                rec_str = f"✅ {rec.files_count} файлов"
            elif ch.is_online:
                rec_str = "❌ Нет записей"
            else:
                rec_str = "-"

            lines.append(f"| {ch_name} | {ip} | {status} | {reason} | {rec_str} |")
    else:
        lines.append("*Нет IP каналов*")

    # Analog channels if any
    analog_channels = [ch for ch in sd.channels if ch.channel_type == "analog"]
    if analog_channels:
        lines.append("")
        lines.append("### Аналоговые каналы")
        lines.append("")
        lines.append("| Канал | Статус | Сигнал | Запись |")
        lines.append("|-------|--------|--------|--------|")

        for ch in analog_channels:
            ch_name = f"A{ch.display_number}"
            if ch.is_online:
                status = "🟢 Онлайн"
                signal = "✅" if ch.has_signal else "❌"
            else:
                status = "🔴 Офлайн"
                signal = "❌"
            rec = "✅" if ch.is_recording else "❌"
            lines.append(f"| {ch_name} | {status} | {signal} | {rec} |")

    # Time synchronization section
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Синхронизация времени")
    lines.append("")

    if hasattr(result, 'time_info') and result.time_info:
        ti = result.time_info
        lines.append("| Параметр | Значение |")
        lines.append("|----------|----------|")
        lines.append(f"| **Время устройства** | {ti.device_time.strftime('%Y-%m-%d %H:%M:%S')} |")
        lines.append(f"| **Время сервера** | {ti.server_time.strftime('%Y-%m-%d %H:%M:%S')} |")

        # Format drift
        drift = ti.drift_seconds
        drift_sign = "+" if drift >= 0 else ""
        if abs(drift) >= 3600:
            drift_str = f"{drift_sign}{drift} сек ({abs(drift) // 3600} ч {abs(drift) % 3600 // 60} мин)"
        elif abs(drift) >= 60:
            drift_str = f"{drift_sign}{drift} сек ({abs(drift) // 60} мин)"
        else:
            drift_str = f"{drift_sign}{drift} сек"

        lines.append(f"| **Разница** | {drift_str} |")

        if ti.timezone:
            lines.append(f"| **Часовой пояс** | {ti.timezone} |")
        if ti.time_mode:
            lines.append(f"| **Режим времени** | {ti.time_mode} |")

        # Status with emoji
        if hasattr(result, 'time_synced') and result.time_synced:
            original_drift = getattr(result, 'original_drift', drift)
            lines.append(f"| **Статус** | 🔄 Синхронизировано (было: {original_drift:+d} сек) |")
        elif ti.sync_status == "ok":
            lines.append(f"| **Статус** | ✅ ОК |")
        elif ti.sync_status == "drift":
            lines.append(f"| **Статус** | ⚠️ Требуется настройка |")
        elif ti.sync_status == "error":
            lines.append(f"| **Статус** | ❌ Ошибка получения времени |")
        else:
            lines.append(f"| **Статус** | ❓ Неизвестно |")
    else:
        lines.append("*Информация о времени недоступна*")

    # Snapshots section
    if result.snapshots_saved > 0 or result.snapshots_failed > 0:
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## Снимки с камер")
        lines.append("")
        lines.append("| Параметр | Значение |")
        lines.append("|----------|----------|")
        lines.append(f"| **Сохранено** | {result.snapshots_saved} |")
        lines.append(f"| **Ошибок** | {result.snapshots_failed} |")
        snap_dir = f"snapshots/{result.host.replace('.', '_')}/"
        lines.append(f"| **Папка** | `{snap_dir}` |")

    lines.append("")
    lines.append("---")
    lines.append(f"*Отчёт сгенерирован: {date_str}*")

    return "\n".join(lines)


async def check_device(
    target: Dict,
    semaphore: asyncio.Semaphore,
    progress_callback=None,
    auto_sync: bool = False,
    threshold: int = 30,
    save_photos: bool = False,
    snapshots_dir: str = None
) -> DeviceResult:
    """
    Check a single device with semaphore for concurrency control.

    Args:
        target: Device connection info
        semaphore: Asyncio semaphore for limiting concurrent connections
        progress_callback: Optional callback to update progress
        auto_sync: If True, automatically sync time if drift > threshold
        threshold: Time drift threshold in seconds for auto-sync
        save_photos: If True, capture snapshots from all online channels
        snapshots_dir: Directory to save snapshots (e.g., reports/snapshots)

    Returns:
        DeviceResult with sync_data, time_info, or error
    """
    name = target['name']
    host = target['host']
    port = target['port']

    start_time = datetime.now()

    async with semaphore:
        if progress_callback:
            progress_callback(f"{host} -> Connecting...")

        try:
            # Create manager for this device
            manager = HikvisionManager()

            try:
                await manager.connect(
                    host,
                    port,
                    target['username'],
                    target['password']
                )

                if progress_callback:
                    progress_callback(f"{host} -> Collecting data...")

                sync_data = await manager.get_sync_data()

                # Get time information
                if progress_callback:
                    progress_callback(f"{host} -> Checking time...")

                time_info = await manager.get_time_info()
                time_synced = False
                original_drift = time_info.drift_seconds

                # Auto-sync time if enabled and drift exceeds threshold
                if auto_sync and abs(time_info.drift_seconds) > threshold:
                    if progress_callback:
                        progress_callback(f"{host} -> Syncing time (drift: {time_info.drift_seconds}s)...")

                    synced, time_info = await manager.sync_time(threshold)
                    time_synced = synced

                # Capture snapshots if enabled
                snapshots_saved = 0
                snapshots_failed = 0

                if save_photos and snapshots_dir:
                    if progress_callback:
                        progress_callback(f"{host} -> Capturing snapshots...")

                    # Get list of online channels
                    online_channels = [
                        ch.display_number for ch in sync_data.channels
                        if ch.is_configured and ch.is_online
                    ]

                    if online_channels:
                        # Create device-specific snapshot directory
                        device_snap_dir = os.path.join(snapshots_dir, host.replace(".", "_"))
                        os.makedirs(device_snap_dir, exist_ok=True)

                        # Capture snapshots from all online channels
                        snapshot_results = await manager.get_all_snapshots(online_channels)

                        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')

                        for channel_num, (success, jpeg_data, error_msg) in snapshot_results.items():
                            if success and jpeg_data:
                                # Save JPEG file
                                filename = f"D{channel_num}_{timestamp_str}.jpg"
                                filepath = os.path.join(device_snap_dir, filename)
                                try:
                                    with open(filepath, 'wb') as f:
                                        f.write(jpeg_data)
                                    snapshots_saved += 1
                                except Exception as e:
                                    snapshots_failed += 1
                            else:
                                snapshots_failed += 1

                await manager.disconnect()

                duration = (datetime.now() - start_time).total_seconds()

                if progress_callback:
                    notes = []
                    if time_synced:
                        notes.append("time synced")
                    if save_photos:
                        notes.append(f"photos: {snapshots_saved}/{snapshots_saved + snapshots_failed}")
                    note_str = f" [{', '.join(notes)}]" if notes else ""
                    progress_callback(f"{host} -> ✅ Success ({duration:.1f}s){note_str}")

                return DeviceResult(
                    name=name,
                    host=host,
                    port=port,
                    success=True,
                    sync_data=sync_data,
                    duration_sec=duration,
                    time_info=time_info,
                    time_synced=time_synced,
                    original_drift=original_drift,
                    snapshots_saved=snapshots_saved,
                    snapshots_failed=snapshots_failed
                )

            except Exception as e:
                try:
                    await manager.disconnect()
                except:
                    pass
                raise e

            finally:
                manager.cleanup()

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            error_msg = str(e)

            if progress_callback:
                progress_callback(f"{host} -> ❌ Error: {error_msg[:30]}...")

            return DeviceResult(
                name=name,
                host=host,
                port=port,
                success=False,
                error=error_msg,
                duration_sec=duration
            )


async def main():
    """Main async function."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description='Hikvision Mass Health Check - Deep diagnostics for NVR/DVR devices',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python mass_health_check.py                    # Read-only mode (manual)
  python mass_health_check.py --sync             # Auto-sync time if drift > 30s
  python mass_health_check.py --sync --threshold 60  # Custom threshold
  python mass_health_check.py --save-photos      # Save snapshots from cameras
  python mass_health_check.py --sync --save-photos   # Full mode
        '''
    )
    parser.add_argument(
        '--sync',
        action='store_true',
        help='Auto-sync device time if drift exceeds threshold (default: read-only)'
    )
    parser.add_argument(
        '--threshold',
        type=int,
        default=30,
        help='Time drift threshold in seconds for auto-sync (default: 30)'
    )
    parser.add_argument(
        '--csv',
        type=str,
        default='target.csv',
        help='Path to CSV file with target devices (default: target.csv)'
    )
    parser.add_argument(
        '--save-photos',
        action='store_true',
        help='Capture and save snapshots from all online channels'
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  Hikvision Mass Health Check (Async)")
    print("=" * 60)
    print()

    # Show mode
    mode_parts = []
    if args.sync:
        mode_parts.append(f"AUTO-SYNC (threshold: {args.threshold}s)")
    else:
        mode_parts.append("READ-ONLY")
    if args.save_photos:
        mode_parts.append("SAVE-PHOTOS")

    mode_str = " + ".join(mode_parts)
    print(f"📋 Mode: {mode_str}")
    print()

    # Create reports directory
    os.makedirs(REPORTS_DIR, exist_ok=True)

    # Read targets
    csv_path = args.csv
    if not os.path.exists(csv_path):
        print(f"❌ Error: {csv_path} not found!")
        return

    targets = read_targets(csv_path)
    total = len(targets)

    if total == 0:
        print("❌ No devices found in target.csv")
        return

    print(f"📋 Devices found: {total}")
    print(f"⚡ Max concurrent: {MAX_CONCURRENT}")
    print(f"📁 Reports dir: {REPORTS_DIR}/")

    # Create snapshots directory if needed
    snapshots_dir = None
    if args.save_photos:
        snapshots_dir = os.path.join(REPORTS_DIR, "snapshots")
        os.makedirs(snapshots_dir, exist_ok=True)
        print(f"📷 Snapshots dir: {snapshots_dir}/")

    print()

    # Semaphore for limiting concurrent connections
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    # Status tracking for tqdm
    status_dict = {}

    def update_status(host: str, status: str):
        status_dict[host] = status

    # Create tasks
    tasks = []
    for target in targets:
        host = target['host']
        task = check_device(
            target,
            semaphore,
            progress_callback=lambda s, h=host: update_status(h, s),
            auto_sync=args.sync,
            threshold=args.threshold,
            save_photos=args.save_photos,
            snapshots_dir=snapshots_dir
        )
        tasks.append(task)

    # Run with progress bar
    print("🔄 Starting parallel checks...")
    print()

    results: List[DeviceResult] = []

    if TQDM_AVAILABLE:
        # Use tqdm for progress
        with tqdm_sync(total=total, desc="Checking devices", unit="device") as pbar:
            for coro in asyncio.as_completed(tasks):
                result = await coro
                results.append(result)

                # Update progress bar
                status = "✅" if result.success else "❌"
                pbar.set_postfix_str(f"{result.host} {status}")
                pbar.update(1)
    else:
        # Fallback without tqdm
        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            result = await coro
            results.append(result)
            status = "✅ Success" if result.success else f"❌ Error"
            print(f"[{i}/{total}] {result.host} -> {status}")

    print()

    # Generate reports
    print("📝 Generating reports...")

    date_str = datetime.now().strftime('%Y-%m-%d')
    success_count = 0
    error_count = 0

    for result in results:
        # Generate report
        report = generate_detailed_report(result)

        # Save file
        filename = f"{REPORTS_DIR}/report_{result.host}_{date_str}.md"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(report)

        if result.success:
            success_count += 1
        else:
            error_count += 1

    # Summary
    print()
    print("=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print()
    print(f"  ✅ Successful: {success_count}")
    print(f"  ❌ Failed:     {error_count}")
    print(f"  📁 Reports:    {REPORTS_DIR}/")
    print()

    # List devices with issues
    if error_count > 0:
        print("  ⚠️  Failed devices:")
        for r in results:
            if not r.success:
                print(f"     - {r.name} ({r.host}): {r.error[:50]}...")
        print()

    # List devices with critical HDD
    critical_hdd_devices = []
    for r in results:
        if r.success and r.sync_data:
            for hdd in r.sync_data.hdd_list:
                if hdd.power_on_hours > CRITICAL_HOURS or hdd.is_critical:
                    critical_hdd_devices.append((r.name, r.host, hdd.number, hdd.power_on_hours))

    if critical_hdd_devices:
        print("  ⚠️  Devices with critical HDD (>50k hours):")
        for name, host, hdd_num, hours in critical_hdd_devices:
            print(f"     - {name} ({host}): Disk {hdd_num} = {hours:,} hours")
        print()

    # List devices with offline channels
    offline_devices = []
    for r in results:
        if r.success and r.sync_data:
            hs = r.sync_data.health_summary
            if hs.offline_channels > 0:
                offline_devices.append((r.name, r.host, hs.offline_channels, hs.configured_channels))

    if offline_devices:
        print("  ⚠️  Devices with offline channels:")
        for name, host, offline, total_ch in offline_devices:
            print(f"     - {name} ({host}): {offline}/{total_ch} channels offline")
        print()

    # List devices with time drift
    time_drift_devices = []
    time_synced_devices = []
    for r in results:
        if r.success and r.time_info:
            if r.time_synced:
                time_synced_devices.append((r.name, r.host, r.original_drift, r.time_info.drift_seconds))
            elif r.time_info.sync_status == "drift":
                time_drift_devices.append((r.name, r.host, r.time_info.drift_seconds))

    if time_synced_devices:
        print("  🔄 Devices with time synchronized:")
        for name, host, old_drift, new_drift in time_synced_devices:
            print(f"     - {name} ({host}): {old_drift:+d}s → {new_drift:+d}s")
        print()

    if time_drift_devices:
        print("  ⏰ Devices with time drift (requires attention):")
        for name, host, drift in time_drift_devices:
            print(f"     - {name} ({host}): drift = {drift:+d}s")
        print()

    # Snapshots summary
    if args.save_photos:
        total_saved = sum(r.snapshots_saved for r in results if r.success)
        total_failed = sum(r.snapshots_failed for r in results if r.success)
        if total_saved > 0 or total_failed > 0:
            print(f"  📷 Snapshots captured: {total_saved} saved, {total_failed} failed")
            print(f"     Location: {snapshots_dir}/")
            print()

    print("=" * 60)
    print("  Done!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

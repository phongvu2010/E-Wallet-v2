"""Automated Alert Scheduler Service.

Runs periodic asynchronous background tasks to scan credit card payment due dates,
installment schedules, credit utilization thresholds, and expiring reward points,
automatically dispatching In-App notifications and Telegram Bot alerts.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.notification_service import NotificationService


class AlertSchedulerService:
    """Manages background task loop for automated financial monitoring and alert dispatching."""

    _instance: Optional["AlertSchedulerService"] = None
    _task: Optional[asyncio.Task] = None
    _is_running: bool = False
    _interval_seconds: int = 6 * 3600  # Default 6 hours

    _last_run_at: Optional[datetime] = None
    _next_run_at: Optional[datetime] = None
    _total_scans_completed: int = 0
    _last_alerts_generated: int = 0
    _last_error: Optional[str] = None

    @classmethod
    def get_instance(cls) -> "AlertSchedulerService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        hours = getattr(settings, "ALERT_SCAN_INTERVAL_HOURS", 6)
        self._interval_seconds = max(60, hours * 3600)

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Return real-time diagnostic status of the background monitoring scheduler."""
        inst = cls.get_instance()
        return {
            "is_enabled": getattr(settings, "ENABLE_BACKGROUND_SCHEDULER", True),
            "is_running": inst._is_running,
            "interval_hours": inst._interval_seconds / 3600.0,
            "last_run_at": inst._last_run_at.isoformat() if inst._last_run_at else None,
            "next_run_at": inst._next_run_at.isoformat() if inst._next_run_at else None,
            "total_scans_completed": inst._total_scans_completed,
            "last_alerts_generated": inst._last_alerts_generated,
            "last_error": inst._last_error,
        }

    @classmethod
    async def trigger_now(cls) -> Dict[str, Any]:
        """Execute an immediate alert scan cycle on demand."""
        inst = cls.get_instance()
        return await inst._execute_scan_cycle()

    async def _execute_scan_cycle(self) -> Dict[str, Any]:
        """Perform a single complete alert scan across all database views."""
        now = datetime.now()
        self._last_run_at = now
        self._last_error = None
        alerts_count = 0

        try:
            async with AsyncSessionLocal() as session:
                alerts_count = await NotificationService.scan_and_generate_alerts(session)

            self._total_scans_completed += 1
            self._last_alerts_generated = alerts_count
            print(
                f"[AlertScheduler] Scan completed at {now.strftime('%Y-%m-%d %H:%M:%S')}. "
                f"Generated {alerts_count} alerts."
            )
            return {
                "success": True,
                "timestamp": now.isoformat(),
                "alerts_generated": alerts_count,
            }
        except Exception as exc:
            self._last_error = str(exc)
            print(f"[AlertScheduler] Error during scan cycle: {exc}")
            return {
                "success": False,
                "timestamp": now.isoformat(),
                "error": str(exc),
            }

    async def _loop(self):
        """Infinite loop sleeping for `_interval_seconds` between scan cycles."""
        print(
            f"[AlertScheduler] Background monitoring started. "
            f"Scan interval: {self._interval_seconds / 3600.0:.1f} hours."
        )
        self._is_running = True

        # Initial startup scan after short 5-second warmup
        try:
            await asyncio.sleep(5)
            await self._execute_scan_cycle()
        except asyncio.CancelledError:
            self._is_running = False
            return
        except Exception as e:
            print(f"[AlertScheduler] Initial warmup scan error: {e}")

        while self._is_running:
            self._next_run_at = datetime.now() + timedelta(seconds=self._interval_seconds)
            try:
                await asyncio.sleep(self._interval_seconds)
                await self._execute_scan_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[AlertScheduler] Periodic scan error: {e}")
                self._last_error = str(e)
                # Wait 60s before retrying on crash
                await asyncio.sleep(60)

        self._is_running = False
        print("[AlertScheduler] Background monitoring stopped.")

    @classmethod
    def start(cls):
        """Start the background scheduler task if enabled."""
        if not getattr(settings, "ENABLE_BACKGROUND_SCHEDULER", True):
            print("[AlertScheduler] Background monitoring is disabled in settings.")
            return

        inst = cls.get_instance()
        if inst._task is None or inst._task.done():
            inst._task = asyncio.create_task(inst._loop())

    @classmethod
    async def stop(cls):
        """Gracefully cancel and terminate the background scheduler task."""
        inst = cls.get_instance()
        inst._is_running = False
        if inst._task and not inst._task.done():
            inst._task.cancel()
            try:
                await inst._task
            except asyncio.CancelledError:
                pass
            inst._task = None


scheduler_service = AlertSchedulerService.get_instance()

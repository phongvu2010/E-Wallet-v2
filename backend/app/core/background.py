"""Distributed Background Service Coordinator for Gunicorn Multi-Workers.

Provides leader election using PostgreSQL session-level advisory locks (`pg_try_advisory_lock`),
guaranteeing that exactly ONE worker process executes periodic alerts and Telegram polling,
while all other workers safely process incoming HTTP REST API requests.

Includes automated failover watchdog: if the active leader worker restarts or terminates,
a standby worker automatically promotes itself to become the new background leader.
"""

import asyncio
from datetime import datetime
import os
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import settings
from app.core.database import async_engine
from app.services.scheduler_service import AlertSchedulerService
from app.services.telegram_bot_service import TelegramBotService


class BackgroundServiceCoordinator:
    """Coordinates singleton background tasks across multiple Gunicorn worker processes."""

    _instance: Optional["BackgroundServiceCoordinator"] = None

    def __init__(self):
        self._lock_conn: Optional[AsyncConnection] = None
        self._is_leader: bool = False
        self._is_running: bool = False
        self._watchdog_task: Optional[asyncio.Task] = None
        self._worker_pid: int = os.getpid()
        self._started_at: Optional[datetime] = None
        self._mode: str = str(getattr(settings, "RUN_BACKGROUND_SERVICES", "auto")).lower()
        self._lock_id: int = int(getattr(settings, "BACKGROUND_LOCK_ID", 88481234))

    @classmethod
    def get_instance(cls) -> "BackgroundServiceCoordinator":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def is_leader(self) -> bool:
        return self._is_leader

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Return diagnostic status of the coordinator and attached services."""
        inst = cls.get_instance()
        return {
            "worker_pid": inst._worker_pid,
            "is_leader": inst._is_leader,
            "is_running": inst._is_running,
            "mode": inst._mode,
            "lock_id": inst._lock_id,
            "started_at": inst._started_at.isoformat() if inst._started_at else None,
            "services": {
                "scheduler": AlertSchedulerService.get_status(),
                "telegram": TelegramBotService.get_status(),
            },
        }

    @classmethod
    async def start(cls):
        """Initialize background service coordinator and attempt leader election."""
        inst = cls.get_instance()
        await inst._start_coordinator()

    @classmethod
    async def stop(cls):
        """Gracefully release advisory lock and stop all active background services."""
        inst = cls.get_instance()
        await inst._stop_coordinator()

    async def _try_acquire_lock(self) -> bool:
        """Attempt to acquire a PostgreSQL session-level advisory lock."""
        if "sqlite" in settings.async_database_url:
            return True

        try:
            if self._lock_conn is None or self._lock_conn.closed:
                self._lock_conn = await async_engine.connect()

            res = await self._lock_conn.execute(
                text("SELECT pg_try_advisory_lock(:lock_id);"),
                {"lock_id": self._lock_id},
            )
            acquired = bool(res.scalar())
            if not acquired and self._lock_conn and not self._lock_conn.closed:
                await self._lock_conn.close()
                self._lock_conn = None
            return acquired
        except Exception as exc:
            print(f"[BackgroundCoordinator] Warning: Failed to query advisory lock: {exc}")
            if self._lock_conn and not self._lock_conn.closed:
                try:
                    await self._lock_conn.close()
                except Exception:
                    pass
                self._lock_conn = None
            return False

    async def _release_lock(self):
        """Release session-level advisory lock and close dedicated connection."""
        if self._lock_conn and not self._lock_conn.closed:
            try:
                await self._lock_conn.execute(
                    text("SELECT pg_advisory_unlock(:lock_id);"),
                    {"lock_id": self._lock_id},
                )
                await self._lock_conn.close()
            except Exception as exc:
                print(f"[BackgroundCoordinator] Warning releasing advisory lock: {exc}")
            finally:
                self._lock_conn = None

    async def _start_coordinator(self):
        self._is_running = True
        self._started_at = datetime.now()

        if self._mode == "false":
            print(
                f"[BackgroundCoordinator] Worker (PID {self._worker_pid}) running in API-ONLY mode "
                f"(RUN_BACKGROUND_SERVICES=false). Background services disabled on this process."
            )
            return

        # Attempt to acquire leader role
        acquired = await self._try_acquire_lock()
        if acquired:
            self._is_leader = True
            print(
                f"[BackgroundCoordinator] Worker (PID {self._worker_pid}) ACQUIRED leader lock ({self._lock_id}). "
                f"Starting AlertScheduler and TelegramBot polling as LEADER."
            )
            AlertSchedulerService.start()
            TelegramBotService.start()
        else:
            self._is_leader = False
            print(
                f"[BackgroundCoordinator] Worker (PID {self._worker_pid}) running as STANDBY API WORKER "
                f"(Advisory lock held by another worker). Active watchdog enabled for failover."
            )
            # Start watchdog loop to take over if leader terminates
            if self._watchdog_task is None or self._watchdog_task.done():
                self._watchdog_task = asyncio.create_task(self._watchdog_loop())

    async def _watchdog_loop(self):
        """Periodic loop attempting to acquire leadership if active leader terminates."""
        while self._is_running and not self._is_leader:
            try:
                await asyncio.sleep(25)
                if not self._is_running or self._is_leader:
                    break

                acquired = await self._try_acquire_lock()
                if acquired:
                    self._is_leader = True
                    print(
                        f"[BackgroundCoordinator] Standby Worker (PID {self._worker_pid}) "
                        f"PROMOTED to BACKGROUND LEADER! Starting services."
                    )
                    AlertSchedulerService.start()
                    TelegramBotService.start()
                    break
            except asyncio.CancelledError:
                break
            except Exception as exc:
                print(f"[BackgroundCoordinator] Failover watchdog check error: {exc}")

    async def _stop_coordinator(self):
        self._is_running = False

        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except asyncio.CancelledError:
                pass
            self._watchdog_task = None

        if self._is_leader:
            self._is_leader = False
            print(f"[BackgroundCoordinator] Stopping background services on Worker PID {self._worker_pid}...")
            await TelegramBotService.stop()
            await AlertSchedulerService.stop()
            await self._release_lock()
            print(f"[BackgroundCoordinator] Leader lock released for Worker PID {self._worker_pid}.")

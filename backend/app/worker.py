"""Standalone Background Worker Process Entrypoint.

Usage:
    python -m app.worker

Runs the Alert Scheduler and Telegram Bot long-polling service in a dedicated process,
isolated from FastAPI HTTP API web workers.
"""

import asyncio
import os
import signal
import sys

from app.core.background import BackgroundServiceCoordinator
from app.core.database import async_engine


async def main():
    print("=" * 65)
    print("🚀 CREDIT WALLET 2.0 - DEDICATED BACKGROUND WORKER")
    print("=" * 65)
    print(f"Process PID: {os.getpid()}")
    
    # Force background services enabled in standalone mode
    os.environ["RUN_BACKGROUND_SERVICES"] = "true"

    stop_event = asyncio.Event()

    def handle_signal(sig, frame):
        print(f"\n[Worker] Received exit signal ({sig}). Initiating graceful shutdown...")
        stop_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        await BackgroundServiceCoordinator.start()
        print("[Worker] Background services initialized. Running event loop...")

        while not stop_event.is_set():
            await asyncio.sleep(1)

    except Exception as exc:
        print(f"[Worker] Fatal error in background worker: {exc}", file=sys.stderr)
    finally:
        print("[Worker] Stopping background services...")
        await BackgroundServiceCoordinator.stop()
        await async_engine.dispose()
        print("[Worker] Background worker process shutdown complete.")


if __name__ == "__main__":
    asyncio.run(main())

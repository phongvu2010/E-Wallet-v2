import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict


class ETLService:
    """Service layer managing ETL Data Ingestion, migration execution, and worker synchronization.

    Provides mutex locking to prevent concurrent migration race conditions while capturing
    subprocess stdout/stderr logs for reporting.
    """

    _lock = asyncio.Lock()
    _is_running = False

    @staticmethod
    def run_migration_script() -> Dict[str, Any]:
        """Execute `scripts/migrate_data.py` synchronously in a subprocess and capture its terminal output.

        Searches upwards for the repository root containing `scripts/migrate_data.py`, executes it
        with Python binary, and returns execution status along with stdout/stderr.

        Returns:
            Dict[str, Any]: Dictionary containing:
                - success (bool): True if returncode is 0.
                - message (str): Status or error description.
                - output (str): Captured stdout and stderr logs.
        """
        # Search upwards for scripts/migrate_data.py
        cur = Path(__file__).resolve().parent
        root_dir = None
        script_path = None
        for _ in range(5):
            candidate = cur / "scripts" / "migrate_data.py"
            if candidate.exists():
                script_path = candidate
                root_dir = cur
                break
            cur = cur.parent

        if not script_path:
            return {
                "success": False,
                "message": "Migration script not found at scripts/migrate_data.py",
                "output": "",
            }

        try:
            result = subprocess.run(
                [sys.executable, str(script_path)],
                cwd=str(root_dir),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=120,
            )

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": "Migration executed successfully",
                    "output": result.stdout,
                }
            else:
                return {
                    "success": False,
                    "message": f"Migration failed with exit code {result.returncode}",
                    "output": result.stderr or result.stdout,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Execution error: {str(e)}",
                "output": "",
            }

    @staticmethod
    async def run_migration_script_async() -> Dict[str, Any]:
        """Execute `scripts/migrate_data.py` asynchronously off the main event loop.

        Guards against duplicate parallel executions using an asynchronous Mutex Lock (`asyncio.Lock`).

        Returns:
            Dict[str, Any]: Execution result dictionary with success flag, message, and logs.
        """
        if ETLService._lock.locked() or ETLService._is_running:
            return {
                "success": False,
                "message": "Quá trình đồng bộ ETL đang được thực thi. Vui lòng đợi tiến trình hiện tại hoàn tất.",
                "output": "Migration is already in progress.",
            }

        async with ETLService._lock:
            ETLService._is_running = True
            try:
                return await asyncio.to_thread(ETLService.run_migration_script)
            finally:
                ETLService._is_running = False

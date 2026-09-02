import asyncio
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.config import settings


class ETLService:
    """Service layer managing ETL Data Ingestion, migration execution, and worker synchronization.

    Provides mutex locking to prevent concurrent migration race conditions while capturing
    subprocess stdout/stderr logs for reporting.
    """

    _lock = asyncio.Lock()
    _is_running = False

    @staticmethod
    def _find_root_and_script() -> tuple[Optional[Path], Optional[Path]]:
        """Search upwards for scripts/migrate_data.py and project root."""
        cur = Path(__file__).resolve().parent
        for _ in range(5):
            candidate = cur / "scripts" / "migrate_data.py"
            if candidate.exists():
                return cur, candidate
            cur = cur.parent
        return None, None

    @staticmethod
    def run_migration_script(google_sheet_id: Optional[str] = None) -> Dict[str, Any]:
        """Execute `scripts/migrate_data.py` synchronously in a subprocess and capture its terminal output.

        Args:
            google_sheet_id (Optional[str]): Optional Google Sheet ID or URL to synchronize from.

        Returns:
            Dict[str, Any]: Dictionary containing:
                - success (bool): True if returncode is 0.
                - message (str): Status or error description.
                - output (str): Captured stdout and stderr logs.
        """
        root_dir, script_path = ETLService._find_root_and_script()

        if not script_path or not root_dir:
            return {
                "success": False,
                "message": "Migration script not found at scripts/migrate_data.py",
                "output": "",
            }

        cmd = [sys.executable, str(script_path)]
        if google_sheet_id and google_sheet_id.strip():
            cmd.extend(["--sheet-id", google_sheet_id.strip()])

        try:
            result = subprocess.run(
                cmd,
                cwd=str(root_dir),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=180,
            )

            full_output = result.stdout or ""
            if result.stderr:
                full_output += f"\n[STDERR]\n{result.stderr}"

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": "Đồng bộ dữ liệu ETL thành công",
                    "output": full_output,
                }
            else:
                return {
                    "success": False,
                    "message": f"Quá trình đồng bộ kết thúc với mã lỗi {result.returncode}",
                    "output": full_output,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Execution error: {str(e)}",
                "output": "",
            }

    @staticmethod
    async def run_migration_script_async(
        google_sheet_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute `scripts/migrate_data.py` asynchronously off the main event loop.

        Guards against duplicate parallel executions using an asynchronous Mutex Lock (`asyncio.Lock`).

        Args:
            google_sheet_id (Optional[str]): Optional Google Sheet ID or URL.

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
                return await asyncio.to_thread(
                    ETLService.run_migration_script, google_sheet_id
                )
            finally:
                ETLService._is_running = False

    @staticmethod
    def get_config() -> Dict[str, Any]:
        """Fetch current ETL Google Sheets configuration and cache status."""
        root_dir, _ = ETLService._find_root_and_script()
        excel_exists = False
        cache_exists = False
        if root_dir:
            excel_exists = (root_dir / "data" / "My Credit Wallet 2.0.xlsx").exists()
            cache_exists = (root_dir / "data" / "google_sheet_cache.xlsx").exists()

        sheet_id = os.getenv("GOOGLE_SHEET_ID") or getattr(
            settings, "GOOGLE_SHEET_ID", "16kks0eL-j7SNxBAR3NlU5n1viIEvTjg-fAu9yWC9mAk"
        )

        return {
            "google_sheet_id": sheet_id,
            "source_type": "google_sheet",
            "has_local_excel": excel_exists,
            "has_cached_sheet": cache_exists,
        }

    @staticmethod
    def update_config(google_sheet_id: str) -> Dict[str, Any]:
        """Update and persist GOOGLE_SHEET_ID in runtime environment and .env file."""
        clean_id = google_sheet_id.strip()
        # Extract ID if a full URL was provided
        match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", clean_id)
        if match:
            clean_id = match.group(1)

        os.environ["GOOGLE_SHEET_ID"] = clean_id
        settings.GOOGLE_SHEET_ID = clean_id

        # Update .env file if it exists
        root_dir, _ = ETLService._find_root_and_script()
        if root_dir:
            env_path = root_dir / ".env"
            if env_path.exists():
                try:
                    content = env_path.read_text(encoding="utf-8")
                    if "GOOGLE_SHEET_ID=" in content:
                        new_content = re.sub(
                            r"GOOGLE_SHEET_ID=.*",
                            f"GOOGLE_SHEET_ID={clean_id}",
                            content,
                        )
                    else:
                        new_content = content + f"\nGOOGLE_SHEET_ID={clean_id}\n"
                    env_path.write_text(new_content, encoding="utf-8")
                except Exception:
                    pass

        return ETLService.get_config()

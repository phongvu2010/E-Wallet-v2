import subprocess
import sys
from pathlib import Path
from typing import Dict, Any


class ETLService:
    @staticmethod
    def run_migration_script() -> Dict[str, Any]:
        """
        Executes scripts/migrate_data.py synchronously and captures output.
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
        """
        Executes scripts/migrate_data.py asynchronously via a worker thread
        so the main async event loop remains unblocked.
        """
        import asyncio

        return await asyncio.to_thread(ETLService.run_migration_script)

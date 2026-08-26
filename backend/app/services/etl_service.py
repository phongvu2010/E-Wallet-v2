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
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        script_path = root_dir / "scripts" / "migrate_data.py"

        if not script_path.exists():
            return {
                "success": False,
                "message": f"Script not found at {script_path}",
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

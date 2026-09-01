from fastapi import APIRouter

from app.schemas.common import APIResponse
from app.services.etl_service import ETLService

router = APIRouter()


@router.post(
    "/sync",
    response_model=APIResponse[dict],
    summary="Trigger ETL Migration & Data Sync from Excel/PDF",
)
async def trigger_etl_sync():
    """Trigger background execution of the ETL data pipeline (`scripts/migrate_data.py`) to ingest Excel/PDF files into PostgreSQL."""
    result = await ETLService.run_migration_script_async()
    return APIResponse[dict](
        success=result["success"],
        message=result["message"],
        data={"output": result["output"][:2000]},  # truncate output if very long
    )

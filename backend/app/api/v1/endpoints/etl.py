from fastapi import APIRouter, status, BackgroundTasks
from backend.app.schemas.common import APIResponse
from backend.app.services.etl_service import ETLService

router = APIRouter()


@router.post("/sync", response_model=APIResponse[dict], summary="Trigger ETL Migration & Data Sync from Excel/PDF")
async def trigger_etl_sync(background_tasks: BackgroundTasks):
    result = ETLService.run_migration_script()
    return APIResponse[dict](
        success=result["success"],
        message=result["message"],
        data={"output": result["output"][:2000]},  # truncate output if very long
    )

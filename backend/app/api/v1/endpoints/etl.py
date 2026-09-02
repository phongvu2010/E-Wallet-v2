from typing import Optional

from fastapi import APIRouter

from app.schemas.common import APIResponse
from app.schemas.etl import ETLConfigRead, ETLConfigUpdate, ETLSyncRequest
from app.services.etl_service import ETLService

router = APIRouter()


@router.post(
    "/sync",
    response_model=APIResponse[dict],
    summary="Trigger ETL Migration & Data Sync from Google Sheets / Excel",
)
async def trigger_etl_sync(payload: Optional[ETLSyncRequest] = None):
    """Trigger background execution of the ETL data pipeline (`scripts/migrate_data.py`).

    Supports dynamic `google_sheet_id` passed in request payload or uses default environment configuration.
    """
    sheet_id = payload.google_sheet_id if payload else None
    result = await ETLService.run_migration_script_async(google_sheet_id=sheet_id)
    return APIResponse[dict](
        success=result["success"],
        message=result["message"],
        data={"output": result["output"][:4000]},  # Provide ample terminal log length
    )


@router.get(
    "/config",
    response_model=APIResponse[ETLConfigRead],
    summary="Get current ETL Google Sheets configuration",
)
async def get_etl_config():
    """Retrieve active Google Sheet ID, data source mode, and local cache availability."""
    config = ETLService.get_config()
    return APIResponse[ETLConfigRead](
        success=True,
        message="ETL configuration retrieved successfully",
        data=ETLConfigRead(**config),
    )


@router.post(
    "/config",
    response_model=APIResponse[ETLConfigRead],
    summary="Update default Google Sheet ID configuration",
)
async def update_etl_config(payload: ETLConfigUpdate):
    """Update active Google Sheet ID and persist to runtime and environment."""
    updated = ETLService.update_config(payload.google_sheet_id)
    return APIResponse[ETLConfigRead](
        success=True,
        message="Cập nhật cấu hình Google Sheet thành công",
        data=ETLConfigRead(**updated),
    )

from typing import Optional
from pydantic import BaseModel, Field


class ETLSyncRequest(BaseModel):
    google_sheet_id: Optional[str] = Field(
        default=None,
        description="Google Sheet ID or Full URL to synchronize from",
    )
    source_type: Optional[str] = Field(
        default="google_sheet",
        description="Data source: 'google_sheet' or 'excel'",
    )


class ETLConfigRead(BaseModel):
    google_sheet_id: str
    source_type: str = "google_sheet"
    has_local_excel: bool = True
    has_cached_sheet: bool = False


class ETLConfigUpdate(BaseModel):
    google_sheet_id: str

from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class InstitutionBase(BaseModel):
    code: str
    name: str
    short_name: Optional[str] = None
    logo_url: Optional[str] = None
    hotline: Optional[str] = None
    website: Optional[str] = None


class InstitutionCreate(InstitutionBase):
    pass


class InstitutionRead(InstitutionBase):
    id: UUID
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

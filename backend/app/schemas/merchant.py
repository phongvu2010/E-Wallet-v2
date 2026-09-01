from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MerchantAliasBase(BaseModel):
    pattern: str


class MerchantAliasCreate(MerchantAliasBase):
    merchant_id: UUID


class MerchantAliasRead(MerchantAliasBase):
    id: UUID
    merchant_id: UUID
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MerchantBase(BaseModel):
    cleaned_name: str
    default_category_id: Optional[UUID] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None


class MerchantCreate(MerchantBase):
    pass


class MerchantSimpleRead(MerchantBase):
    id: UUID
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MerchantRead(MerchantSimpleRead):
    aliases: List[MerchantAliasRead] = []

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.reward import RewardTypeEnum


class RewardLedgerBase(BaseModel):
    account_id: UUID
    statement_id: Optional[UUID] = None
    reward_type: RewardTypeEnum = RewardTypeEnum.POINT
    previous_remaining: Decimal = Field(default=Decimal("0.00"))
    earned_this_month: Decimal = Field(default=Decimal("0.00"))
    used_this_month: Decimal = Field(default=Decimal("0.00"))
    available_balance: Decimal = Field(default=Decimal("0.00"))
    expiring_amount: Decimal = Field(default=Decimal("0.00"))
    expiration_date: Optional[date] = None


class RewardLedgerCreate(RewardLedgerBase):
    pass


class RewardLedgerRead(RewardLedgerBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

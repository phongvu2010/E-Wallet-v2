from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.account import AccountTypeEnum, AccountStatusEnum
from backend.app.schemas.institution import InstitutionRead


class AccountBase(BaseModel):
    institution_id: Optional[UUID] = None
    account_name: str
    account_type: AccountTypeEnum = AccountTypeEnum.CREDIT_CARD
    card_number_masked: str
    card_number_last4: str
    credit_limit: Decimal = Field(default=Decimal("0.00"))
    billing_day_of_month: Optional[int] = Field(default=None, ge=1, le=31)
    grace_period_days: int = Field(default=15, ge=0)
    status: AccountStatusEnum = AccountStatusEnum.ACTIVE
    replaces_account_id: Optional[UUID] = None
    opened_date: Optional[date] = None
    closed_date: Optional[date] = None
    color_hex: Optional[str] = "#3b82f6"
    note: Optional[str] = None


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    billing_day_of_month: Optional[int] = None
    grace_period_days: Optional[int] = None
    status: Optional[AccountStatusEnum] = None
    replaces_account_id: Optional[UUID] = None
    closed_date: Optional[date] = None
    color_hex: Optional[str] = None
    note: Optional[str] = None


class AccountRead(AccountBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    institution: Optional[InstitutionRead] = None

    model_config = ConfigDict(from_attributes=True)


class AccountOverviewRead(BaseModel):
    account_id: UUID
    account_name: str
    bank_name: str
    card_number_masked: str
    credit_limit: Decimal
    latest_statement_balance: Decimal
    next_payment_due_date: date
    status: AccountStatusEnum
    replaces_account_id: Optional[UUID] = None
    replaced_by_card_number: Optional[str] = None


class AccountLiveBalanceRead(BaseModel):
    account_id: UUID
    account_name: str
    bank_name: Optional[str] = None
    card_number_masked: str
    credit_limit: Decimal
    latest_statement_date: Optional[date] = None
    latest_statement_balance: Decimal
    unbilled_charges: Decimal
    unbilled_credits: Decimal
    unbilled_net_amount: Decimal
    unbilled_transaction_count: int
    live_current_balance: Decimal
    live_available_limit: Decimal
    live_utilization_percentage: Decimal
    live_risk_level: str
    next_payment_due_date: Optional[date] = None
    status: AccountStatusEnum

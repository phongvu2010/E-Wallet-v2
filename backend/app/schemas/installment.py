from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.installment import InstallmentStatusEnum
from backend.app.schemas.merchant import MerchantSimpleRead


class InstallmentScheduleBase(BaseModel):
    installment_index: int
    total_installments: int
    due_date: date
    principal_amount: Decimal
    interest_amount: Decimal = Field(default=Decimal("0.00"))
    total_installment_amount: Decimal
    is_billed: bool = False
    statement_id: Optional[UUID] = None


class InstallmentScheduleRead(InstallmentScheduleBase):
    id: UUID
    installment_plan_id: UUID
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InstallmentPlanBase(BaseModel):
    account_id: UUID
    origin_transaction_id: Optional[UUID] = None
    product_name: str
    merchant_id: Optional[UUID] = None
    start_date: date
    total_amount: Decimal
    conversion_fee: Decimal = Field(default=Decimal("0.00"))
    interest_rate_percent: Decimal = Field(default=Decimal("0.00"))
    term_months: int
    monthly_principal: Decimal
    monthly_interest: Decimal = Field(default=Decimal("0.00"))
    monthly_payment: Decimal
    remaining_balance: Decimal
    status: InstallmentStatusEnum = InstallmentStatusEnum.ACTIVE


class InstallmentPlanCreate(BaseModel):
    account_id: UUID
    product_name: str
    merchant_id: Optional[UUID] = None
    origin_transaction_id: Optional[UUID] = None
    start_date: date
    total_amount: Decimal
    conversion_fee: Decimal = Decimal("0.00")
    interest_rate_percent: Decimal = Decimal("0.00")
    term_months: int


class InstallmentPlanRead(InstallmentPlanBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    merchant: Optional[MerchantSimpleRead] = None
    schedules: List[InstallmentScheduleRead] = []

    model_config = ConfigDict(from_attributes=True)


class EarlySettleRequest(BaseModel):
    statement_id: Optional[UUID] = None
    fee_percent: Decimal = Decimal("2.00")
    custom_fee: Optional[Decimal] = None


class EarlySettleResponse(BaseModel):
    plan_id: UUID
    product_name: str
    settled_principal: Decimal
    early_settlement_fee: Decimal
    new_status: InstallmentStatusEnum


class InstallmentForecastRead(BaseModel):
    billing_month: str
    active_plans_count: int
    total_principal_due: Decimal
    total_interest_due: Decimal
    total_monthly_payment: Decimal

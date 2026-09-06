from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.loan import (
    InterestMethodEnum,
    LoanScheduleStatusEnum,
    LoanStatusEnum,
    LoanTypeEnum,
)
from app.schemas.institution import InstitutionRead


class LoanScheduleBase(BaseModel):
    period_index: int
    total_periods: int
    due_date: date
    applied_interest_rate: Decimal
    beginning_balance: Decimal
    principal_amount: Decimal
    interest_amount: Decimal
    monthly_fee: Decimal = Decimal("0.00")
    total_payment: Decimal
    ending_balance: Decimal
    status: LoanScheduleStatusEnum = LoanScheduleStatusEnum.UNPAID
    paid_date: Optional[date] = None
    paid_amount: Optional[Decimal] = None
    transaction_id: Optional[UUID] = None


class LoanScheduleRead(LoanScheduleBase):
    id: UUID
    loan_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoanRateHistoryRead(BaseModel):
    id: UUID
    loan_id: UUID
    old_rate: Decimal
    new_rate: Decimal
    old_monthly_fee: Optional[Decimal] = Decimal("0.00")
    new_monthly_fee: Optional[Decimal] = Decimal("0.00")
    effective_from_period: int
    effective_date: date
    reason: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoanBase(BaseModel):
    account_id: Optional[UUID] = None
    institution_id: Optional[UUID] = None
    loan_name: str
    loan_code: Optional[str] = None
    loan_type: LoanTypeEnum = LoanTypeEnum.MORTGAGE
    interest_method: InterestMethodEnum = InterestMethodEnum.EQUAL_INSTALLMENT
    principal_amount: Decimal = Field(gt=Decimal("0.00"))
    term_months: int = Field(gt=0)
    start_date: date
    billing_day_of_month: int = Field(default=15, ge=1, le=31)
    current_interest_rate: Decimal = Field(ge=Decimal("0.00"))
    base_rate: Optional[Decimal] = Decimal("0.00")
    floating_margin: Optional[Decimal] = Decimal("0.00")
    monthly_fee: Optional[Decimal] = Decimal("0.00")
    note: Optional[str] = None


class LoanCreate(LoanBase):
    pass


class LoanUpdate(BaseModel):
    account_id: Optional[UUID] = None
    institution_id: Optional[UUID] = None
    loan_name: Optional[str] = None
    loan_code: Optional[str] = None
    loan_type: Optional[LoanTypeEnum] = None
    billing_day_of_month: Optional[int] = None
    monthly_fee: Optional[Decimal] = None
    note: Optional[str] = None
    status: Optional[LoanStatusEnum] = None


class LoanRead(LoanBase):
    id: UUID
    user_id: Optional[UUID] = None
    remaining_principal: Decimal
    total_paid_principal: Decimal
    total_paid_interest: Decimal
    total_projected_interest: Decimal
    status: LoanStatusEnum
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    institution: Optional[InstitutionRead] = None
    schedules: Optional[List[LoanScheduleRead]] = None
    rate_histories: Optional[List[LoanRateHistoryRead]] = None

    model_config = ConfigDict(from_attributes=True)


class AdjustLoanRateRequest(BaseModel):
    new_interest_rate: Decimal = Field(ge=Decimal("0.00"), description="Lãi suất mới %/năm")
    new_monthly_fee: Optional[Decimal] = Field(default=None, description="Phí dịch vụ / quản lý hàng tháng mới (VNĐ)")
    effective_from_period: int = Field(ge=1, description="Kỳ bắt đầu áp dụng lãi suất mới")
    effective_date: Optional[date] = Field(default=None, description="Ngày bắt đầu có hiệu lực")
    reason: Optional[str] = Field(default=None, description="Lý do điều chỉnh lãi suất")


class PayLoanPeriodRequest(BaseModel):
    period_index: int = Field(ge=1, description="Kỳ thanh toán")
    payment_account_id: Optional[UUID] = Field(default=None, description="Tài khoản nguồn trích tiền")
    paid_amount: Optional[Decimal] = Field(default=None, description="Số tiền thanh toán thực tế (mặc định lấy theo lịch)")
    paid_date: Optional[date] = Field(default=None, description="Ngày thanh toán (mặc định hôm nay)")
    note: Optional[str] = Field(default=None, description="Ghi chú giao dịch")


class EarlySettleLoanRequest(BaseModel):
    settlement_account_id: Optional[UUID] = Field(default=None, description="Tài khoản nguồn trích tiền tất toán")
    fee_percent: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"), description="Phí phạt tất toán trước hạn %")
    custom_fee: Optional[Decimal] = Field(default=None, description="Phí phạt cố định (nếu có)")
    settlement_date: Optional[date] = Field(default=None, description="Ngày tất toán")


class LoanSummaryKPIs(BaseModel):
    total_active_loans: int
    total_remaining_principal: Decimal
    total_paid_interest: Decimal
    total_paid_principal: Decimal
    due_this_month_amount: Decimal
    due_this_month_count: int

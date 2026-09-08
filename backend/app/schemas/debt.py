import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.debt import DebtStatusEnum, DebtTypeEnum


# -----------------------------------------------------------------------------
# Debt Repayment Schemas
# -----------------------------------------------------------------------------

class DebtRepaymentBase(BaseModel):
    repayment_date: datetime.date = Field(default_factory=datetime.date.today)
    principal_paid: Decimal = Field(..., gt=0, description="Số tiền gốc trả đợt này")
    extra_amount: Decimal = Field(default=Decimal("0.00"), ge=0, description="Tiền bồi dưỡng / cảm ơn / quà thêm")
    account_id: Optional[UUID] = Field(None, description="Tài khoản trích tiền trả hoặc nhận tiền thu nợ")
    extra_category_id: Optional[UUID] = Field(None, description="Danh mục chi tiêu cho khoản tiền bồi dưỡng (mặc định: Quà tặng/Chi tiêu khác)")
    note: Optional[str] = Field(None, max_length=500)


class DebtRepaymentCreate(DebtRepaymentBase):
    pass


class DebtRepaymentRead(BaseModel):
    id: UUID
    debt_id: UUID
    account_id: Optional[UUID] = None
    account_name: Optional[str] = None
    account_bank_name: Optional[str] = None
    repayment_date: datetime.date
    principal_paid: Decimal
    extra_amount: Decimal
    total_amount: Decimal
    transaction_id: Optional[UUID] = None
    extra_transaction_id: Optional[UUID] = None
    note: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Debt Schemas
# -----------------------------------------------------------------------------

class DebtBase(BaseModel):
    counterparty_name: str = Field(..., min_length=1, max_length=150, description="Tên người vay / cho vay")
    counterparty_phone: Optional[str] = Field(None, max_length=20)
    debt_type: DebtTypeEnum = Field(default=DebtTypeEnum.BORROW, description="BORROW (Tôi đi vay) | LEND (Tôi cho vay)")
    principal_amount: Decimal = Field(..., gt=0, description="Số tiền gốc vay/mượn")
    start_date: datetime.date = Field(default_factory=datetime.date.today)
    due_date: Optional[datetime.date] = None
    account_id: Optional[UUID] = Field(None, description="Tài khoản nhận tiền (khi đi vay) hoặc xuất tiền (khi cho vay)")
    note: Optional[str] = Field(None, max_length=1000)


class DebtCreate(DebtBase):
    pass


class DebtUpdate(BaseModel):
    counterparty_name: Optional[str] = Field(None, min_length=1, max_length=150)
    counterparty_phone: Optional[str] = Field(None, max_length=20)
    due_date: Optional[datetime.date] = None
    status: Optional[DebtStatusEnum] = None
    note: Optional[str] = None


class DebtRead(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    account_name: Optional[str] = None
    account_bank_name: Optional[str] = None
    counterparty_name: str
    counterparty_phone: Optional[str] = None
    debt_type: DebtTypeEnum
    principal_amount: Decimal
    remaining_amount: Decimal
    total_paid_principal: Decimal
    total_extra_amount: Decimal
    start_date: datetime.date
    due_date: Optional[datetime.date] = None
    status: DebtStatusEnum
    note: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    repayments: List[DebtRepaymentRead] = []

    class Config:
        from_attributes = True


class DebtSummaryKPIs(BaseModel):
    # Dành cho khoản tôi đi vay (BORROW - Nợ phải trả)
    total_borrow_count: int = 0
    total_borrow_principal: Decimal = Decimal("0.00")
    total_borrow_remaining: Decimal = Decimal("0.00")
    total_borrow_paid: Decimal = Decimal("0.00")
    total_borrow_extra_paid: Decimal = Decimal("0.00")  # Tiền bồi dưỡng đã trả thêm

    # Dành cho khoản tôi cho vay (LEND - Nợ phải thu)
    total_lend_count: int = 0
    total_lend_principal: Decimal = Decimal("0.00")
    total_lend_remaining: Decimal = Decimal("0.00")
    total_lend_collected: Decimal = Decimal("0.00")
    total_lend_extra_received: Decimal = Decimal("0.00")  # Tiền cảm ơn nhận thêm

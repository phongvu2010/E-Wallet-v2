from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.transaction import TransactionTypeEnum
from app.schemas.category import CategoryRead
from app.schemas.merchant import MerchantSimpleRead


class TransactionBase(BaseModel):
    account_id: UUID
    statement_id: Optional[UUID] = None
    installment_plan_id: Optional[UUID] = None
    transfer_to_account_id: Optional[UUID] = None
    settles_statement_id: Optional[UUID] = None

    transaction_date: date
    post_date: Optional[date] = None
    raw_description: str
    merchant_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    transaction_type: TransactionTypeEnum = TransactionTypeEnum.PURCHASE

    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = "VND"
    exchange_rate: Decimal = Field(default=Decimal("1.0000"))
    foreign_fee: Decimal = Field(default=Decimal("0.00"))

    amount: Decimal
    fee: Decimal = Field(default=Decimal("0.00"))
    total_amount: Decimal

    note: Optional[str] = None
    is_installment: bool = False


class TransactionCreate(TransactionBase):
    tx_fingerprint: Optional[str] = None


class TransactionUpdate(BaseModel):
    category_id: Optional[UUID] = None
    merchant_id: Optional[UUID] = None
    note: Optional[str] = None
    statement_id: Optional[UUID] = None
    settles_statement_id: Optional[UUID] = None
    transaction_type: Optional[TransactionTypeEnum] = None


class TransactionRead(TransactionBase):
    id: UUID
    user_id: Optional[UUID] = None
    tx_fingerprint: Optional[str] = None
    created_at: Optional[datetime] = None

    category: Optional[CategoryRead] = None
    merchant: Optional[MerchantSimpleRead] = None

    model_config = ConfigDict(from_attributes=True)


class TransactionFilterParams(BaseModel):
    account_id: Optional[UUID] = None
    statement_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    merchant_id: Optional[UUID] = None
    transaction_type: Optional[TransactionTypeEnum] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    is_installment: Optional[bool] = None
    search: Optional[str] = None


class TransactionSummaryRead(BaseModel):
    total_transactions: int
    total_spending: Decimal
    total_repayments: Decimal
    total_fees_interest: Decimal
    net_flow: Decimal

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.statement import StatementStatusEnum


class StatementBase(BaseModel):
    account_id: UUID
    statement_date: date
    start_date: date
    end_date: date
    payment_due_date: date
    credit_limit: Decimal = Field(default=Decimal("0.00"))
    previous_balance: Decimal = Field(default=Decimal("0.00"))
    purchases_amount: Decimal = Field(default=Decimal("0.00"))
    installments_amount: Decimal = Field(default=Decimal("0.00"))
    fees_and_charges: Decimal = Field(default=Decimal("0.00"))
    payments_received: Decimal = Field(default=Decimal("0.00"))
    statement_balance: Decimal = Field(default=Decimal("0.00"))
    minimum_payment: Decimal = Field(default=Decimal("0.00"))
    surplus_amount: Decimal = Field(default=Decimal("0.00"))
    status: StatementStatusEnum = StatementStatusEnum.BILLED
    source_file_path: Optional[str] = None
    file_hash: Optional[str] = None


class StatementCreate(StatementBase):
    pass


class StatementRead(StatementBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StatementReconciliationRead(BaseModel):
    statement_id: UUID
    account_name: str
    card_number_masked: str
    statement_date: date
    previous_balance: Decimal
    purchases_amount: Decimal
    installments_amount: Decimal
    fees_and_charges: Decimal
    payments_received: Decimal
    billed_statement_balance: Decimal
    net_period_transactions: Decimal
    expected_statement_balance: Decimal
    discrepancy: Decimal
    reconciliation_status: str


class StatementPaymentStatusRead(BaseModel):
    statement_id: UUID
    account_id: UUID
    account_name: str
    card_number_masked: str
    statement_date: date
    payment_due_date: date
    billed_amount: Decimal
    minimum_payment: Decimal
    total_paid_amount: Decimal
    remaining_balance_to_pay: Decimal
    payment_status: str
    days_until_due: int
